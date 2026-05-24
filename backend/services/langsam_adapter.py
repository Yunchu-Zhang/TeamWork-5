from __future__ import annotations

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

        checkpoint = ensure_sam2_checkpoint(self.model_cache_dir)
        device = select_torch_device()
        from lang_sam import LangSAM

        self._model = LangSAM(
            sam_type=SAM2_MODEL_TYPE,
            sam_ckpt_path=str(checkpoint),
            device=device,
        )
        return self._model
