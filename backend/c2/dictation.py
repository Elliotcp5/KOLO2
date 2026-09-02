"""C2 — Dictée vocale. `POST /api/dossiers/{id}/dictee/{section_id}`.

Flux : audio (mp3/m4a/webm/wav) → Whisper (fr forcé) → transcription brute
+ extraction Claude Sonnet 5 en JSON → renvoi au client (validation manuelle
avant écriture). L'audio est supprimé de la mémoire dès la transcription.

Bornes : 10 Mo, 3 minutes. Idempotence via `client_key` query param.
`transcription_brute` empilée par section, jamais écrasée.
"""
from __future__ import annotations
import io, json, logging, os, subprocess, tempfile
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, Query, Request, UploadFile
from emergentintegrations.llm.openai import OpenAISpeechToText
from emergentintegrations.llm.chat import LlmChat, UserMessage

logger = logging.getLogger("c2.dictation")
router = APIRouter(tags=["c2-dictation"])

EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
MAX_BYTES = 10 * 1024 * 1024
MAX_SECONDS = 180

# Sections dictables (choix (b) : lecture terrain physique)
DICTABLE_SECTIONS: dict[str, dict[str, Any]] = {
    "composition": {
        "fields": [
            {"id": "nb_pieces", "label": "Nombre de pièces", "type": "int"},
            {"id": "nb_chambres", "label": "Chambres", "type": "int"},
            {"id": "nb_sdb", "label": "Salles d'eau", "type": "int"},
            {"id": "nb_wc", "label": "WC", "type": "int"},
            {"id": "etage", "label": "Étage", "type": "int"},
            {"id": "exposition_principale", "label": "Exposition", "type": "str"},
            {"id": "vue", "label": "Vue", "type": "str"},
        ],
    },
    "technique": {
        "fields": [
            {"id": "etat_general", "label": "État général", "type": "str"},
            {"id": "travaux_recents", "label": "Travaux récents", "type": "str"},
            {"id": "travaux_a_prevoir", "label": "Travaux à prévoir", "type": "str"},
            {"id": "type_chauffage", "label": "Type de chauffage", "type": "str"},
        ],
    },
    "environnement": {
        "fields": [
            {"id": "commerces", "label": "Commerces à proximité", "type": "str"},
            {"id": "transports", "label": "Transports", "type": "str"},
            {"id": "ecoles", "label": "Écoles", "type": "str"},
            {"id": "nuisances", "label": "Nuisances observées", "type": "str"},
        ],
    },
    "swot": {
        "fields": [
            {"id": "atouts", "label": "Points forts", "type": "list"},
            {"id": "faiblesses", "label": "Points de vigilance", "type": "list"},
        ],
    },
}


def _db():
    from server import db
    return db


async def _current_user_doc(request):
    from server import get_user_from_session
    u = await get_user_from_session(request)
    if not u:
        raise HTTPException(401, "Not authenticated")
    doc = await _db().users.find_one({"user_id": u.user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(401, "User not found")
    return doc


def _audio_duration_seconds(path: str) -> float | None:
    """Estimation de la durée via ffprobe. None si outil indisponible."""
    try:
        r = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", path],
            capture_output=True, text=True, timeout=5,
        )
        return float((r.stdout or "").strip())
    except Exception:
        return None


async def _extract_json(transcript: str, section_id: str) -> dict[str, Any]:
    """Claude Sonnet 5 → JSON strict des champs proposés pour la section."""
    spec = DICTABLE_SECTIONS[section_id]
    fields_desc = "\n".join(
        f"- {f['id']} ({f['type']}) : {f['label']}" for f in spec["fields"]
    )
    system = (
        "Vous extrayez des données structurées d'une dictée d'un professionnel "
        "de l'immobilier français. Répondez uniquement en JSON valide, sans "
        "texte autour. Vouvoiement. Si un champ n'est pas mentionné, ne le "
        "renvoyez pas — n'inventez jamais."
    )
    user = (
        f"Transcription :\n« {transcript} »\n\n"
        f"Champs disponibles pour la section {section_id} :\n{fields_desc}\n\n"
        "Rendez un objet JSON dont les clés sont les identifiants de champ et "
        "les valeurs sont ce que le professionnel a dit. Types : int → nombre "
        "entier, str → texte court, list → liste de chaînes."
    )
    chat = (LlmChat(api_key=EMERGENT_KEY, session_id=f"dictee-{section_id}",
                    system_message=system)
            .with_model("anthropic", "claude-sonnet-5"))
    try:
        raw = (await chat.send_message(UserMessage(text=user))) or ""
    except Exception as e:
        logger.warning(f"LLM call failed: {e}")
        return {}
    raw = raw.strip()
    # Tolérance : parfois entouré de ```json
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:].strip()
    try:
        return json.loads(raw)
    except Exception as e:
        logger.warning(f"JSON parse failed: {e} / raw={raw[:200]}")
        return {}


@router.post("/api/dossiers/{dossier_id}/dictee/{section_id}")
async def post_dictee(
    dossier_id: str,
    section_id: str,
    request: Request,
    file: UploadFile = File(...),
    client_key: str = Form(...),
):
    if section_id not in DICTABLE_SECTIONS:
        raise HTTPException(400, "section_non_dictable")
    user = await _current_user_doc(request)
    db = _db()
    dos = await db.dossiers.find_one(
        {"dossier_id": dossier_id, "user_id": user["user_id"]}, {"_id": 0},
    )
    if not dos:
        raise HTTPException(404, "dossier_introuvable")

    # Idempotence : un client_key = un traitement, on renvoie le résultat mémorisé.
    existing = await db.dictee_jobs.find_one(
        {"user_id": user["user_id"], "client_key": client_key},
        {"_id": 0, "result": 1},
    )
    if existing and existing.get("result"):
        return existing["result"]

    raw = await file.read()
    if len(raw) > MAX_BYTES:
        raise HTTPException(413, "audio_trop_lourd")

    # Écrit dans un tmp file → ffprobe pour la durée → Whisper
    suffix = os.path.splitext(file.filename or "")[1].lower() or ".m4a"
    if suffix not in (".mp3", ".mp4", ".m4a", ".mpeg", ".mpga", ".wav", ".webm"):
        suffix = ".m4a"
    fd, path = tempfile.mkstemp(suffix=suffix, prefix="kolo_dictee_")
    try:
        with os.fdopen(fd, "wb") as fh:
            fh.write(raw)
        dur = _audio_duration_seconds(path)
        if dur is not None and dur > MAX_SECONDS:
            raise HTTPException(413, "audio_trop_long")

        # Whisper — français forcé, temperature 0 pour déterminisme
        stt = OpenAISpeechToText(api_key=EMERGENT_KEY)
        with open(path, "rb") as af:
            resp = await stt.transcribe(
                file=af, model="whisper-1", response_format="json",
                language="fr", temperature=0.0,
            )
        transcript = (getattr(resp, "text", "") or "").strip()
    finally:
        # SUPPRESSION IMMÉDIATE — l'audio n'est jamais persisté
        try: os.unlink(path)
        except Exception: pass
        del raw

    if not transcript:
        raise HTTPException(422, "transcription_vide")

    # Extraction JSON — best-effort
    try:
        proposals_raw = await _extract_json(transcript, section_id)
    except Exception as e:
        logger.exception(f"extraction failed: {e}")
        proposals_raw = {}

    # Reformate en propositions ordonnées pour le front
    proposals = []
    for f in DICTABLE_SECTIONS[section_id]["fields"]:
        if f["id"] in proposals_raw:
            proposals.append({
                "field_id": f["id"], "label": f["label"], "type": f["type"],
                "value_proposed": proposals_raw[f["id"]],
            })

    result = {
        "ok": True,
        "transcription": transcript,
        "proposals": proposals,
        "section_id": section_id,
    }
    now = datetime.now(timezone.utc).isoformat()
    await db.dictee_jobs.insert_one({
        "user_id": user["user_id"], "dossier_id": dossier_id,
        "section_id": section_id, "client_key": client_key,
        "result": result, "created_at": now,
    })
    # Empile la transcription brute dans la section (jamais écraser)
    sections = dos.get("sections") or {}
    sec = sections.get(section_id) or {}
    hist = sec.get("transcriptions") or []
    hist.append({"at": now, "text": transcript})
    sec["transcriptions"] = hist
    sections[section_id] = sec
    await db.dossiers.update_one(
        {"dossier_id": dossier_id, "user_id": user["user_id"]},
        {"$set": {"sections": sections, "date_maj": now}},
    )
    return result
