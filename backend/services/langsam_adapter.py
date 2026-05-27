from __future__ import annotations

import os
from pathlib import Path
import sys

import numpy as np
from PIL import Image

from backend.services.masks import NoMaskFound
from backend.services.sam2_adapter import SAM2_MODEL_TYPE, ensure_sam2_checkpoint, select_torch_device


class LangSAMAdapter:
    def __init__(
        self,
        model_cache_dir: Path,
        source_dir: Path,
        box_threshold: float = 0.3,
        text_threshold: float = 0.25,
    ):
        self.model_cache_dir = Path(model_cache_dir)
        self.source_dir = Path(source_dir)
        self.box_threshold = box_threshold
        self.text_threshold = text_threshold
        self._model = None

    def _resolve_gdino_paths(self) -> tuple[str | None, str | None]:
        model_path = os.environ.get("CAMPUSSEG_GDINO_MODEL_PATH")
        processor_path = os.environ.get("CAMPUSSEG_GDINO_PROCESSOR_PATH")
        local_dir = self.model_cache_dir / "grounding-dino-base"
        if local_dir.exists():
            model_path = model_path or str(local_dir)
            processor_path = processor_path or str(local_dir)
        return model_path, processor_path

    def segment(self, image: Image.Image, prompt: str) -> np.ndarray:
        prompt = prompt.strip()
        if not prompt:
            raise ValueError("prompt is required")

        model = self._ensure_model()
        results = model.predict(
            images_pil=[image.convert("RGB")],
            texts_prompt=[prompt],
            box_threshold=self.box_threshold,
            text_threshold=self.text_threshold,
        )
        if not results:
            raise NoMaskFound(f"No object matched prompt: {prompt}")

        masks = results[0].get("masks")
        if masks is None or len(masks) == 0:
            raise NoMaskFound(f"No object matched prompt: {prompt}")
        return np.asarray(masks).astype(bool)

    def _ensure_model(self):
        if self._model is not None:
            return self._model
        if not self.source_dir.exists():
            raise FileNotFoundError(f"LangSAM source directory not found: {self.source_dir}")

        source = str(self.source_dir.resolve())
        if source not in sys.path:
            sys.path.insert(0, source)

        gdino_model_path, gdino_processor_path = self._resolve_gdino_paths()
        allow_download = os.environ.get("CAMPUSSEG_LANGSAM_ALLOW_DOWNLOAD", "").lower() in {"1", "true", "yes"}
        if not (gdino_model_path and gdino_processor_path) and not allow_download:
            raise RuntimeError(
                "LangSAM needs GroundingDINO model files. Put them in backend/runtime/models/grounding-dino-base "
                "or set CAMPUSSEG_LANGSAM_ALLOW_DOWNLOAD=1 to allow online download."
            )

        checkpoint = ensure_sam2_checkpoint(self.model_cache_dir)
        device = select_torch_device()
        from lang_sam import LangSAM

        self._model = LangSAM(
            sam_type=SAM2_MODEL_TYPE,
            sam_ckpt_path=str(checkpoint),
            gdino_model_ckpt_path=gdino_model_path,
            gdino_processor_ckpt_path=gdino_processor_path,
            device=device,
        )
        return self._model
