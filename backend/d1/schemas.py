"""Schémas Pydantic — module D1."""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


# ---------------------------------------------------------------------------
# Invitations
# ---------------------------------------------------------------------------
class InvitationCreate(BaseModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def _lower(cls, v: str) -> str:
        return v.strip().lower()


class InvitationOut(BaseModel):
    id: str
    email: str
    statut: str  # envoyee | acceptee | expiree | annulee
    date_envoi: str
    date_expiration: str


# ---------------------------------------------------------------------------
# Organisation (lecture + patch limité)
# ---------------------------------------------------------------------------
class OrganisationPatch(BaseModel):
    nom: Optional[str] = None
    adresse: Optional[str] = None
    telephone: Optional[str] = None
    mode_repartition: Optional[str] = None  # manuel | auto | mixte
    directeur_prospecte: Optional[bool] = None
    zones: Optional[list[str]] = None

    @field_validator("mode_repartition")
    @classmethod
    def _mode(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip().lower()
        if v not in {"manuel", "auto", "mixte"}:
            raise ValueError("mode_repartition_invalide")
        return v

    @field_validator("zones")
    @classmethod
    def _zones(cls, v: Optional[list[str]]) -> Optional[list[str]]:
        if v is None:
            return None
        out: list[str] = []
        for z in v:
            z = (z or "").strip()
            if len(z) != 5 or not z.isdigit():
                raise ValueError(f"cp_invalide:{z}")
            out.append(z)
        return out


# ---------------------------------------------------------------------------
# Attribution
# ---------------------------------------------------------------------------
class AttribuerPayload(BaseModel):
    user_id: str = Field(min_length=1)


class AttribuerLotPayload(BaseModel):
    opportunite_ids: list[str] = Field(min_length=1)
    user_id: str = Field(min_length=1)
