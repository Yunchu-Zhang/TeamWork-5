from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

import numpy as np
from fastapi.testclient import TestClient
from PIL import Image

from backend.main import create_app


def make_upload_image() -> BytesIO:
    image = Image.new("RGB", (8, 6), (40, 50, 60))
    image.putpixel((3, 2), (240, 10, 10))
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    buffer.seek(0)
    buffer.name = "scene.png"
    return buffer


class FakePointAdapter:
    def __init__(self):
        self.calls = []

    def segment(self, image, x, y, point_label):
        self.calls.append((image.size, x, y, point_label))
        mask = np.zeros((image.height, image.width), dtype=bool)
        mask[2:5, 3:6] = True
        return mask


class FakeLangAdapter:
    def __init__(self):
        self.calls = []

    def segment(self, image, prompt):
        self.calls.append((image.size, prompt))
        mask = np.zeros((image.height, image.width), dtype=bool)
        mask[1:4, 2:7] = True
        return mask


class ApiContractTests(unittest.TestCase):
    def test_health_contract(self):
        with TemporaryDirectory() as tmp:
            app = create_app(
                point_adapter=FakePointAdapter(),
                lang_adapter=FakeLangAdapter(),
                runtime_root=Path(tmp),
            )
            response = TestClient(app).get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")

    def test_point_endpoint_saves_files_and_returns_urls(self):
        point_adapter = FakePointAdapter()
        with TemporaryDirectory() as tmp:
            runtime_root = Path(tmp)
            app = create_app(
                point_adapter=point_adapter,
                lang_adapter=FakeLangAdapter(),
                runtime_root=runtime_root,
            )
            response = TestClient(app).post(
                "/segment/point",
                files={"image": ("scene.png", make_upload_image(), "image/png")},
                data={"x": "3", "y": "2", "point_label": "1"},
            )

            body = response.json()
            self.assertEqual(response.status_code, 200)
            self.assertEqual(body["status"], "success")
            self.assertEqual(body["method"], "point")
            self.assertRegex(body["original_url"], r"^/uploads/.+\.png$")
            self.assertRegex(body["mask_url"], r"^/masks/.+_mask\.png$")
            self.assertRegex(body["png_url"], r"^/pngs/.+_object\.png$")
            self.assertTrue((runtime_root / body["original_url"].lstrip("/")).is_file())
            self.assertTrue((runtime_root / body["mask_url"].lstrip("/")).is_file())
            self.assertTrue((runtime_root / body["png_url"].lstrip("/")).is_file())

        self.assertEqual(point_adapter.calls, [((8, 6), 3, 2, 1)])

    def test_lang_endpoint_accepts_prompt_aliases(self):
        lang_adapter = FakeLangAdapter()
        with TemporaryDirectory() as tmp:
            runtime_root = Path(tmp)
            app = create_app(
                point_adapter=FakePointAdapter(),
                lang_adapter=lang_adapter,
                runtime_root=runtime_root,
            )
            response = TestClient(app).post(
                "/segment/lang",
                files={"image": ("scene.png", make_upload_image(), "image/png")},
                data={"text_prompt": "cup"},
            )

            body = response.json()
            self.assertEqual(response.status_code, 200)
            self.assertEqual(body["status"], "success")
            self.assertEqual(body["method"], "lang")
            self.assertRegex(body["mask_url"], r"^/masks/.+_mask\.png$")
            self.assertRegex(body["png_url"], r"^/pngs/.+_object\.png$")
            self.assertTrue((runtime_root / body["mask_url"].lstrip("/")).is_file())
            self.assertTrue((runtime_root / body["png_url"].lstrip("/")).is_file())

        self.assertEqual(lang_adapter.calls, [((8, 6), "cup")])

    def test_lang_endpoint_accepts_scene_library_path(self):
        lang_adapter = FakeLangAdapter()
        with TemporaryDirectory() as tmp:
            runtime_root = Path(tmp)
            app = create_app(
                point_adapter=FakePointAdapter(),
                lang_adapter=lang_adapter,
                runtime_root=runtime_root,
            )
            response = TestClient(app).post(
                "/segment/lang",
                data={
                    "scene_image": "./assets/test-scenes/classroom/10_medium_classroom_bottle_desk.jpg",
                    "text_prompt": "bottle",
                },
            )

            body = response.json()
            self.assertEqual(response.status_code, 200)
            self.assertEqual(body["status"], "success")
            self.assertEqual(body["method"], "lang")
            self.assertRegex(body["original_url"], r"^/uploads/.+\.jpg$")
            self.assertTrue((runtime_root / body["original_url"].lstrip("/")).is_file())

        self.assertEqual(len(lang_adapter.calls), 1)
        self.assertGreater(lang_adapter.calls[0][0][0], 0)
        self.assertEqual(lang_adapter.calls[0][1], "bottle")


if __name__ == "__main__":
    unittest.main()
