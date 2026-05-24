from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

import numpy as np
from PIL import Image

from backend.services.masks import export_mask_assets


class MaskExportTests(unittest.TestCase):
    def test_export_mask_and_cropped_transparent_png(self):
        image = Image.new("RGB", (4, 4), (10, 20, 30))
        image.putpixel((1, 1), (200, 10, 20))
        image.putpixel((2, 1), (210, 11, 21))
        image.putpixel((1, 2), (220, 12, 22))

        mask = np.zeros((4, 4), dtype=bool)
        mask[1:3, 1:3] = True
        mask[1, 2] = False

        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            mask_path = root / "mask.png"
            png_path = root / "object.png"

            export_mask_assets(image, mask, mask_path, png_path)

            saved_mask = Image.open(mask_path)
            self.assertEqual(saved_mask.mode, "L")
            self.assertEqual(saved_mask.size, (4, 4))
            self.assertEqual(saved_mask.getpixel((1, 1)), 255)
            self.assertEqual(saved_mask.getpixel((2, 1)), 0)

            saved_png = Image.open(png_path)
            self.assertEqual(saved_png.mode, "RGBA")
            self.assertEqual(saved_png.size, (2, 2))
            self.assertEqual(saved_png.getpixel((0, 0)), (200, 10, 20, 255))
            self.assertEqual(saved_png.getpixel((1, 0)), (210, 11, 21, 0))
            self.assertEqual(saved_png.getpixel((0, 1)), (220, 12, 22, 255))

    def test_export_rejects_empty_mask(self):
        image = Image.new("RGB", (3, 3), "white")
        mask = np.zeros((3, 3), dtype=bool)

        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            with self.assertRaisesRegex(ValueError, "empty mask"):
                export_mask_assets(image, mask, root / "mask.png", root / "object.png")


if __name__ == "__main__":
    unittest.main()
