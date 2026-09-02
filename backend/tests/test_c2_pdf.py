"""Tests C2 PDF — Session 2 (génération WeasyPrint).

Périmètre :
  - Rendu du template : 22 sections, sommaire, pas de crash sur données minimales.
  - Règle « expertise » : autorisée UNIQUEMENT dans le bloc mentions et sur la
    couverture. Interdite dans le titre PDF (métadonnées), les libellés
    d'énumération et le nom de fichier.
  - Nom de fichier : `Avis-de-valeur_<slug>_YYYYMMDD.pdf`.
  - Compression images : redimensionnement 1600 px, JPEG q80.
  - Poids et performance : PDF < 10 Mo avec 20 photos, temps < 10 s.
  - Aucun accès Google Fonts pendant le rendu.
  - Job async POST → GET status → GET file.
"""
from __future__ import annotations

import asyncio
import io
import os
import re
import secrets
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
import pypdf
import pytest
from motor.motor_asyncio import AsyncIOMotorClient
from PIL import Image

from c2.pdf.images import MAX_WIDTH, optimize_image
from c2.pdf.renderer import build_filename, render_html, render_pdf
from c2.prefill import deduce_composition


API = "http://localhost:8001"


def _db():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    return client[os.environ["DB_NAME"]]


def _minimal_dossier(ref: str = "AV-2026-TEST01") -> dict:
    return {
        "dossier_id": f"dos_{secrets.token_hex(4)}",
        "user_id": "u_c2_pdf_test",
        "estimation_id": "est_x",
        "niveau": 1,
        "statut": "brouillon",
        "sections": {
            "dossier": {"ref": ref, "date_edition": "2026-02-15", "validite_mois": 6},
            "redacteur": {"agent_nom": "Elliot Cohen", "agent_email": "e@k.io", "agence_nom": "KOLO"},
            "mission": {"demandeur_nom": "M. Test", "objet": "mise en vente"},
            "identification": {
                "type_bien": "appartement", "adresse": "12 rue de Test",
                "code_postal": "75017", "commune": "Paris 17ᵉ", "regime": "copropriété",
                "occupation": "libre",
            },
            "surfaces": {"surface_habitable": 50, "surface_ponderee_totale": 50, "origine_surface": "déclaratif propriétaire"},
            "composition": {"nb_pieces": 2},
            "energie": {"dpe_classe": "D"},
            "marche": {}, "methode": {"methodes_retenues": ["comparaison"]}, "comparables": {"comparables": []},
            "swot": {"atouts": ["Lumineux"], "faiblesses": ["Bruyant"]},
            "conclusion": {"valeur_venale": 500000, "valeur_basse": 480000, "valeur_haute": 520000, "prix_m2_retenu": 10000, "prix_presentation": 519000, "indice_confiance": "moyen"},
            "net_vendeur": {}, "mentions": {"mention_gratuite": "gracieux", "duree_conservation": "trois ans"},
            "signature": {"lieu": "Paris", "date_signature": "2026-02-15"},
            "technique": {}, "copropriete": {}, "charges_fiscalite": {}, "environnement": {},
            "ajustements": {}, "strategie": {}, "annexes": {},
        },
    }


# ---------------------------------------------------------------------------
# 1. Rendu HTML minimal — pas de crash
# ---------------------------------------------------------------------------
class TestRenderHtml:
    def test_render_html_minimal(self):
        html = render_html(_minimal_dossier())
        assert "<html" in html
        assert "AV-2026-TEST01" in html
        assert "Sommaire" in html
        assert "L'essentiel" in html
        assert "Conditions et limites de cet avis" in html
        assert "Google Fonts" not in html
        assert "fonts.googleapis.com" not in html

    def test_render_html_polices_locales(self):
        html = render_html(_minimal_dossier())
        # Le HTML doit référencer les fichiers CSS locaux, pas Google
        assert "pdf_fonts.css" in html or "file://" in html
        assert "fonts.gstatic.com" not in html


# ---------------------------------------------------------------------------
# 2. Nom de fichier
# ---------------------------------------------------------------------------
class TestBuildFilename:
    def test_format(self):
        name = build_filename(_minimal_dossier())
        assert name.startswith("Avis-de-valeur_")
        assert name.endswith(".pdf")
        # Date au format AAAAMMJJ
        stamp = datetime.now().strftime("%Y%m%d")
        assert stamp in name

    def test_slug_sans_accents_ni_espaces(self):
        d = _minimal_dossier()
        d["sections"]["identification"]["adresse"] = "12 rue de l'Élysée, Paris"
        name = build_filename(d)
        assert " " not in name
        assert "é" not in name.lower()
        assert "elysee" in name.lower() or "rue-de-l-elysee" in name.lower()

    def test_expertise_pas_dans_le_nom(self):
        # Même si un champ contient le mot, le nom de fichier ne doit jamais l'inclure
        d = _minimal_dossier()
        d["sections"]["identification"]["adresse"] = "10 rue de l'Expertise, Paris"
        name = build_filename(d)
        assert "expertise" not in name.lower()


# ---------------------------------------------------------------------------
# 3. Compression images (silencieuse)
# ---------------------------------------------------------------------------
class TestImageCompression:
    def _make_test_image(self, path: Path, w: int = 4000, h: int = 3000) -> None:
        # Bruit RGB → PNG lourd (les images unies compressent trop bien)
        img = Image.effect_noise((w, h), 30).convert("RGB")
        img.save(path, format="PNG")

    def test_large_image_downsized(self, tmp_path):
        src = tmp_path / "big.png"
        self._make_test_image(src, 4000, 3000)
        assert src.stat().st_size > 100_000  # PNG lourd
        result = optimize_image(str(src))
        assert result is not None
        assert result.startswith("file://")
        cached = Path(result.replace("file://", ""))
        with Image.open(cached) as im:
            assert im.width <= MAX_WIDTH
            assert im.format == "JPEG"

    def test_source_absente_retourne_none(self):
        assert optimize_image(None) is None
        assert optimize_image("") is None
        assert optimize_image("/tmp/n_existe_pas.png") is None


# ---------------------------------------------------------------------------
# 4. Rendu PDF réel : nombre de pages, mot expertise, poids
# ---------------------------------------------------------------------------
class TestRenderPdf:
    def test_pdf_produit_moins_10s(self, tmp_path):
        out = tmp_path / "avis.pdf"
        started = time.perf_counter()
        render_pdf(_minimal_dossier(), out)
        elapsed = time.perf_counter() - started
        assert out.exists()
        assert elapsed < 10.0, f"rendu trop lent : {elapsed:.2f}s"
        assert out.stat().st_size < 10 * 1024 * 1024, "PDF > 10 Mo"

    def test_pdf_a_bien_un_sommaire_et_page_x_sur_y(self, tmp_path):
        out = tmp_path / "avis.pdf"
        render_pdf(_minimal_dossier(), out)
        text = ""
        for p in pypdf.PdfReader(str(out)).pages:
            text += (p.extract_text() or "") + "\n"
        # Certaines polices sont extraites glyphe par glyphe avec des null bytes
        # intercalés (« S\x00o\x00m\x00m\x00a\x00i\x00r\x00e »). On les retire
        # pour tester la présence sémantique du texte.
        clean = text.replace("\x00", "")
        assert "Sommaire" in clean
        assert re.search(r"Page\s*\d+\s*sur\s*\d+", clean), "footer Page X sur Y manquant"

    def test_regle_expertise(self, tmp_path):
        """Autorisé : couverture (« à distinguer d'une expertise immobilière »)
        + bloc mentions (« ni une expertise immobilière »).
        Interdit ailleurs — titre, sous-titre, métadonnées, énumérations, nom fichier."""
        out = tmp_path / "avis.pdf"
        render_pdf(_minimal_dossier(), out)

        reader = pypdf.PdfReader(str(out))
        # 1. Métadonnées PDF : jamais le mot
        meta = reader.metadata or {}
        title = (meta.get("/Title") or "").lower()
        assert "expertise" not in title, f"Titre PDF contient expertise: {title!r}"

        # 2. Nom de fichier : jamais le mot
        assert "expertise" not in build_filename(_minimal_dossier()).lower()

        # 3. Occurrences dans le corps : uniquement dans les 2 phrases légitimes
        full = ""
        for p in reader.pages:
            full += (p.extract_text() or "") + "\n"
        full = full.replace("\x00", "")  # cf. commentaire test_pdf_sommaire
        occurrences = [
            m.group(0) for m in re.finditer(r"(?i)[^.]*expertise[^.]*\.", full)
        ]
        # Les deux phrases légitimes du gabarit (couverture + mention 1)
        assert len(occurrences) == 2, (
            f"attendu 2 phrases exactement, trouvé {len(occurrences)} : {occurrences}"
        )
        # Chaque occurrence est bien dans une phrase où le document se distingue
        # d'une expertise, jamais où il s'y assimile
        for phrase in occurrences:
            p = phrase.lower()
            assert (
                "à distinguer d'une expertise" in p
                or "distinguer d'une expertise" in p
                or "ne constitue ni une expertise" in p
            ), f"phrase non conforme : {phrase!r}"

    def test_20_photos_moins_10_mo(self, tmp_path):
        """Un dossier avec 20 photos ne doit pas dépasser 10 Mo."""
        # Fabrique 20 images "réalistes" (bruit RGB)
        photos: list[str] = []
        for i in range(20):
            path = tmp_path / f"photo_{i:02d}.jpg"
            img = Image.effect_noise((2400, 1800), 30).convert("RGB")
            img.save(path, format="JPEG", quality=92)
            photos.append(str(path))

        d = _minimal_dossier()
        d["sections"]["dossier"]["photo_couverture"] = photos[0]
        d["sections"]["annexes"]["photos"] = photos

        out = tmp_path / "avis_20photos.pdf"
        render_pdf(d, out)
        size_mo = out.stat().st_size / 1024 / 1024
        assert size_mo < 10.0, f"PDF de {size_mo:.2f} Mo > 10 Mo"

    def test_charte_accent_ec8690(self):
        """La couleur accent #EC8690 doit apparaître dans le CSS."""
        style = (Path("/app/backend/c2/pdf/style.css")).read_text()
        assert "#EC8690" in style


# ---------------------------------------------------------------------------
# 5. Cache Géorisques / cadastre (pas d'appel réseau sur seconde génération)
# ---------------------------------------------------------------------------
class TestCacheEnrichissements:
    """Le renderer ne doit JAMAIS appeler Géorisques ni cadastre pendant la
    génération. Toutes les données du dossier viennent déjà de Mongo (pré-
    remplies par C1 + saisie utilisateur)."""

    def test_render_sans_httpx_externe(self, tmp_path, monkeypatch):
        # On stub httpx.get pour lever si appelé (sauf images en file://)
        import c2.pdf.images as imgmod
        calls: list[str] = []
        original = imgmod.httpx

        class _Blocker:
            @staticmethod
            def get(url, *a, **kw):
                calls.append(url)
                raise RuntimeError(f"httpx.get called during render: {url}")

        monkeypatch.setattr(imgmod, "httpx", _Blocker)
        out = tmp_path / "avis.pdf"
        render_pdf(_minimal_dossier(), out)
        assert out.exists()
        assert calls == [], f"appels réseau imprévus : {calls}"


# ---------------------------------------------------------------------------
# 6. Intégration HTTP : POST job → GET status → GET file
# ---------------------------------------------------------------------------
async def _seed_user_and_session(db, user_id: str) -> str:
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "user_id": user_id, "email": "pdf@test.io", "prenom": "PDF", "nom": "Test",
            "infos_pro": {"agence": "PDF Agence", "carte_t": "CPI-01-2024-000042"},
        }},
        upsert=True,
    )
    token = "test_" + secrets.token_urlsafe(16)
    await db.user_sessions.insert_one({
        "session_token": token,
        "user_id": user_id,
        "expires_at": datetime.now(timezone.utc) + timedelta(hours=1),
    })
    return token


async def _cleanup(db, user_id: str) -> None:
    await db.dossier_pdf_jobs.delete_many({"user_id": user_id})
    await db.dossiers.delete_many({"user_id": user_id})
    await db.estimations.delete_many({"user_id": user_id})
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.users.delete_one({"user_id": user_id})


@pytest.mark.asyncio
async def test_http_pdf_workflow_end_to_end():
    db = _db()
    user_id = f"u_c2_pdf_e2e_{secrets.token_hex(3)}"
    try:
        token = await _seed_user_and_session(db, user_id)
        # Crée directement un dossier en base (pas d'estimation nécessaire ici)
        dossier = _minimal_dossier()
        dossier["user_id"] = user_id
        await db.dossiers.insert_one(dict(dossier))
        dossier_id = dossier["dossier_id"]
        headers = {"Authorization": f"Bearer {token}"}

        async with httpx.AsyncClient(base_url=API, timeout=15) as client:
            # POST — lance le job
            r = await client.post(f"/api/dossiers/{dossier_id}/generer-pdf", headers=headers)
            assert r.status_code == 200
            job_id = r.json()["job_id"]

            # Poll jusqu'à `done`, cap 10 s
            done = False
            for _ in range(50):
                await asyncio.sleep(0.2)
                r = await client.get(
                    f"/api/dossiers/{dossier_id}/generer-pdf/{job_id}", headers=headers,
                )
                assert r.status_code == 200
                status = r.json()["job"]["status"]
                if status == "done":
                    done = True
                    break
                assert status in ("pending", "running"), status
            assert done, "PDF non généré sous 10 s"

            # GET fichier
            r = await client.get(f"/api/dossiers/{dossier_id}/pdf", headers=headers)
            assert r.status_code == 200
            assert r.headers["content-type"] == "application/pdf"
            assert r.content[:4] == b"%PDF"
            cd = r.headers.get("content-disposition", "")
            assert "Avis-de-valeur_" in cd
    finally:
        await _cleanup(db, user_id)


# ---------------------------------------------------------------------------
# 7. Composition — jamais un compteur à zéro (S3)
# ---------------------------------------------------------------------------
class TestDeduceComposition:
    def _cfg(self):
        return {"composition_bornes_surface": [[30, 1], [45, 2], [70, 3], [95, 4], [130, 5]]}

    def test_studio_25m2_donne_1_piece(self):
        r = deduce_composition({"comparables_figes": []}, "appartement", 25, self._cfg())
        assert r["nb_pieces"] == 1
        assert r["nb_chambres"] >= 1  # jamais 0
        assert r["nb_sdb"] == 1

    def test_50m2_donne_3_pieces(self):
        r = deduce_composition({"comparables_figes": []}, "appartement", 50, self._cfg())
        assert r["nb_pieces"] == 3
        assert r["nb_chambres"] == 2

    def test_grande_maison_150m2_donne_6_pieces_2sdb(self):
        r = deduce_composition({"comparables_figes": []}, "maison", 150, self._cfg())
        assert r["nb_pieces"] == 6
        assert r["nb_sdb"] == 2
        assert r["nb_wc"] == 2

    def test_dvf_median_prioritaire_sur_surface(self):
        estim = {"comparables_figes": [
            {"surface": 52, "type": "appartement", "nb_pieces": 2},
            {"surface": 48, "type": "appartement", "nb_pieces": 2},
            {"surface": 55, "type": "appartement", "nb_pieces": 2},
        ]}
        r = deduce_composition(estim, "appartement", 50, self._cfg())
        # DVF dit clairement 2 pièces sur ce segment, alors que la borne surface donnerait 3
        assert r["nb_pieces"] == 2
        assert r["nb_chambres"] == 1

    def test_dvf_ignore_hors_surface_20pct(self):
        estim = {"comparables_figes": [
            {"surface": 100, "type": "appartement", "nb_pieces": 5},  # hors ±20 %
        ]}
        r = deduce_composition(estim, "appartement", 50, self._cfg())
        # Retombe sur les bornes surface → 3 pièces
        assert r["nb_pieces"] == 3

    def test_jamais_zero(self):
        r = deduce_composition({}, "parking", None, self._cfg())
        assert r["nb_pieces"] >= 1
        assert r["nb_chambres"] >= 1
        assert r["nb_sdb"] >= 1
        assert r["nb_wc"] >= 1


# ---------------------------------------------------------------------------
# 8. Cancel job + auto-complet (S3)
# ---------------------------------------------------------------------------
async def _seed_dossier_ready(db, user_id: str) -> dict:
    from c2.routes import _completude
    d = _minimal_dossier()
    d["user_id"] = user_id
    await db.dossiers.insert_one(dict(d))
    return d


@pytest.mark.asyncio
async def test_cancel_pdf_job():
    db = _db()
    user_id = f"u_c2_cancel_{secrets.token_hex(3)}"
    try:
        token = await _seed_user_and_session(db, user_id)
        d = _minimal_dossier()
        d["user_id"] = user_id
        await db.dossiers.insert_one(dict(d))
        headers = {"Authorization": f"Bearer {token}"}
        async with httpx.AsyncClient(base_url=API, timeout=10) as client:
            # POST job
            r = await client.post(f"/api/dossiers/{d['dossier_id']}/generer-pdf", headers=headers)
            job_id = r.json()["job_id"]
            # DELETE cancel — attrape avant/pendant le rendu
            r = await client.delete(f"/api/dossiers/{d['dossier_id']}/generer-pdf/{job_id}", headers=headers)
            # Selon la vitesse du rendu, soit 200 (annulé), soit 409 (déjà done)
            assert r.status_code in (200, 409)
            if r.status_code == 200:
                # Vérif statut effectif après annulation
                r = await client.get(f"/api/dossiers/{d['dossier_id']}/generer-pdf/{job_id}", headers=headers)
                assert r.json()["job"]["status"] == "cancelled"
    finally:
        await _cleanup(db, user_id)


@pytest.mark.asyncio
async def test_patch_bascule_en_complet_quand_5_blocages_leves():
    """Un dossier brouillon dont les 5 blocages sont satisfaits doit passer
    automatiquement en `complet` sur le prochain PATCH."""
    db = _db()
    user_id = f"u_c2_auto_{secrets.token_hex(3)}"
    try:
        token = await _seed_user_and_session(db, user_id)
        # Seed dossier brouillon avec tous les blocages levés SAUF le nom demandeur
        d = _minimal_dossier()
        d["user_id"] = user_id
        d["statut"] = "brouillon"
        # Rédacteur : renseigne les 9 champs bloquants
        d["sections"]["redacteur"] = {
            "agent_nom": "T. Test", "agent_email": "t@t.io", "agent_tel": "+33 6",
            "agence_nom": "A", "agence_siren": "123456789", "carte_pro": "CPI",
            "carte_pro_cci": "Paris", "rcp_assureur": "MMA", "rcp_police": "42",
        }
        # Adresse OK, surface OK, photo OK
        d["sections"]["identification"]["adresse"] = "12 rue X"
        d["sections"]["surfaces"]["surface_habitable"] = 50
        d["sections"]["dossier"]["photo_couverture"] = "https://example.com/x.jpg"
        # Manque : demandeur_nom (mission)
        d["sections"]["mission"]["demandeur_nom"] = ""
        await db.dossiers.insert_one(dict(d))
        headers = {"Authorization": f"Bearer {token}"}
        async with httpx.AsyncClient(base_url=API, timeout=5) as client:
            # 1er PATCH : les 5 blocages ne sont pas encore levés → reste brouillon
            r = await client.patch(
                f"/api/dossiers/{d['dossier_id']}",
                json={"sections": {"identification": {"adresse": "12 rue X", "code_postal": "75017"}}},
                headers=headers,
            )
            assert r.status_code == 200
            assert r.json()["dossier"]["statut"] == "brouillon"
            assert r.json()["completude"]["pret_export"] is False

            # 2ème PATCH : renseigne le demandeur → bascule en complet
            r = await client.patch(
                f"/api/dossiers/{d['dossier_id']}",
                json={"sections": {"mission": {"demandeur_nom": "M. Test", "objet": "mise en vente"}}},
                headers=headers,
            )
            assert r.status_code == 200
            assert r.json()["dossier"]["statut"] == "complet"
            assert r.json()["completude"]["pret_export"] is True
    finally:
        await _cleanup(db, user_id)


@pytest.mark.asyncio
async def test_completude_expose_redacteur_manquants():
    db = _db()
    user_id = f"u_c2_comp_{secrets.token_hex(3)}"
    try:
        token = await _seed_user_and_session(db, user_id)
        d = _minimal_dossier()
        d["user_id"] = user_id
        # redacteur : 2 champs seulement, il en manque 7
        d["sections"]["redacteur"] = {"agent_nom": "T", "agent_email": "t@t.io"}
        await db.dossiers.insert_one(dict(d))
        headers = {"Authorization": f"Bearer {token}"}
        async with httpx.AsyncClient(base_url=API, timeout=5) as client:
            r = await client.get(f"/api/dossiers/{d['dossier_id']}", headers=headers)
            assert r.status_code == 200
            comp = r.json()["completude"]
            assert comp["blocages"]["redacteur"] is False
            assert len(comp["redacteur_manquants"]) == 7  # 9 total - 2 remplis
            assert "carte_pro" in comp["redacteur_manquants"]
    finally:
        await _cleanup(db, user_id)


@pytest.mark.asyncio
async def test_http_pdf_401_sans_auth():
    async with httpx.AsyncClient(base_url=API, timeout=5) as client:
        r = await client.post("/api/dossiers/x/generer-pdf")
        assert r.status_code == 401
        r = await client.get("/api/dossiers/x/pdf")
        assert r.status_code == 401


@pytest.mark.asyncio
async def test_http_pdf_pas_encore_genere():
    db = _db()
    user_id = f"u_c2_pdf_nope_{secrets.token_hex(3)}"
    try:
        token = await _seed_user_and_session(db, user_id)
        d = _minimal_dossier()
        d["user_id"] = user_id
        await db.dossiers.insert_one(dict(d))
        headers = {"Authorization": f"Bearer {token}"}
        async with httpx.AsyncClient(base_url=API, timeout=5) as client:
            r = await client.get(f"/api/dossiers/{d['dossier_id']}/pdf", headers=headers)
            assert r.status_code == 404
            assert "pdf_pas_encore_genere" in r.text
    finally:
        await _cleanup(db, user_id)


# ---------------------------------------------------------------------------
# 9. Corrections après relecture — 6 fixes
# ---------------------------------------------------------------------------
class TestCorrectionsRelecture:
    """CRITIQUE — prix_m2 = valeur_venale / base_declaree, à 1 € près.
    Base = pondérée si disponible, sinon habitable. Nommée dans le doc."""

    def _dossier_avec_valeurs(self, valeur=870_000, surf_hab=72, surf_pond=74.5):
        d = _minimal_dossier()
        d["sections"]["surfaces"]["surface_habitable"] = surf_hab
        d["sections"]["surfaces"]["surface_ponderee_totale"] = surf_pond
        d["sections"]["conclusion"]["valeur_venale"] = valeur
        return d

    def test_prix_m2_calcule_sur_ponderee_quand_disponible(self):
        from c2.pdf.renderer import build_context
        ctx = build_context(self._dossier_avec_valeurs(870_000, 72, 74.5))
        # 870000 / 74.5 = 11678
        assert "pondérée" in ctx["base_prix_m2_label"]
        # Le prix m² affiché correspond bien à la base annoncée, à 1 € près
        prix_str = ctx["prix_m2_retenu_fr"]
        # Extrait le nombre : « 11 678 € » -> 11678
        digits = int("".join(c for c in prix_str if c.isdigit()))
        expected = round(870_000 / 74.5)
        assert abs(digits - expected) <= 1, (
            f"prix_m2 affiché {digits} != valeur/base {expected}"
        )

    def test_prix_m2_calcule_sur_habitable_si_pas_de_ponderee(self):
        from c2.pdf.renderer import build_context
        d = self._dossier_avec_valeurs(500_000, 50, None)
        d["sections"]["surfaces"].pop("surface_ponderee_totale", None)
        ctx = build_context(d)
        assert "habitable" in ctx["base_prix_m2_label"]
        digits = int("".join(c for c in ctx["prix_m2_retenu_fr"] if c.isdigit()))
        assert abs(digits - 10_000) <= 1  # 500000/50

    def test_prix_m2_visible_dans_pdf(self, tmp_path):
        d = self._dossier_avec_valeurs(870_000, 72, 74.5)
        out = tmp_path / "avis.pdf"
        render_pdf(d, out)
        text = ""
        for p in pypdf.PdfReader(str(out)).pages:
            text += (p.extract_text() or "") + "\n"
        clean = text.replace("\x00", "")
        # Le PDF contient bien 11 678 (avec espace fine unicode ou espace normale)
        # ET le libellé "surface pondérée"
        clean_no_space = clean.replace("\u202f", "").replace("\u00a0", "").replace(" ", "")
        assert "11678" in clean_no_space, "prix_m2 recalculé absent"
        assert "surface pondérée" in clean or "surface pond" in clean

    def test_origine_surface_est_phrase_grammaticale(self, tmp_path):
        d = _minimal_dossier()
        d["sections"]["surfaces"]["origine_surface"] = "declaratif_proprietaire"
        out = tmp_path / "avis.pdf"
        render_pdf(d, out)
        text = ""
        for p in pypdf.PdfReader(str(out)).pages:
            text += (p.extract_text() or "") + "\n"
        clean = text.replace("\x00", "")
        # La phrase brute enum ne doit JAMAIS apparaître
        assert "declaratif_proprietaire" not in clean
        # Une phrase grammaticalement correcte doit apparaître
        assert "déclarées par le propriétaire" in clean

    def test_exposition_jamais_initiale_seule(self, tmp_path):
        d = _minimal_dossier()
        d["sections"]["composition"]["exposition_principale"] = "S"
        out = tmp_path / "avis.pdf"
        render_pdf(d, out)
        from c2.pdf.renderer import build_context
        ctx = build_context(d)
        assert ctx["exposition_principale"] == "Sud"

    def test_stock_concurrent_renomme(self, tmp_path):
        d = _minimal_dossier()
        d["sections"]["marche"]["stock_concurrent"] = 14
        out = tmp_path / "avis.pdf"
        render_pdf(d, out)
        text = ""
        for p in pypdf.PdfReader(str(out)).pages:
            text += (p.extract_text() or "") + "\n"
        clean = text.replace("\x00", "").lower()
        assert "stock concurrent" in clean
        # Anciennement « Concurrence — 14 biens comparables »
        assert "biens comparables" not in clean

    def test_mandataire_mention_habilitation(self, tmp_path):
        d = _minimal_dossier()
        d["sections"]["redacteur"] = {
            "statut_carte": "mandataire",
            "agent_nom": "T. Test",
            "agence_nom": "T. Test Immo",
            "reseau_nom": "IAD France",
            "reseau_carte_t": "T-13-2020-000123",
            "reseau_cci": "CCI d'Aix-Marseille-Provence",
            "attestation_num": "ATT-2025-4567",
            "rcp_assureur": "MMA",
            "rcp_police": "PL-42",
        }
        out = tmp_path / "avis.pdf"
        render_pdf(d, out)
        text = ""
        for p in pypdf.PdfReader(str(out)).pages:
            text += (p.extract_text() or "") + "\n"
        clean = text.replace("\x00", "")
        assert "Agent commercial habilité par IAD France" in clean
        assert "T-13-2020-000123" in clean
        assert "ATT-2025-4567" in clean

    def test_comparables_mention_autres_retenus(self, tmp_path):
        d = _minimal_dossier()
        # 10 comparables → tableau affiche 8, mention "et 2 autres retenus"
        d["sections"]["comparables"]["comparables"] = [
            {"nature": "vente actée", "adresse": f"Adresse {i}", "surface": 70,
             "prix": 800000 + i * 1000, "prix_m2": 11429 + i, "prix_m2_corrige": 11429 + i}
            for i in range(10)
        ]
        d["sections"]["methode"] = {"methodes_retenues": ["comparaison"], "justification_methode": "Méthode par comparaison."}
        out = tmp_path / "avis.pdf"
        render_pdf(d, out)
        text = ""
        for p in pypdf.PdfReader(str(out)).pages:
            text += (p.extract_text() or "") + "\n"
        clean = text.replace("\x00", "")
        assert "et 2 autres retenus dans le calcul" in clean
        # Total retenus mentionné dans la note méthode
        assert "10 références entrent dans le calcul" in clean


# ---------------------------------------------------------------------------
# 10. Motif d'ajustement obligatoire au-delà du seuil (config)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_patch_refuse_ajustement_sans_motif_au_dela_du_seuil():
    """Écart > 10 % : PATCH échoue avec 422 tant que motif vide."""
    db = _db()
    user_id = f"u_c2_adj_{secrets.token_hex(3)}"
    try:
        token = await _seed_user_and_session(db, user_id)
        d = _minimal_dossier()
        d["user_id"] = user_id
        # Prix m² moyen corrigé = 10 000 €, surface pondérée = 50 m² → référence 500 000 €
        # Valeur retenue = 600 000 → écart = +20 % > seuil 10 %
        d["sections"]["surfaces"]["surface_ponderee_totale"] = 50
        d["sections"]["comparables"] = {"prix_m2_moyen_corrige": 10000, "comparables": []}
        d["sections"]["conclusion"]["valeur_venale"] = 600000
        await db.dossiers.insert_one(dict(d))
        headers = {"Authorization": f"Bearer {token}"}
        async with httpx.AsyncClient(base_url=API, timeout=5) as client:
            # PATCH sans motif → 422
            r = await client.patch(
                f"/api/dossiers/{d['dossier_id']}",
                json={"sections": {"ajustements": {"motif": ""}}},
                headers=headers,
            )
            assert r.status_code == 422
            body = r.json()
            assert body["detail"]["code"] == "motif_ajustement_obligatoire"
            assert abs(body["detail"]["ecart"] - 0.20) < 0.001
            # PATCH avec motif → OK
            r = await client.patch(
                f"/api/dossiers/{d['dossier_id']}",
                json={"sections": {"ajustements": {"motif": "hausse justifiée par la vue exceptionnelle"}}},
                headers=headers,
            )
            assert r.status_code == 200
            # L'écart est exposé dans la réponse
            assert "ajustement" in r.json()
            assert abs(r.json()["ajustement"]["ecart"] - 0.20) < 0.001
    finally:
        await _cleanup(db, user_id)


@pytest.mark.asyncio
async def test_patch_accepte_sans_motif_si_ecart_sous_seuil():
    db = _db()
    user_id = f"u_c2_adj_ok_{secrets.token_hex(3)}"
    try:
        token = await _seed_user_and_session(db, user_id)
        d = _minimal_dossier()
        d["user_id"] = user_id
        d["sections"]["surfaces"]["surface_ponderee_totale"] = 50
        d["sections"]["comparables"] = {"prix_m2_moyen_corrige": 10000, "comparables": []}
        d["sections"]["conclusion"]["valeur_venale"] = 520000  # +4 %
        await db.dossiers.insert_one(dict(d))
        headers = {"Authorization": f"Bearer {token}"}
        async with httpx.AsyncClient(base_url=API, timeout=5) as client:
            r = await client.patch(
                f"/api/dossiers/{d['dossier_id']}",
                json={"sections": {"ajustements": {"motif": ""}}},
                headers=headers,
            )
            assert r.status_code == 200
    finally:
        await _cleanup(db, user_id)
