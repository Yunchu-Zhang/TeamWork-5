from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
import re
from uuid import uuid4

from fastapi import UploadFile
from PIL import Image


SAFE_NAME = re.compile(r"[^A-Za-z0-9_.-]+")


@dataclass(frozen=True)
class RuntimePaths:
    root: Path
    uploads: Path
    masks: Path
    pngs: Path
    models: Path

    @classmethod
    def from_root(cls, root: Path | str) -> "RuntimePaths":
        resolved = Path(root)
        return cls(
            root=resolved,
            uploads=resolved / "uploads",
            masks=resolved / "masks",
            pngs=resolved / "pngs",
            models=resolved / "models",
        )

    def ensure(self) -> None:
        for folder in (self.uploads, self.masks, self.pngs, self.models):
            folder.mkdir(parents=True, exist_ok=True)


@dataclass(frozen=True)
class LoadedImage:
    image: Image.Image
    path: Path
    stem: str


def make_safe_stem(filename: str | None) -> str:
    original = Path(filename or "upload").stem or "upload"
    safe = SAFE_NAME.sub("_", original).strip("._-") or "upload"
    return f"{safe}_{uuid4().hex[:10]}"


def image_suffix(filename: str | None, image: Image.Image) -> str:
    suffix = Path(filename or "").suffix.lower()
    if suffix in {".jpg", ".jpeg", ".png", ".webp", ".bmp"}:
        return suffix
    return ".jpg" if image.format == "JPEG" else ".png"


async def save_upload_image(upload: UploadFile, upload_dir: Path) -> LoadedImage:
    raw = await upload.read()
    if not raw:
        raise ValueError("Uploaded image is empty")

    image = Image.open(BytesIO(raw)).convert("RGB")
    stem = make_safe_stem(upload.filename)
    path = upload_dir / f"{stem}{image_suffix(upload.filename, image)}"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(raw)
    return LoadedImage(image=image, path=path, stem=stem)
