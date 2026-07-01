-- =============================================================
-- KOLO — Setup Supabase pour la Pige annonces (listings enrichment)
-- À exécuter UNE FOIS dans le SQL Editor Supabase :
--   Dashboard → SQL Editor → New query → coller ce fichier → Run
-- =============================================================

-- Table principale : chaque annonce est stockée avec sa date de première vue.
create table if not exists public.listings (
    id                bigserial primary key,
    external_id       text        not null,        -- id stable dans le portail source (fallback = sha1(url))
    portal            text        not null,        -- 'leboncoin', 'pap', 'seloger', ...
    postal_code       text,                        -- ex '75001'
    city              text,
    price             integer,                     -- €
    surface           integer,                     -- m²
    rooms             integer,
    title             text,
    url               text,
    thumbnail_url     text,
    energy_class      text,                        -- 'A'..'G' si connu
    kind              text,                        -- 'private' | 'pro'
    raw_data          jsonb,                       -- payload brut Apify (pour audit / re-normalisation)
    first_seen_at     timestamptz not null default now(), -- JAMAIS écrasé
    last_seen_at      timestamptz not null default now(), -- MAJ à chaque re-collecte
    is_active         boolean     not null default true,
    inserted_at       timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);

-- Contrainte d'unicité (portal, external_id) — cœur du système
create unique index if not exists listings_portal_extid_uniq
    on public.listings (portal, external_id);

-- Index utiles pour les lectures (filtre CP + fraîcheur + tri)
create index if not exists listings_postal_code_idx
    on public.listings (postal_code, first_seen_at desc);

create index if not exists listings_first_seen_idx
    on public.listings (first_seen_at desc)
    where is_active = true;

create index if not exists listings_price_surface_idx
    on public.listings (postal_code, price, surface)
    where is_active = true;

-- Grants pour Data API (PostgREST) : nécessaires depuis mai 2026
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on public.listings to service_role;
grant select on public.listings to anon, authenticated;
grant usage, select on all sequences in schema public to service_role;

-- RLS off (la table est appelée depuis le backend uniquement, avec service_role key)
alter table public.listings disable row level security;

-- Verify
select 'listings table ready. Row count = ' || count(*)::text as status from public.listings;
