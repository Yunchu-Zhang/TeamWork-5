from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image


class NoMaskFound(ValueError):
    """Raised when a model returns no usable segmentation mask."""


def mask_to_bool_array(mask: Any, image_size: tuple[int, int]) -> np.ndarray:
    width, height = image_size
    array = _to_numpy(mask)

    if array.size == 0:
        raise NoMaskFound("empty mask")

    array = np.squeeze(array)
    if array.ndim == 3:
        array = np.any(array.astype(bool), axis=0)
    elif array.ndim != 2:
        raise ValueError(f"Mask must be 2D or 3D, got shape {array.shape}")

    if array.shape != (height, width):
        raise ValueError(f"Mask shape {array.shape} does not match image size {(width, height)}")

    bool_mask = array.astype(bool)
    if not bool_mask.any():
        raise NoMaskFound("empty mask")
    return bool_mask


def export_mask_assets(image: Image.Image, mask: Any, mask_path: Path, png_path: Path) -> tuple[Path, Path]:
    bool_mask = mask_to_bool_array(mask, image.size)

    mask_path.parent.mkdir(parents=True, exist_ok=True)
    png_path.parent.mkdir(parents=True, exist_ok=True)

    Image.fromarray(bool_mask.astype(np.uint8) * 255, mode="L").save(mask_path)

    ys, xs = np.where(bool_mask)
    left, right = int(xs.min()), int(xs.max())
    top, bottom = int(ys.min()), int(ys.max())
    crop_box = (left, top, right + 1, bottom + 1)

    rgba = image.convert("RGBA").crop(crop_box)
    alpha = bool_mask[top : bottom + 1, left : right + 1].astype(np.uint8) * 255
    rgba.putalpha(Image.fromarray(alpha, mode="L"))
    rgba.save(png_path)
    return mask_path, png_path


def _to_numpy(value: Any) -> np.ndarray:
    if hasattr(value, "detach"):
        value = value.detach()
    if hasattr(value, "cpu"):
        value = value.cpu()
    if hasattr(value, "numpy"):
        value = value.numpy()
    return np.asarray(value)
