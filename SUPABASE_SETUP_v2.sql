-- =============================================================
-- KOLO — SETUP SUPABASE FINAL (v2 — Cron Apify → Supabase)
-- À exécuter DANS SUPABASE : Dashboard → SQL Editor → New query
-- → coller TOUT le fichier → Run
--
-- Ce script est 100% idempotent :
--   - Crée la table `listings` si absente
--   - Ajoute les colonnes / index manquants
--   - PURGE les anciennes annonces bidons (`kolo_seed_*`) qui causaient
--     les 404 Leboncoin dans l'app
--   - Affiche un petit rapport à la fin
-- =============================================================


-- ---------- 1) TABLE PRINCIPALE ----------
create table if not exists public.listings (
    id                bigserial primary key,
    external_id       text        not null,        -- id stable dans le portail (fallback = sha1(url))
    portal            text        not null,        -- 'leboncoin', 'pap', 'seloger', 'bienici', 'logic-immo'
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
    raw_data          jsonb,                       -- payload Apify brut (audit / re-normalisation)
    first_seen_at     timestamptz not null default now(), -- JAMAIS écrasé sur upsert
    last_seen_at      timestamptz not null default now(), -- MAJ à chaque re-collecte
    is_active         boolean     not null default true,
    inserted_at       timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);


-- ---------- 2) INDEX ----------
create unique index if not exists listings_portal_extid_uniq
    on public.listings (portal, external_id);

create index if not exists listings_postal_code_idx
    on public.listings (postal_code, first_seen_at desc);

create index if not exists listings_first_seen_idx
    on public.listings (first_seen_at desc)
    where is_active = true;

create index if not exists listings_price_surface_idx
    on public.listings (postal_code, price, surface)
    where is_active = true;

-- Index pour le filtre anti-404 (url NOT LIKE '%kolo_seed%')
create index if not exists listings_url_idx
    on public.listings (url)
    where is_active = true;


-- ---------- 3) GRANTS (Data API / PostgREST) ----------
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on public.listings to service_role;
grant select on public.listings to anon, authenticated;
grant usage, select on all sequences in schema public to service_role;


-- ---------- 4) RLS OFF (accédée uniquement via service_role depuis le backend) ----------
alter table public.listings disable row level security;


-- ---------- 5) PURGE DES ANCIENNES ANNONCES BIDONS ----------
-- Toutes les lignes dont l'URL contient `kolo_seed` viennent des anciens seeds
-- massifs. Elles renvoient sur des 404 Leboncoin → on les vire définitivement.
with deleted as (
    delete from public.listings
    where url ilike '%kolo_seed%'
       or url is null
       or url = ''
       or url not like 'http%'
    returning 1
)
select count(*) as purged_fake_rows from deleted;


-- ---------- 6) RAPPORT FINAL ----------
select
    'listings table ready' as status,
    (select count(*) from public.listings)                                                as total_rows,
    (select count(*) from public.listings where is_active = true)                         as active_rows,
    (select count(*) from public.listings where url ilike '%kolo_seed%')                  as remaining_fake_urls,
    (select count(distinct portal) from public.listings)                                  as distinct_portals,
    (select count(distinct postal_code) from public.listings)                             as distinct_postal_codes;
