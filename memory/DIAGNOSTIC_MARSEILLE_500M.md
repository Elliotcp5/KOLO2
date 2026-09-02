# Diagnostic performance — bbox 500 m Marseille (2 sept. 2026)

## Résumé du problème
Le bbox 500 m à Marseille prend **7,0–7,3 s** côté Supabase (reproductible sur 5 runs successifs), alors que les rayons 1000/2000/3000 m à Marseille prennent < 1,2 s et que Paris 500 m prend ~1 s. Ce n'est pas une question de volume : le petit rayon retourne moins de lignes (156) que les grands. C'est un **plan d'exécution défavorable** sur les plages étroites.

## 1. SQL exact de la requête bounding box 500 m Marseille

Requête PostgREST générée par le backend (via `httpx` sur `/rest/v1/mutations_propres`) :

```
GET https://<supabase>/rest/v1/mutations_propres
  ?select=id_mutation,date_mutation,valeur_fonciere,surface_reelle_bati,nombre_pieces_principales,type_local,code_postal,nom_commune,adresse,longitude,latitude,prix_m2
  &type_local=eq.Appartement
  &date_mutation=gte.2024-09-02
  &surface_reelle_bati=gte.48.0
  &surface_reelle_bati=lte.72.0
  &latitude=gte.43.2918034
  &latitude=lte.43.3007966
  &longitude=gte.5.3698218
  &longitude=lte.5.3821782
  &limit=500
```

Traduction SQL :
```sql
SELECT id_mutation, date_mutation, valeur_fonciere, surface_reelle_bati,
       nombre_pieces_principales, type_local, code_postal, nom_commune,
       adresse, longitude, latitude, prix_m2
FROM mutations_propres
WHERE type_local = 'Appartement'
  AND date_mutation >= '2024-09-02'
  AND surface_reelle_bati >= 48.0
  AND surface_reelle_bati <= 72.0
  AND latitude  >= 43.2918034 AND latitude  <= 43.3007966
  AND longitude >= 5.3698218  AND longitude <= 5.3821782
LIMIT 500;
```

Paramètres bbox 500 m calculés depuis (lat=43.2963, lng=5.3760) :
- `d_lat = 500 / 6371000 * (180/π)          = 0.0044966 °`
- `d_lng = 500 / (6371000 · cos(43.2963°)) * (180/π) = 0.0061782 °`

## 2. EXPLAIN à lancer dans le SQL Editor Supabase

**Attention** : `mutations_propres` étant une vue, PostgREST ne l'expose pas à EXPLAIN via l'API (HTTP 406). Il faut lancer les requêtes dans le SQL Editor Supabase avec le rôle `service_role` (paramètre `role` en haut à droite de l'éditeur).

```sql
-- Plan complet avec temps et buffers
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT id_mutation, date_mutation, valeur_fonciere, surface_reelle_bati,
       nombre_pieces_principales, type_local, code_postal, nom_commune,
       adresse, longitude, latitude, prix_m2
FROM mutations_propres
WHERE type_local = 'Appartement'
  AND date_mutation >= '2024-09-02'
  AND surface_reelle_bati >= 48.0
  AND surface_reelle_bati <= 72.0
  AND latitude  >= 43.2918034 AND latitude  <= 43.3007966
  AND longitude >= 5.3698218  AND longitude <= 5.3821782
LIMIT 500;
```

Pour comparaison, lance également ces deux plans pour voir POURQUOI le petit rayon met plus de temps :

```sql
-- Marseille 3000 m (rapide, ~730 ms côté Supabase)
EXPLAIN (ANALYZE, BUFFERS)
SELECT id_mutation, latitude, longitude, prix_m2
FROM mutations_propres
WHERE type_local = 'Appartement'
  AND date_mutation >= '2024-09-02'
  AND surface_reelle_bati BETWEEN 48.0 AND 72.0
  AND latitude  BETWEEN 43.2694 AND 43.3232
  AND longitude BETWEEN 5.3390 AND 5.4130
LIMIT 500;

-- Paris 500 m (rapide, ~950 ms côté Supabase)
EXPLAIN (ANALYZE, BUFFERS)
SELECT id_mutation, latitude, longitude, prix_m2
FROM mutations_propres
WHERE type_local = 'Appartement'
  AND date_mutation >= '2024-09-02'
  AND surface_reelle_bati BETWEEN 48.0 AND 72.0
  AND latitude  BETWEEN 48.8510 AND 48.8600
  AND longitude BETWEEN 2.3517 AND 2.3654
LIMIT 500;
```

## 3. Index existants sur la table `mutations`

**`mutations_propres` est une vue** — les index vivent sur la table sous-jacente `mutations` (ou `dvf_mutations` selon nommage). Récupère les index existants et la définition de la vue :

```sql
-- Index sur la table mutations
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'mutations'
ORDER BY indexname;

-- Si le nom est différent, cherche large
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND (indexdef ILIKE '%latitude%' OR indexdef ILIKE '%longitude%' OR indexdef ILIKE '%type_local%' OR indexdef ILIKE '%date_mutation%')
ORDER BY tablename, indexname;

-- Définition de la vue mutations_propres
SELECT pg_get_viewdef('public.mutations_propres', true) AS view_def;
```

## 4. Dernière statistique ANALYZE

```sql
-- Dernier ANALYZE + autoanalyze + volumétrie
SELECT relname,
       n_live_tup,
       n_dead_tup,
       last_analyze,
       last_autoanalyze,
       last_vacuum,
       last_autovacuum
FROM pg_stat_user_tables
WHERE relname IN ('mutations', 'mutations_propres')
ORDER BY relname;
```

Si `last_analyze` et `last_autoanalyze` sont NULL ou très anciens, un simple `ANALYZE mutations;` peut suffire à corriger le plan sans même toucher aux index.

## 5. Point à trancher — PostGIS

- Un index **B-tree composite** sur `(type_local, date_mutation, latitude, longitude)` NE PASSE PAS par PostGIS et est probablement suffisant vu la structure du filtre. Ordre suggéré : colonnes de plus grande sélectivité en premier.
- Un index **GIST géographique** exigerait l'extension **PostGIS** (`CREATE EXTENSION postgis;`), qui active toute une lib de géométrie/GéoJSON. Utile pour distance haversine côté SQL, superflu pour un bbox rectangulaire simple. À ne considérer que si on veut migrer plus tard vers `ST_DWithin` etc.

## 6. Après le diagnostic

Envoie-moi (ou colle dans un fichier) les sorties des blocs 2, 3 et 4. Trois issues typiques :

1. **`last_analyze` très ancien** → `ANALYZE mutations;` (correction instantanée, plan re-planifié).
2. **Aucun index sur `(latitude, longitude)`** ni sur `(type_local, date_mutation)` → créer un index B-tree composite.
3. **Index présents mais planificateur préfère un seq scan sur petit range** → tuner `random_page_cost` ou augmenter `statistics_target` sur les colonnes lat/lng.

L'index à créer NE SERA DÉCIDÉ QU'APRÈS LECTURE DES PLANS. Aucun ajustement au jugé.
