from __future__ import annotations

from pathlib import Path
import os
import urllib.request

import numpy as np
from PIL import Image


SAM2_MODEL_TYPE = "sam2.1_hiera_small"
SAM2_MODEL_CONFIG = "configs/sam2.1/sam2.1_hiera_s.yaml"
SAM2_CHECKPOINT_URL = "https://dl.fbaipublicfiles.com/segment_anything_2/092824/sam2.1_hiera_small.pt"


def ensure_sam2_checkpoint(model_cache_dir: Path) -> Path:
    model_cache_dir.mkdir(parents=True, exist_ok=True)
    checkpoint = model_cache_dir / Path(SAM2_CHECKPOINT_URL).name
    if not checkpoint.exists():
        urllib.request.urlretrieve(SAM2_CHECKPOINT_URL, checkpoint)
    return checkpoint


def select_torch_device() -> str:
    os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")
    import torch

    if torch.cuda.is_available():
        return "cuda"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


class SAM2PointAdapter:
    def __init__(self, model_cache_dir: Path, model_type: str = SAM2_MODEL_TYPE):
        self.model_cache_dir = Path(model_cache_dir)
        self.model_type = model_type
        self._predictor = None
        self._device = None

    def segment(self, image: Image.Image, x: int, y: int, point_label: int = 1) -> np.ndarray:
        width, height = image.size
        if not (0 <= x < width and 0 <= y < height):
            raise ValueError(f"Point ({x}, {y}) is outside image size {(width, height)}")
        if point_label not in (0, 1):
            raise ValueError("point_label must be 0 or 1")

        predictor = self._ensure_predictor()
        image_rgb = np.asarray(image.convert("RGB"))
        point_coords = np.array([[x, y]], dtype=np.float32)
        point_labels = np.array([point_label], dtype=np.int32)

        import torch

        with torch.inference_mode():
            predictor.set_image(image_rgb)
            masks, scores, _ = predictor.predict(
                point_coords=point_coords,
                point_labels=point_labels,
                multimask_output=True,
            )

        if masks is None or len(masks) == 0:
            raise ValueError("SAM2 returned no masks")
        best_index = int(np.argmax(scores))
        return masks[best_index].astype(bool)

    def _ensure_predictor(self):
        if self._predictor is not None:
            return self._predictor

        checkpoint = ensure_sam2_checkpoint(self.model_cache_dir)
        self._device = select_torch_device()

        from sam2.build_sam import build_sam2
        from sam2.sam2_image_predictor import SAM2ImagePredictor

        model = build_sam2(SAM2_MODEL_CONFIG, str(checkpoint), device=self._device)
        self._predictor = SAM2ImagePredictor(model)
        return self._predictor
