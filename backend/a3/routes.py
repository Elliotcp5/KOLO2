"""KOLO A3 — Routes admin.

- `POST /api/jobs/extraire-rues`          (body: {code_postal?})
- `POST /api/jobs/generer-opportunites`   (body: {code_postal?})
- `GET  /api/admin/rapprochements`        (query: cp, date, decision)

Auth : `X-Admin-Secret` (renouvelé en début de Session A3).
"""
from __future__ import annotations

import os
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from a3.job_extract_rues import run_extraire_rues
from a3.job_generer_opportunites import run_generer_opportunites

router = APIRouter(tags=["a3"])


def _check_admin(request: Request) -> None:
    provided = (request.headers.get("x-admin-secret") or "").strip()
    expected = (os.environ.get("ADMIN_SECRET") or "").strip()
    if not expected or provided != expected:
        raise HTTPException(status_code=403, detail="Admin access required")


def _get_db():
    from server import db  # type: ignore
    return db


class CPPayload(BaseModel):
    code_postal: Optional[str] = None


@router.post("/api/jobs/extraire-rues")
async def extraire_rues(payload: CPPayload, request: Request):
    _check_admin(request)
    return await run_extraire_rues(_get_db(), code_postal=payload.code_postal)


@router.post("/api/jobs/generer-opportunites")
async def generer_opportunites(payload: CPPayload, request: Request):
    _check_admin(request)
    return await run_generer_opportunites(_get_db(), code_postal=payload.code_postal)


@router.get("/api/admin/rapprochements")
async def list_rapprochements(
    request: Request,
    cp: Optional[str] = Query(None),
    date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    decision: Optional[str] = Query(None, description="opportunite|deja_en_vente|location_recente|filtre"),
    limit: int = Query(200, ge=1, le=2000),
):
    _check_admin(request)
    db = _get_db()
    q: dict = {}
    if cp:
        q["code_postal"] = cp
    if decision:
        q["decision"] = decision
    if date:
        # Filtre sur la date_traitement (préfixe ISO)
        q["date_traitement"] = {"$regex": f"^{date}"}
    docs = [d async for d in db.rapprochements.find(q).sort("date_traitement", -1).limit(limit)]
    for d in docs:
        d["_id"] = str(d.get("_id"))
    return {"count": len(docs), "items": docs}
