from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Protocol
from urllib.parse import unquote, urlparse

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from PIL import Image, UnidentifiedImageError

from backend.services.files import RuntimePaths, save_existing_image, save_upload_image
from backend.services.langsam_adapter import LangSAMAdapter
from backend.services.masks import NoMaskFound, export_mask_assets
from backend.services.sam2_adapter import SAM2PointAdapter


PROJECT_ROOT = Path(__file__).resolve().parents[1]
FRONTEND_ROOT = PROJECT_ROOT / "frontend"
SCENE_IMAGE_ROOT = FRONTEND_ROOT / "assets" / "test-scenes"
DEFAULT_RUNTIME_ROOT = Path(__file__).resolve().parent / "runtime"
DEFAULT_LANGSAM_SOURCE = next(
    (path for path in PROJECT_ROOT.glob("*lang-segment-anything-main") if path.is_dir()),
    PROJECT_ROOT / "lang-segment-anything-main",
)


class PointAdapter(Protocol):
    def segment(self, image: Image.Image, x: int, y: int, point_label: int):
        """Return a boolean mask for a point prompt."""


class LangAdapter(Protocol):
    def segment(self, image: Image.Image, prompt: str):
        """Return a boolean mask for a text prompt."""


@dataclass(frozen=True)
class AdapterBundle:
    point: PointAdapter
    lang: LangAdapter


def create_default_adapters(paths: RuntimePaths) -> AdapterBundle:
    return AdapterBundle(
        point=SAM2PointAdapter(model_cache_dir=paths.models),
        lang=LangSAMAdapter(model_cache_dir=paths.models, source_dir=DEFAULT_LANGSAM_SOURCE),
    )


def create_app(
    point_adapter: PointAdapter | None = None,
    lang_adapter: LangAdapter | None = None,
    runtime_root: Path | str | None = None,
) -> FastAPI:
    paths = RuntimePaths.from_root(runtime_root or DEFAULT_RUNTIME_ROOT)
    paths.ensure()

    if point_adapter is None or lang_adapter is None:
        defaults = create_default_adapters(paths)
        point_adapter = point_adapter or defaults.point
        lang_adapter = lang_adapter or defaults.lang

    app = FastAPI(title="CampusSeg Backend", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.mount("/uploads", StaticFiles(directory=paths.uploads), name="uploads")
    app.mount("/masks", StaticFiles(directory=paths.masks), name="masks")
    app.mount("/pngs", StaticFiles(directory=paths.pngs), name="pngs")

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/segment/point")
    async def segment_point(
        image: UploadFile | None = File(None),
        scene_image: str | None = Form(None),
        x: int = Form(...),
        y: int = Form(...),
        point_label: int = Form(1),
    ) -> dict[str, str]:
        loaded = await _save_input(image, paths, scene_image)
        try:
            mask = point_adapter.segment(loaded.image, x=x, y=y, point_label=point_label)
            return _save_outputs("point", loaded, mask, paths)
        except NoMaskFound as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(status_code=503, detail=f"SAM2 segmentation failed: {exc}") from exc

    @app.post("/segment/lang")
    async def segment_lang(
        image: UploadFile | None = File(None),
        scene_image: str | None = Form(None),
        prompt: str | None = Form(None),
        text_prompt: str | None = Form(None),
    ) -> dict[str, str]:
        loaded = await _save_input(image, paths, scene_image)
        resolved_prompt = (prompt or text_prompt or "").strip()
        if not resolved_prompt:
            raise HTTPException(status_code=422, detail="prompt or text_prompt is required")

        try:
            mask = lang_adapter.segment(loaded.image, prompt=resolved_prompt)
            return _save_outputs("lang", loaded, mask, paths)
        except NoMaskFound as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(status_code=503, detail=f"LangSAM segmentation failed: {exc}") from exc

    return app


async def _save_input(upload: UploadFile | None, paths: RuntimePaths, scene_image: str | None = None):
    try:
        if upload is not None:
            return await save_upload_image(upload, paths.uploads)
        if scene_image:
            return save_existing_image(_resolve_scene_image(scene_image), paths.uploads)
        raise ValueError("image or scene_image is required")
    except UnidentifiedImageError as exc:
        raise HTTPException(status_code=415, detail="Uploaded file is not a readable image") from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


def _resolve_scene_image(scene_image: str) -> Path:
    value = scene_image.strip().replace("\\", "/")
    parsed = urlparse(value)
    if parsed.scheme and parsed.scheme != "file":
        raise ValueError("scene_image must be a local scene asset")

    if parsed.scheme == "file":
        value = unquote(parsed.path).replace("\\", "/")
        marker = "/frontend/"
        marker_index = value.lower().find(marker)
        if marker_index >= 0:
            value = value[marker_index + len(marker) :]
    else:
        value = unquote(value)

    while value.startswith("./"):
        value = value[2:]
    candidate = (FRONTEND_ROOT / value).resolve()
    scene_root = SCENE_IMAGE_ROOT.resolve()
    if not candidate.is_file() or not candidate.is_relative_to(scene_root):
        raise ValueError("scene_image is not an allowed scene asset")
    return candidate


def _save_outputs(method: str, loaded, mask, paths: RuntimePaths) -> dict[str, str]:
    mask_path = paths.masks / f"{loaded.stem}_mask.png"
    png_path = paths.pngs / f"{loaded.stem}_object.png"
    export_mask_assets(loaded.image, mask, mask_path, png_path)
    return {
        "status": "success",
        "method": method,
        "original_url": f"/uploads/{loaded.path.name}",
        "mask_url": f"/masks/{mask_path.name}",
        "png_url": f"/pngs/{png_path.name}",
    }


app = create_app()
