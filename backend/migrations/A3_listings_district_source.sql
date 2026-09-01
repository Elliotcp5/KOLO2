-- A3 — Ajoute `district_source` sur listings pour tracer la provenance
-- du district (portail | url | texte | coordonnees).
-- Idempotent : peut être rejoué sans effet secondaire.
ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS district_source TEXT;

COMMENT ON COLUMN public.listings.district_source IS
    'A3 — Source du champ district : portail (natif), url (slug SeLoger), '
    'texte (parsé titre/description), coordonnees (point-in-polygon).';

CREATE INDEX IF NOT EXISTS idx_listings_district_source
    ON public.listings (district_source)
    WHERE district_source IS NOT NULL;
