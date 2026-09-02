"""C2 PDF — utilitaires images.

Redimensionne et recompresse silencieusement les photos avant intégration :
1600 px de large maximum, JPEG qualité 80. Aucune UI, aucun message.

Accepte : bytes, chemin local, ou URL http(s). Renvoie toujours un chemin
`file:///` que WeasyPrint peut lire sans latence réseau.
"""
from __future__ import annotations

import hashlib
import io
import logging
import os
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

import httpx
from PIL import Image, ImageOps

logger = logging.getLogger("c2.pdf.images")

MAX_WIDTH = 1600
JPEG_QUALITY = 80
CACHE_DIR = Path("/tmp/kolo_pdf_images")
CACHE_DIR.mkdir(parents=True, exist_ok=True)


def _cache_key(source: str) -> Path:
    h = hashlib.sha1(source.encode("utf-8")).hexdigest()[:16]
    return CACHE_DIR / f"{h}.jpg"


def _compress_bytes_to_jpeg(data: bytes, out_path: Path) -> Path:
    with Image.open(io.BytesIO(data)) as im:
        im = ImageOps.exif_transpose(im)
        if im.mode not in ("RGB", "L"):
            im = im.convert("RGB")
        if im.width > MAX_WIDTH:
            ratio = MAX_WIDTH / float(im.width)
            new_size = (MAX_WIDTH, int(im.height * ratio))
            im = im.resize(new_size, Image.LANCZOS)
        im.save(out_path, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    return out_path


def optimize_image(source: Optional[str]) -> Optional[str]:
    """Retourne un `file://` prêt pour WeasyPrint, ou None si source invalide.

    - `None`/vide → None (le template affiche un placeholder).
    - Chemin local : compressé s'il dépasse 1600 px.
    - URL http(s) : téléchargé (timeout 4 s), compressé, mis en cache disque.
    """
    if not source:
        return None
    try:
        cache = _cache_key(source)
        if cache.exists():
            return f"file://{cache}"

        parsed = urlparse(source)
        if parsed.scheme in ("http", "https"):
            try:
                r = httpx.get(source, timeout=4.0, follow_redirects=True)
                r.raise_for_status()
                data = r.content
            except Exception as e:
                logger.info(f"image download failed ({source}): {e}")
                return None
        elif parsed.scheme in ("", "file"):
            path = parsed.path if parsed.scheme == "file" else source
            if not os.path.exists(path):
                return None
            with open(path, "rb") as fh:
                data = fh.read()
        else:
            return None

        _compress_bytes_to_jpeg(data, cache)
        return f"file://{cache}"
    except Exception as e:
        logger.warning(f"optimize_image({source}) failed: {e}")
        return None


def optimize_many(sources: list[str] | None) -> list[str]:
    if not sources:
        return []
    out: list[str] = []
    for s in sources:
        p = optimize_image(s)
        if p:
            out.append(p)
    return out
