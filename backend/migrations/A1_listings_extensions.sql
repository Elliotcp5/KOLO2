-- ============================================================================
-- KOLO — Migration A1 : extension de la table `listings`
-- ============================================================================
-- OBJECTIF
--   Ajouter les 3 colonnes utilisées par le moteur d'opportunités (Session A3) :
--     - transaction     : 'vente' | 'location'
--     - type_normalise  : catégorie propre (appartement / maison / studio / …)
--     - est_logement    : bool (True pour appartement/maison/studio/loft)
--
--   + les indexes qui accélèrent les 3 requêtes principales :
--     (a) filtre par transaction + code postal (page listing publique)
--     (b) filtre par type_normalise + est_logement (moteur d'opportunités)
--     (c) requêtes "annonces actives récentes" (dashboard admin)
--
-- IDEMPOTENCE
--   Ce fichier est REJOUABLE sans effet de bord. Toutes les instructions
--   utilisent `IF NOT EXISTS`. Ré-exécuter la migration ne modifie ni ne
--   supprime aucune donnée existante.
--
-- SAUVEGARDE OBLIGATOIRE AVANT APPLICATION
--   Depuis Supabase SQL Editor :
--     CREATE TABLE listings_backup_a1 AS SELECT * FROM listings;
--
--   Depuis psql / CLI :
--     pg_dump --table=public.listings --data-only \
--             --file=listings_backup_a1.sql "$DATABASE_URL"
--
--   Ne PAS appliquer cette migration sans backup vérifié. Le champ
--   `raw_data JSONB` peut être volumineux (>500 Mo sur 200k annonces).
--
-- APPLICATION
--   Copier-coller ce fichier dans le SQL Editor Supabase, puis exécuter.
--   Durée attendue : quelques secondes (les ADD COLUMN sont métadonnées).
--   La création des indexes peut prendre 1-2 min sur ~200k lignes.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Colonnes A1
-- ---------------------------------------------------------------------------
ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS transaction TEXT;

ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS type_normalise TEXT;

ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS est_logement BOOLEAN;

-- Contraintes de valeur (soft — s'appuient sur la normalisation applicative)
ALTER TABLE public.listings
    DROP CONSTRAINT IF EXISTS listings_transaction_check;
ALTER TABLE public.listings
    ADD  CONSTRAINT listings_transaction_check
        CHECK (transaction IS NULL OR transaction IN ('vente', 'location'));

-- Commentaires (visibles depuis pgAdmin / Supabase Studio)
COMMENT ON COLUMN public.listings.transaction     IS
    'A1 — vente | location. Rempli par la fonction apply_normalization().';
COMMENT ON COLUMN public.listings.type_normalise  IS
    'A1 — appartement | maison | studio | loft | terrain | parking | local_commercial | bureau | immeuble | autre';
COMMENT ON COLUMN public.listings.est_logement    IS
    'A1 — True si type_normalise ∈ {appartement, maison, studio, loft}';

-- ---------------------------------------------------------------------------
-- 2. Indexes A1
-- ---------------------------------------------------------------------------
-- (a) Filtre principal du site public : "vente à Paris 11e"
CREATE INDEX IF NOT EXISTS idx_listings_transaction_postal
    ON public.listings (transaction, postal_code)
    WHERE is_active = TRUE;

-- (b) Moteur d'opportunités (Session A3) : ne matche QUE les logements
CREATE INDEX IF NOT EXISTS idx_listings_type_normalise
    ON public.listings (type_normalise)
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_listings_est_logement
    ON public.listings (est_logement, transaction)
    WHERE is_active = TRUE AND est_logement = TRUE;

-- (c) Dashboard admin : "annonces vues il y a moins de X heures"
CREATE INDEX IF NOT EXISTS idx_listings_active_last_seen
    ON public.listings (last_seen_at DESC)
    WHERE is_active = TRUE;

-- ---------------------------------------------------------------------------
-- 3. Backfill (optionnel — à lancer manuellement APRÈS déploiement du code)
-- ---------------------------------------------------------------------------
-- NB. La fonction de normalisation applicative se trouve dans
--     `backend/normalization.py`. Elle est appelée à chaque ingestion.
--
-- Pour rattraper les lignes déjà présentes, exécuter le script :
--     python -m backend.scripts.backfill_normalization
--
-- Ce script est lancé UNE seule fois. Il :
--   1. lit toutes les listings où type_normalise IS NULL
--   2. leur applique apply_normalization()
--   3. les met à jour par batchs de 500
-- ============================================================================
