-- ============================================================================
-- KOLO — Migration A1 bis : colonnes complémentaires sur `listings`
-- ============================================================================
-- OBJECTIF
--   Ajouter les colonnes manquantes exigées par la fiche BLOC A / Session A1
--   pour préparer le moteur d'opportunités A3 :
--
--     - Contenu brut de l'annonce (source du parsing A3) :
--         property_type, description
--
--     - Extractions faites par le moteur A3 (rue et étage — 40% du score) :
--         rue_extraite, etage_extrait
--
--     - Géocodage + adresse résolue (via BAN, Session A3) :
--         latitude, longitude, resolved_address, resolved_street,
--         address_confidence
--
--     - Caractéristiques logement (sous-scores A3 + affichage) :
--         floor, bedrooms, has_elevator, has_balcony, has_terrace,
--         has_garden, has_parking, is_new_build, land_surface
--
--     - Énergie complémentaire (le champ `energy_class` existe déjà) :
--         ghg_class
--
--     - Prix historique + m² (baisse de prix = signal chaud) :
--         price_per_m2, previous_price, price_changed,
--         price_drop_count, price_drop_pct
--
--     - Timing & état :
--         days_on_market, days_since_last_change, posted_at, scraped_at, status
--
--     - Découpage administratif :
--         district, department
--
--     - Meta :
--         photo_count, listing_key
--
--   + 2 indexes exigés par la fiche :
--       (a) idx_listings_rue_extraite (rue_extraite) partiel
--           → scan direct rue par rue pour le moteur A3
--       (b) idx_listings_matching (transaction, is_active, type_normalise, surface)
--           → requête principale de rapprochement DPE ↔ annonces
--
-- IDEMPOTENCE
--   Toutes les instructions utilisent `IF NOT EXISTS`. Ré-exécuter la
--   migration n'a aucun effet de bord. Aucune donnée existante n'est
--   modifiée par cette migration.
--
-- DÉPENDANCE
--   Cette migration s'exécute APRÈS `A1_listings_extensions.sql`
--   (qui a créé transaction / type_normalise / est_logement).
--
-- SAUVEGARDE
--   Le backup `listings_backup_a1` créé avant la première migration reste
--   valide. Aucun nouveau backup n'est requis (ADD COLUMN est métadonnée).
--
-- APPLICATION
--   Copier-coller ce fichier dans le SQL Editor Supabase, puis exécuter.
--   Durée attendue : < 10 secondes pour les ADD COLUMN, 1-3 min pour les
--   deux indexes sur ~200k lignes.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Contenu brut de l'annonce
-- ---------------------------------------------------------------------------
ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS property_type TEXT;

ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS description TEXT;

COMMENT ON COLUMN public.listings.property_type IS
    'A1 — libellé brut du type émis par le portail (avant normalisation). Ex: "Appartement 3 pièces", "T4 duplex", "Villa 5p"';
COMMENT ON COLUMN public.listings.description IS
    'A1 — description longue de l''annonce. CRITIQUE pour A3 : source du parsing de rue et d''étage (rue = poids 0.35, plus élevé du moteur).';

-- ---------------------------------------------------------------------------
-- 2. Extractions A3 (moteur d'opportunités)
--    Poids officiels (config_matching, jamais en dur) :
--      rue 0.35  |  surface 0.30  |  classe énergie 0.20  |
--      type de bien 0.10  |  étage 0.05
-- ---------------------------------------------------------------------------
ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS rue_extraite TEXT;

ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS etage_extrait INTEGER;

COMMENT ON COLUMN public.listings.rue_extraite IS
    'A3 — nom de rue extrait de description/title/address. Sous-score rue (poids 0.35, le plus élevé). Poids vivant dans config_matching.';
COMMENT ON COLUMN public.listings.etage_extrait IS
    'A3 — numéro d''étage extrait du texte (0 = RDC). Sous-score étage (poids 0.05). Poids vivant dans config_matching.';

-- ---------------------------------------------------------------------------
-- 3. Géocodage + adresse résolue (BAN)
-- ---------------------------------------------------------------------------
ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;

ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS resolved_address TEXT;

ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS resolved_street TEXT;

ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS address_confidence NUMERIC(4,3);

COMMENT ON COLUMN public.listings.latitude IS
    'A3 — latitude géocodée via BAN (api-adresse.data.gouv.fr).';
COMMENT ON COLUMN public.listings.longitude IS
    'A3 — longitude géocodée via BAN.';
COMMENT ON COLUMN public.listings.resolved_address IS
    'A3 — adresse complète normalisée retournée par la BAN (label).';
COMMENT ON COLUMN public.listings.resolved_street IS
    'A3 — nom de rue canonique retourné par la BAN (source de vérité pour le sous-score rue).';
COMMENT ON COLUMN public.listings.address_confidence IS
    'A3 — score de confiance BAN (0.000 à 1.000). En-dessous de 0.5 le sous-score rue est ignoré.';

-- ---------------------------------------------------------------------------
-- 4. Caractéristiques logement
-- ---------------------------------------------------------------------------
ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS floor INTEGER;

ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS bedrooms INTEGER;

ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS has_elevator BOOLEAN;

ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS has_balcony BOOLEAN;

ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS has_terrace BOOLEAN;

ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS has_garden BOOLEAN;

ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS has_parking BOOLEAN;

ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS is_new_build BOOLEAN;

ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS land_surface INTEGER;

COMMENT ON COLUMN public.listings.floor IS
    'A1 — étage brut (émis par le portail). Ne pas confondre avec etage_extrait (parsé par A3).';
COMMENT ON COLUMN public.listings.land_surface IS
    'A1 — surface terrain en m² (pertinent pour maison / terrain).';

-- ---------------------------------------------------------------------------
-- 5. Énergie complémentaire (energy_class existe déjà)
-- ---------------------------------------------------------------------------
ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS ghg_class TEXT;

COMMENT ON COLUMN public.listings.ghg_class IS
    'A1 — classe GES (gaz à effet de serre) A à G. Complète energy_class pour le sous-score DPE.';

-- ---------------------------------------------------------------------------
-- 6. Prix historique + m²
-- ---------------------------------------------------------------------------
ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS price_per_m2 NUMERIC(10,2);

ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS previous_price INTEGER;

ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS price_changed BOOLEAN;

ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS price_drop_count INTEGER;

ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS price_drop_pct NUMERIC(6,3);

COMMENT ON COLUMN public.listings.price_per_m2 IS
    'A1 — prix / surface (recalculé à chaque ingestion). NULL si surface = 0 ou NULL.';
COMMENT ON COLUMN public.listings.previous_price IS
    'A1 — prix précédent au moment d''une variation (updated lors du diff dans le webhook).';
COMMENT ON COLUMN public.listings.price_drop_count IS
    'A1 — nombre cumulé de baisses de prix observées depuis first_seen_at.';
COMMENT ON COLUMN public.listings.price_drop_pct IS
    'A1 — pourcentage de baisse cumulée depuis first_seen_at ((first_price - price) / first_price * 100).';

-- ---------------------------------------------------------------------------
-- 7. Timing & état
-- ---------------------------------------------------------------------------
ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS days_on_market INTEGER;

ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS days_since_last_change INTEGER;

ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ;

ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS scraped_at TIMESTAMPTZ;

ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS status TEXT;

COMMENT ON COLUMN public.listings.days_on_market IS
    'A1 — jours écoulés depuis posted_at (ou first_seen_at à défaut).';
COMMENT ON COLUMN public.listings.days_since_last_change IS
    'A1 — jours depuis la dernière variation de prix ou de statut.';
COMMENT ON COLUMN public.listings.posted_at IS
    'A1 — date de publication émise par le portail (si disponible).';
COMMENT ON COLUMN public.listings.scraped_at IS
    'A1 — horodatage de la dernière ingestion Apify (peut différer de updated_at si l''upsert échoue).';
COMMENT ON COLUMN public.listings.status IS
    'A1 — état affiché par le portail : active | pending | sold | withdrawn. NULL si non fourni.';

-- ---------------------------------------------------------------------------
-- 8. Découpage administratif
-- ---------------------------------------------------------------------------
ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS district TEXT;

ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS department TEXT;

COMMENT ON COLUMN public.listings.district IS
    'A1 — arrondissement / quartier. Ex: "75011", "Batignolles", "6ème arrondissement".';
COMMENT ON COLUMN public.listings.department IS
    'A1 — département sur 2 caractères (ou 3 pour DOM-TOM). Ex: "75", "13", "971".';

-- ---------------------------------------------------------------------------
-- 9. Meta
-- ---------------------------------------------------------------------------
ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS photo_count INTEGER;

ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS listing_key TEXT;

COMMENT ON COLUMN public.listings.photo_count IS
    'A1 — nombre de photos de l''annonce (utile pour l''UI et un potentiel sous-score qualité).';
COMMENT ON COLUMN public.listings.listing_key IS
    'A1 — clé unique cross-portails (hash rue + surface + type + arrondissement). Permet de détecter la même annonce dupliquée sur plusieurs portails.';

-- ---------------------------------------------------------------------------
-- 10. Indexes A1 bis
-- ---------------------------------------------------------------------------
-- (a) Scan direct rue par rue pour A3
CREATE INDEX IF NOT EXISTS idx_listings_rue_extraite
    ON public.listings (rue_extraite)
    WHERE is_active = TRUE AND rue_extraite IS NOT NULL;

-- (b) Rapprochement principal DPE ↔ annonces (moteur A3)
CREATE INDEX IF NOT EXISTS idx_listings_matching
    ON public.listings (transaction, is_active, type_normalise, surface);

-- (bonus) Deux indexes secondaires très utiles pour A3 mais peu coûteux
CREATE INDEX IF NOT EXISTS idx_listings_listing_key
    ON public.listings (listing_key)
    WHERE listing_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_listings_latlng
    ON public.listings (latitude, longitude)
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND is_active = TRUE;

-- ============================================================================
-- FIN — Vérification post-migration recommandée :
--   SELECT column_name, data_type
--   FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'listings'
--   ORDER BY ordinal_position;
--
--   -- Doit lister 33 colonnes A1 bis + 3 de A1 (transaction, type_normalise,
--   -- est_logement) + les colonnes historiques.
-- ============================================================================
