-- =============================================================
-- KOLO — Seed Supabase avec annonces réalistes (500 listings)
-- À coller dans le SQL Editor Supabase APRÈS supabase_setup.sql
--
-- Ce seed remplit `public.listings` avec ~500 annonces sur les
-- principales villes/CP français pour que la Pige fonctionne
-- immédiatement sans dépendre d'Apify. Une fois le cron collecteur
-- en place, ce seed est optionnel (mais utile en démo / dev).
--
-- Sources tirées : générateur pseudo-aléatoire basé sur des
-- fourchettes de prix/surface réalistes par ville (2024-2025).
-- =============================================================

-- Nettoyage optionnel (décommente si tu veux repartir de zéro)
-- delete from public.listings where portal = 'seed_kolo';

with cities as (
  select * from (values
    ('75001', 'Paris 1er',    14000, 22000, 25, 90),
    ('75008', 'Paris 8e',     13500, 21000, 25, 100),
    ('75011', 'Paris 11e',     9500, 13500, 22, 85),
    ('75015', 'Paris 15e',     9800, 14200, 25, 95),
    ('75017', 'Paris 17e',    10200, 15000, 25, 100),
    ('75018', 'Paris 18e',     8800, 12800, 20, 80),
    ('75020', 'Paris 20e',     8400, 11800, 20, 80),
    ('69001', 'Lyon 1er',      4600,  6800, 22, 80),
    ('69002', 'Lyon 2e',       5100,  7200, 25, 85),
    ('69003', 'Lyon 3e',       4400,  6300, 25, 90),
    ('69006', 'Lyon 6e',       5500,  7500, 30, 100),
    ('69007', 'Lyon 7e',       4200,  5900, 25, 85),
    ('13001', 'Marseille 1er', 2400,  3600, 25, 90),
    ('13006', 'Marseille 6e',  3600,  5200, 28, 90),
    ('13008', 'Marseille 8e',  4200,  6000, 30, 100),
    ('06000', 'Nice',          4500,  6800, 25, 85),
    ('06400', 'Cannes',        6500, 11000, 30, 100),
    ('31000', 'Toulouse',      3400,  4600, 28, 90),
    ('33000', 'Bordeaux',      4700,  6400, 28, 90),
    ('44000', 'Nantes',        3900,  5300, 28, 95),
    ('67000', 'Strasbourg',    3400,  4400, 28, 85),
    ('59000', 'Lille',         3200,  4300, 30, 95),
    ('35000', 'Rennes',        3600,  4900, 28, 90),
    ('34000', 'Montpellier',   3500,  4700, 28, 90),
    ('76000', 'Rouen',         2500,  3400, 30, 95),
    ('63000', 'Clermont',      2300,  3100, 30, 90),
    ('49000', 'Angers',        2700,  3600, 28, 90),
    ('42000', 'Saint-Étienne', 1500,  2200, 30, 95),
    ('92100', 'Boulogne',      9200, 12800, 30, 100),
    ('92200', 'Neuilly',      11500, 16000, 30, 110),
    ('93100', 'Montreuil',     6200,  8800, 28, 95),
    ('94200', 'Ivry',          5800,  8000, 28, 90),
    ('78000', 'Versailles',    6500,  9200, 40, 130),
    ('91000', 'Évry',          2800,  3800, 40, 110),
    ('95100', 'Argenteuil',    3200,  4400, 40, 110)
  ) as t(cp, city, min_ppm, max_ppm, min_surf, max_surf)
),
gen as (
  select
    c.cp,
    c.city,
    c.min_ppm,
    c.max_ppm,
    c.min_surf,
    c.max_surf,
    n as i
  from cities c
  cross join generate_series(1, 15) as n
)
insert into public.listings (
  external_id, portal, postal_code, city, price, surface, rooms, title, url,
  thumbnail_url, energy_class, kind, raw_data, first_seen_at, last_seen_at, is_active
)
select
  'kolo_seed_' || cp || '_' || i as external_id,
  'seed_kolo' as portal,
  cp as postal_code,
  city,
  round(((min_ppm + random() * (max_ppm - min_ppm)) * (min_surf + random() * (max_surf - min_surf)))::numeric)::integer as price,
  round((min_surf + random() * (max_surf - min_surf))::numeric)::integer as surface,
  (1 + floor(random() * 5))::integer as rooms,
  (array[
    'Appartement lumineux', 'Studio meublé', 'Loft rénové', 'T2 charme ancien',
    'T3 balcon plein sud', 'Duplex terrasse', 'Grand T4 familial', 'T2 refait à neuf',
    'Vue dégagée, calme', 'Beau volumes, parquet', 'Immeuble haussmannien',
    'Résidence sécurisée', 'Proche métro', 'Traversant est-ouest'
  ])[1 + floor(random() * 14)::int] || ' ' || surface_display.txt as title,
  'https://www.leboncoin.fr/annonces/offres/id/kolo_seed_' || cp || '_' || i as url,
  '' as thumbnail_url,
  (array['A', 'B', 'C', 'D', 'E', 'F', 'G'])[1 + floor(random() * 7)::int] as energy_class,
  case when random() < 0.55 then 'private' else 'pro' end as kind,
  jsonb_build_object('seed', true, 'generated_at', now()) as raw_data,
  now() - (random() * interval '120 days') as first_seen_at,
  now() - (random() * interval '7 days') as last_seen_at,
  true as is_active
from gen
cross join lateral (
  select (round((min_surf + random() * (max_surf - min_surf))::numeric)::text || ' m²') as txt
) as surface_display
on conflict (portal, external_id) do nothing;

-- Verify
select
  portal,
  count(*)              as total,
  count(distinct postal_code) as postal_codes,
  min(price)            as price_min,
  max(price)            as price_max
from public.listings
where portal = 'seed_kolo'
group by portal;
