# KOLO — Migrations Supabase

Chaque fichier `.sql` de ce dossier est **idempotent** (`ADD COLUMN IF NOT EXISTS`,
`CREATE INDEX IF NOT EXISTS`) et peut donc être ré-exécuté sans effet de bord.

---

## `A1_listings_extensions.sql` — Session A1 (Ingestion)

### 1. Sauvegarde OBLIGATOIRE avant application

Depuis le SQL Editor Supabase :

```sql
CREATE TABLE listings_backup_a1 AS SELECT * FROM listings;
```

Ou depuis `psql` :

```bash
pg_dump --table=public.listings --data-only \
        --file=listings_backup_a1.sql "$DATABASE_URL"
```

### 2. Application

Copier-coller `A1_listings_extensions.sql` dans le SQL Editor Supabase, puis
exécuter. Durée : quelques secondes pour les ADD COLUMN, 1-2 min pour les
indexes sur ~200k lignes.

### 3. Ce que la migration ajoute

Colonnes sur `listings` :

| Colonne          | Type    | Description                                       |
| ---------------- | ------- | ------------------------------------------------- |
| `transaction`    | TEXT    | `vente` ou `location`                             |
| `type_normalise` | TEXT    | `appartement`, `maison`, `studio`, `loft`, `terrain`, `parking`, `local_commercial`, `bureau`, `immeuble`, `autre` |
| `est_logement`   | BOOLEAN | `TRUE` si `type_normalise ∈ {appartement, maison, studio, loft}` |

Indexes (tous filtrés `WHERE is_active = TRUE`) :

- `idx_listings_transaction_postal (transaction, postal_code)`
- `idx_listings_type_normalise (type_normalise)`
- `idx_listings_est_logement (est_logement, transaction)`
- `idx_listings_active_last_seen (last_seen_at DESC)`

### 4. Backfill des lignes existantes (à lancer UNE fois)

Après la migration, les colonnes A1 sont `NULL` sur les lignes existantes.
Pour les rattraper :

```bash
cd /app/backend
python -m scripts.backfill_normalization --dry-run     # simulation
python -m scripts.backfill_normalization               # exécution réelle
```

Le backfill utilise `normalization.apply_normalization()` — exactement la
même fonction que le webhook et le cron. Aucune divergence possible.

### 5. Rollback (en cas de besoin)

```sql
DROP INDEX IF EXISTS idx_listings_active_last_seen;
DROP INDEX IF EXISTS idx_listings_est_logement;
DROP INDEX IF EXISTS idx_listings_type_normalise;
DROP INDEX IF EXISTS idx_listings_transaction_postal;
ALTER TABLE public.listings
    DROP CONSTRAINT IF EXISTS listings_transaction_check,
    DROP COLUMN IF EXISTS est_logement,
    DROP COLUMN IF EXISTS type_normalise,
    DROP COLUMN IF EXISTS transaction;
```
