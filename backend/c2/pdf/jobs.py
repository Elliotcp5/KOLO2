"""C2 PDF — gestionnaire de jobs asynchrones.

Structure Mongo `dossier_pdf_jobs` :
  {job_id, dossier_id, user_id, status: pending|running|done|error|cancelled,
   progress: 0..100, file_path, filename, size_bytes, duration_ms, error,
   created_at, done_at}

Un seul job en cours par dossier ; les jobs `done` sont conservés (le fichier
disque aussi) pour permettre `GET /api/dossiers/{id}/pdf`.
"""
from __future__ import annotations

import asyncio
import logging
import secrets
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .renderer import build_filename, render_pdf

logger = logging.getLogger("c2.pdf.jobs")

PDF_DIR = Path("/tmp/kolo_pdfs")
PDF_DIR.mkdir(parents=True, exist_ok=True)


def new_job_id() -> str:
    return f"pdfjob_{secrets.token_urlsafe(9)}"


def _pdf_path(dossier_id: str, job_id: str) -> Path:
    d = PDF_DIR / dossier_id
    d.mkdir(parents=True, exist_ok=True)
    return d / f"{job_id}.pdf"


async def _run_render(db, dossier_doc: dict[str, Any], job_id: str) -> None:
    dossier_id = dossier_doc["dossier_id"]
    started = time.perf_counter()
    try:
        # Vérif d'annulation avant de démarrer WeasyPrint
        current = await db.dossier_pdf_jobs.find_one({"job_id": job_id}, {"status": 1})
        if (current or {}).get("status") == "cancelled":
            return
        await db.dossier_pdf_jobs.update_one(
            {"job_id": job_id, "status": {"$ne": "cancelled"}},
            {"$set": {"status": "running", "progress": 10}},
        )
        out_path = _pdf_path(dossier_id, job_id)
        filename = build_filename(dossier_doc)

        # WeasyPrint est bloquant. On délègue au thread pool pour ne pas
        # geler la loop asyncio (autres requêtes continuent à répondre).
        await asyncio.to_thread(render_pdf, dossier_doc, out_path)

        # Second point d'annulation : si l'utilisateur a annulé pendant le
        # rendu, on supprime le fichier et on n'écrit pas `done`.
        current = await db.dossier_pdf_jobs.find_one({"job_id": job_id}, {"status": 1})
        if (current or {}).get("status") == "cancelled":
            try:
                out_path.unlink(missing_ok=True)
            except Exception:
                pass
            return

        size = out_path.stat().st_size
        duration_ms = int((time.perf_counter() - started) * 1000)
        await db.dossier_pdf_jobs.update_one(
            {"job_id": job_id, "status": {"$ne": "cancelled"}},
            {"$set": {
                "status": "done",
                "progress": 100,
                "file_path": str(out_path),
                "filename": filename,
                "size_bytes": size,
                "duration_ms": duration_ms,
                "done_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        logger.info(
            f"[c2.pdf] job {job_id} done in {duration_ms}ms, {size} B, "
            f"dossier={dossier_id}"
        )
    except Exception as e:
        logger.exception(f"[c2.pdf] job {job_id} failed: {e}")
        await db.dossier_pdf_jobs.update_one(
            {"job_id": job_id, "status": {"$ne": "cancelled"}},
            {"$set": {
                "status": "error",
                "error": str(e),
                "done_at": datetime.now(timezone.utc).isoformat(),
            }},
        )


async def cancel_job(db, job_id: str, user_id: str) -> bool:
    """Marque un job comme `cancelled`. Le thread WeasyPrint en cours ira
    jusqu'au bout mais son fichier sera supprimé et le statut restera figé
    sur `cancelled`. Retourne True si un job a été annulé."""
    res = await db.dossier_pdf_jobs.update_one(
        {"job_id": job_id, "user_id": user_id, "status": {"$in": ["pending", "running"]}},
        {"$set": {"status": "cancelled", "done_at": datetime.now(timezone.utc).isoformat()}},
    )
    return res.modified_count > 0


async def enqueue(db, dossier_doc: dict[str, Any]) -> str:
    """Crée un job et lance le rendu en tâche de fond. Retourne le job_id."""
    job_id = new_job_id()
    await db.dossier_pdf_jobs.insert_one({
        "job_id": job_id,
        "dossier_id": dossier_doc["dossier_id"],
        "user_id": dossier_doc["user_id"],
        "status": "pending",
        "progress": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    asyncio.create_task(_run_render(db, dossier_doc, job_id))
    return job_id


async def latest_done_job(db, dossier_id: str, user_id: str) -> dict[str, Any] | None:
    doc = await db.dossier_pdf_jobs.find_one(
        {"dossier_id": dossier_id, "user_id": user_id, "status": "done"},
        sort=[("done_at", -1)],
    )
    return doc
