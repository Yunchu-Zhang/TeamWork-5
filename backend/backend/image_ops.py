from __future__ import annotations

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
PROMPT_ALIASES = {
    "car": {"car", "vehicle", "auto", "automobile", "汽车", "车"},
    "person": {"person", "people", "man", "woman", "human", "人", "人物"},
    "wheel": {"wheel", "tire", "tyre", "轮胎", "车轮"},
    "cup": {"cup", "mug", "杯子", "水杯"},
    "book": {"book", "notebook", "书", "书本"},
    "computer": {"computer", "laptop", "screen", "电脑", "笔记本"},
    "chair": {"chair", "seat", "椅子", "座椅"},
    "fruit": {"fruit", "fruits", "apple", "banana", "orange", "kiwi", "水果"},
    "food": {"food", "meal", "dish", "plate", "食物", "餐盘"},
}


def assert_image_file(path: Path) -> None:
    """Validate that a saved upload is an image Pillow can open."""
    if path.suffix.lower() not in IMAGE_SUFFIXES:
        raise ValueError("Only jpg, jpeg, png, webp, and bmp images are supported.")

    try:
        with Image.open(path) as image:
            image.verify()
    except Exception as exc:
        raise ValueError("Uploaded file is not a valid image.") from exc


def point_to_pixels(x: float, y: float, width: int, height: int) -> tuple[int, int]:
    """Accept either pixel coordinates or 0-1 ratio coordinates."""
    px = int(x * width) if 0 <= x <= 1 else int(x)
    py = int(y * height) if 0 <= y <= 1 else int(y)
    px = max(0, min(width - 1, px))
    py = max(0, min(height - 1, py))
    return px, py


def smooth_binary_mask(mask: Image.Image) -> Image.Image:
    mask = mask.convert("L")
    mask = mask.filter(ImageFilter.MaxFilter(7))
    mask = mask.filter(ImageFilter.MinFilter(5))
    mask = mask.filter(ImageFilter.GaussianBlur(1.2))
    return mask.point(lambda value: 255 if value >= 90 else 0)


def connected_component(candidate: np.ndarray, start_x: int, start_y: int) -> np.ndarray:
    height, width = candidate.shape
    if not candidate[start_y, start_x]:
        return np.zeros_like(candidate, dtype=bool)

    visited = np.zeros_like(candidate, dtype=bool)
    queue: deque[tuple[int, int]] = deque([(start_x, start_y)])
    visited[start_y, start_x] = True

    while queue:
        x, y = queue.popleft()
        for next_x, next_y in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= next_x < width and 0 <= next_y < height and candidate[next_y, next_x] and not visited[next_y, next_x]:
                visited[next_y, next_x] = True
                queue.append((next_x, next_y))

    return visited


def largest_component(candidate: np.ndarray) -> np.ndarray:
    height, width = candidate.shape
    visited = np.zeros_like(candidate, dtype=bool)
    best: list[tuple[int, int]] = []

    for y in range(height):
        for x in range(width):
            if not candidate[y, x] or visited[y, x]:
                continue

            component = []
            queue: deque[tuple[int, int]] = deque([(x, y)])
            visited[y, x] = True

            while queue:
                cx, cy = queue.popleft()
                component.append((cx, cy))
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < width and 0 <= ny < height and candidate[ny, nx] and not visited[ny, nx]:
                        visited[ny, nx] = True
                        queue.append((nx, ny))

            if len(component) > len(best):
                best = component

    result = np.zeros_like(candidate, dtype=bool)
    for x, y in best:
        result[y, x] = True
    return result


def make_point_mask(image_path: Path, mask_path: Path, x: float, y: float) -> Path:
    """Create a color-connected mask around a clicked point.

    This is a lightweight local stand-in for SAM2 point segmentation. It is
    deterministic and keeps the complete backend pipeline demonstrable without
    downloading model checkpoints.
    """
    with Image.open(image_path).convert("RGB") as image:
        width, height = image.size
        array = np.asarray(image).astype(np.int16)

    px, py = point_to_pixels(x, y, width, height)
    patch_radius = max(2, int(min(width, height) * 0.01))
    y1, y2 = max(0, py - patch_radius), min(height, py + patch_radius + 1)
    x1, x2 = max(0, px - patch_radius), min(width, px + patch_radius + 1)
    target = array[y1:y2, x1:x2].reshape(-1, 3).mean(axis=0)
    distance = np.linalg.norm(array - target, axis=2)

    component = np.zeros((height, width), dtype=bool)
    for threshold in (34, 48, 64, 82):
        candidate = distance <= threshold
        component = connected_component(candidate, px, py)
        if component.sum() >= max(80, int(width * height * 0.004)):
            break

    if component.sum() == 0:
        draw_fallback_mask(width, height, mask_path, "point", center=(px, py))
        return mask_path

    mask = Image.fromarray((component.astype(np.uint8) * 255), mode="L")
    smooth_binary_mask(mask).save(mask_path)
    return mask_path


def normalize_prompt(prompt: str) -> str:
    lowered = prompt.strip().lower().replace(".", "")
    for category, aliases in PROMPT_ALIASES.items():
        if lowered in aliases:
            return category
    return lowered


def draw_fallback_mask(
    width: int,
    height: int,
    mask_path: Path,
    category: str,
    center: tuple[int, int] | None = None,
) -> Path:
    mask = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(mask)
    cx, cy = center or (width // 2, height // 2)

    if category == "person":
        draw.ellipse((cx - width * 0.08, height * 0.14, cx + width * 0.08, height * 0.30), fill=255)
        draw.rounded_rectangle((cx - width * 0.12, height * 0.28, cx + width * 0.12, height * 0.78), radius=18, fill=255)
    elif category == "wheel":
        radius = max(12, int(min(width, height) * 0.11))
        draw.ellipse((width * 0.22, height * 0.56, width * 0.22 + radius * 2, height * 0.56 + radius * 2), fill=255)
        draw.ellipse((width * 0.64, height * 0.56, width * 0.64 + radius * 2, height * 0.56 + radius * 2), fill=255)
    elif category == "car":
        draw.rounded_rectangle((width * 0.12, height * 0.42, width * 0.88, height * 0.75), radius=24, fill=255)
        draw.polygon(
            [
                (width * 0.28, height * 0.42),
                (width * 0.42, height * 0.26),
                (width * 0.64, height * 0.26),
                (width * 0.76, height * 0.42),
            ],
            fill=255,
        )
    elif category in {"cup", "food"}:
        draw.ellipse((width * 0.25, height * 0.28, width * 0.75, height * 0.78), fill=255)
    elif category == "book":
        draw.rounded_rectangle((width * 0.23, height * 0.30, width * 0.77, height * 0.72), radius=10, fill=255)
    elif category in {"computer", "chair"}:
        draw.rounded_rectangle((width * 0.20, height * 0.24, width * 0.80, height * 0.68), radius=12, fill=255)
        draw.rectangle((width * 0.42, height * 0.68, width * 0.58, height * 0.82), fill=255)
    elif category == "point":
        radius = max(18, int(min(width, height) * 0.13))
        draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=255)
    else:
        draw.rounded_rectangle((width * 0.22, height * 0.18, width * 0.78, height * 0.82), radius=22, fill=255)

    smooth_binary_mask(mask).save(mask_path)
    return mask_path


def make_prompt_mask(image_path: Path, mask_path: Path, prompt: str) -> Path:
    """Create a prompt-aware local mask for text segmentation demonstration."""
    category = normalize_prompt(prompt)
    with Image.open(image_path).convert("RGB") as image:
        width, height = image.size
        array = np.asarray(image).astype(np.float32)

    if category in {"car", "person", "wheel", "cup", "book", "computer", "chair", "food"}:
        return draw_fallback_mask(width, height, mask_path, category)

    max_channel = array.max(axis=2)
    min_channel = array.min(axis=2)
    saturation = max_channel - min_channel
    gray = array.mean(axis=2)
    border_pixels = np.concatenate([gray[:6, :].ravel(), gray[-6:, :].ravel(), gray[:, :6].ravel(), gray[:, -6:].ravel()])
    border_mean = float(border_pixels.mean())
    contrast = np.abs(gray - border_mean)

    yy, xx = np.mgrid[0:height, 0:width]
    center_distance = ((xx - width / 2) / width) ** 2 + ((yy - height / 2) / height) ** 2
    center_bias = (1 - np.clip(center_distance * 3.2, 0, 1)) * 60
    score = saturation * 0.8 + contrast * 0.7 + center_bias
    threshold = np.percentile(score, 78)
    candidate = score >= threshold
    component = largest_component(candidate)

    if component.sum() < max(80, int(width * height * 0.003)):
        return draw_fallback_mask(width, height, mask_path, category)

    mask = Image.fromarray((component.astype(np.uint8) * 255), mode="L")
    smooth_binary_mask(mask).save(mask_path)
    return mask_path


def export_transparent_png(image_path: Path, mask_path: Path, output_path: Path) -> Path:
    """Apply a grayscale mask as alpha and save a transparent PNG."""
    with Image.open(image_path).convert("RGBA") as original:
        with Image.open(mask_path).convert("L") as mask:
            if mask.size != original.size:
                mask = mask.resize(original.size)

            result = original.copy()
            result.putalpha(mask)
            result.save(output_path, "PNG")

    return output_path
