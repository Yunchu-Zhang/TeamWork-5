from __future__ import annotations

import re
import shutil
from html import escape
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from backend.image_ops import assert_image_file, export_transparent_png, make_point_mask, make_prompt_mask


PROJECT_ROOT = Path(__file__).resolve().parents[1]
UPLOADS_DIR = PROJECT_ROOT / "uploads"
MASKS_DIR = PROJECT_ROOT / "masks"
PNGS_DIR = PROJECT_ROOT / "pngs"

for directory in (UPLOADS_DIR, MASKS_DIR, PNGS_DIR):
    directory.mkdir(parents=True, exist_ok=True)


app = FastAPI(
    title="Image Segmentation Backend",
    description="Upload images, run point/text demo segmentation, and export transparent PNG assets.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")
app.mount("/masks", StaticFiles(directory=MASKS_DIR), name="masks")
app.mount("/pngs", StaticFiles(directory=PNGS_DIR), name="pngs")


class UploadResponse(BaseModel):
    status: str
    filename: str
    original_url: str


class SegmentResponse(BaseModel):
    status: str
    method: str
    original_url: str
    mask_url: str
    png_url: str
    message: str


class OutputRecord(BaseModel):
    name: str
    url: str
    size: int
    modified_at: str


def safe_filename(filename: str) -> str:
    source = Path(filename or "upload.png")
    suffix = source.suffix.lower() or ".png"
    stem = re.sub(r"[^A-Za-z0-9_.-]+", "_", source.stem).strip("._") or "image"
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return f"{stamp}_{uuid4().hex[:8]}_{stem}{suffix}"


def url_for(path: Path, base_dir: Path, prefix: str) -> str:
    return f"/{prefix}/{path.relative_to(base_dir).as_posix()}"


def resolve_uploaded_path(image_path: str) -> Path:
    clean_path = image_path.strip()
    if clean_path.startswith("/uploads/"):
        clean_path = clean_path[len("/uploads/") :]

    candidate = (UPLOADS_DIR / clean_path).resolve()
    if not candidate.is_file() or UPLOADS_DIR.resolve() not in candidate.parents:
        raise HTTPException(status_code=404, detail="Image not found in uploads folder.")
    return candidate


async def save_upload(image: UploadFile) -> Path:
    filename = safe_filename(image.filename or "upload.png")
    destination = UPLOADS_DIR / filename

    try:
        with destination.open("wb") as output:
            shutil.copyfileobj(image.file, output)
        assert_image_file(destination)
    except ValueError as exc:
        destination.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        await image.close()

    return destination


async def get_or_save_image(image: UploadFile | None, image_path: str | None) -> Path:
    if image is not None:
        return await save_upload(image)
    if image_path:
        return resolve_uploaded_path(image_path)
    raise HTTPException(status_code=400, detail="Provide either image file or image_path.")


def build_output_paths(image_path: Path, method: str) -> tuple[Path, Path]:
    stem = image_path.stem
    suffix = uuid4().hex[:8]
    mask_path = MASKS_DIR / f"{stem}_{method}_{suffix}_mask.png"
    png_path = PNGS_DIR / f"{stem}_{method}_{suffix}_object.png"
    return mask_path, png_path


def list_files(directory: Path, prefix: str) -> list[OutputRecord]:
    records = []
    for path in sorted(directory.glob("*"), key=lambda item: item.stat().st_mtime, reverse=True):
        if not path.is_file() or path.name == ".gitkeep":
            continue
        records.append(
            OutputRecord(
                name=path.name,
                url=url_for(path, directory, prefix),
                size=path.stat().st_size,
                modified_at=datetime.fromtimestamp(path.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S"),
            )
        )
    return records


@app.get("/", response_class=HTMLResponse)
def demo_page() -> str:
    return """
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>邝小雅后端成果展示</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #18202a; background: #f6f8fb; }
    header { padding: 20px 28px; background: #18324a; color: white; display: flex; justify-content: space-between; gap: 16px; align-items: center; }
    header h1 { margin: 0; font-size: 22px; letter-spacing: 0; }
    header nav { display: flex; gap: 10px; flex-wrap: wrap; }
    header a { color: white; text-decoration: none; border: 1px solid rgba(255,255,255,.45); padding: 8px 10px; border-radius: 6px; }
    main { padding: 22px; display: grid; grid-template-columns: 360px 1fr; gap: 18px; }
    section { background: white; border: 1px solid #dbe3ee; border-radius: 8px; padding: 16px; }
    h2 { margin: 0 0 12px; font-size: 16px; }
    label { display: block; font-size: 13px; color: #4a596b; margin: 12px 0 6px; }
    input, button { width: 100%; font: inherit; }
    input[type="text"], input[type="number"] { border: 1px solid #c8d3df; border-radius: 6px; padding: 10px; }
    button { border: 0; border-radius: 6px; padding: 10px 12px; background: #1f6fb2; color: white; cursor: pointer; margin-top: 10px; }
    button.secondary { background: #52606d; }
    .hint { font-size: 12px; color: #687789; line-height: 1.6; }
    .preview-wrap { position: relative; border: 1px solid #c8d3df; border-radius: 8px; overflow: hidden; background: #eef2f6; min-height: 260px; display: flex; align-items: center; justify-content: center; }
    #preview { max-width: 100%; display: block; cursor: crosshair; }
    .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
    .result { border: 1px solid #dbe3ee; border-radius: 8px; overflow: hidden; background: #fff; }
    .result h3 { margin: 0; padding: 10px 12px; font-size: 14px; background: #eef3f7; }
    .result img { width: 100%; min-height: 220px; object-fit: contain; background: linear-gradient(45deg, #e8edf2 25%, transparent 25%), linear-gradient(-45deg, #e8edf2 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e8edf2 75%), linear-gradient(-45deg, transparent 75%, #e8edf2 75%); background-size: 18px 18px; background-position: 0 0, 0 9px, 9px -9px, -9px 0; }
    pre { overflow: auto; background: #101820; color: #d8f2ff; padding: 12px; border-radius: 8px; min-height: 88px; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    @media (max-width: 920px) { main { grid-template-columns: 1fr; } .grid { grid-template-columns: 1fr; } header { display: block; } header nav { margin-top: 12px; } }
  </style>
</head>
<body>
  <header>
    <h1>邝小雅后端成果展示</h1>
    <nav>
      <a href="/docs">Swagger 接口文档</a>
      <a href="/outputs">输出文件清单</a>
      <a href="/health">健康检查</a>
    </nav>
  </header>
  <main>
    <section>
      <h2>接口演示</h2>
      <label>选择图片</label>
      <input id="file" type="file" accept="image/*" />
      <button id="uploadBtn">上传到 /upload</button>
      <p class="hint">点选分割：上传后在图片上点击目标区域，坐标会自动填入。</p>
      <div class="preview-wrap"><img id="preview" alt="上传图片预览" /></div>
      <div class="row">
        <div>
          <label>x 坐标</label>
          <input id="x" type="number" step="0.001" value="0.5" />
        </div>
        <div>
          <label>y 坐标</label>
          <input id="y" type="number" step="0.001" value="0.5" />
        </div>
      </div>
      <button id="pointBtn">调用 /segment/point</button>
      <label>文本 prompt</label>
      <input id="prompt" type="text" value="car" />
      <button id="langBtn">调用 /segment/lang</button>
      <button id="clearBtn" class="secondary">清空结果</button>
    </section>
    <section>
      <h2>后端返回结果</h2>
      <div class="grid">
        <div class="result"><h3>原图 uploads</h3><img id="original" alt="原图" /></div>
        <div class="result"><h3>Mask masks</h3><img id="mask" alt="mask" /></div>
        <div class="result"><h3>透明 PNG pngs</h3><img id="png" alt="png" /></div>
      </div>
      <pre id="json">{}</pre>
      <a id="download" href="#" download>下载透明 PNG</a>
    </section>
  </main>
  <script>
    let uploadedUrl = "";
    const file = document.querySelector("#file");
    const preview = document.querySelector("#preview");
    const jsonBox = document.querySelector("#json");
    const setJson = (data) => { jsonBox.textContent = JSON.stringify(data, null, 2); };
    const showResult = (data) => {
      setJson(data);
      if (data.original_url) document.querySelector("#original").src = data.original_url;
      if (data.mask_url) document.querySelector("#mask").src = data.mask_url;
      if (data.png_url) {
        document.querySelector("#png").src = data.png_url;
        document.querySelector("#download").href = data.png_url;
      }
    };
    file.addEventListener("change", () => {
      const selected = file.files[0];
      if (selected) preview.src = URL.createObjectURL(selected);
    });
    preview.addEventListener("click", (event) => {
      const rect = preview.getBoundingClientRect();
      document.querySelector("#x").value = ((event.clientX - rect.left) / rect.width).toFixed(4);
      document.querySelector("#y").value = ((event.clientY - rect.top) / rect.height).toFixed(4);
    });
    document.querySelector("#uploadBtn").addEventListener("click", async () => {
      if (!file.files[0]) return alert("请先选择图片");
      const form = new FormData();
      form.append("image", file.files[0]);
      const data = await fetch("/upload", { method: "POST", body: form }).then((res) => res.json());
      uploadedUrl = data.original_url;
      showResult(data);
    });
    document.querySelector("#pointBtn").addEventListener("click", async () => {
      const form = new FormData();
      if (uploadedUrl) form.append("image_path", uploadedUrl);
      else if (file.files[0]) form.append("image", file.files[0]);
      else return alert("请先选择或上传图片");
      form.append("x", document.querySelector("#x").value);
      form.append("y", document.querySelector("#y").value);
      const data = await fetch("/segment/point", { method: "POST", body: form }).then((res) => res.json());
      showResult(data);
    });
    document.querySelector("#langBtn").addEventListener("click", async () => {
      const form = new FormData();
      if (uploadedUrl) form.append("image_path", uploadedUrl);
      else if (file.files[0]) form.append("image", file.files[0]);
      else return alert("请先选择或上传图片");
      form.append("prompt", document.querySelector("#prompt").value);
      const data = await fetch("/segment/lang", { method: "POST", body: form }).then((res) => res.json());
      showResult(data);
    });
    document.querySelector("#clearBtn").addEventListener("click", () => {
      uploadedUrl = "";
      setJson({});
      for (const id of ["original", "mask", "png", "preview"]) document.querySelector("#" + id).removeAttribute("src");
      document.querySelector("#download").href = "#";
    });
  </script>
</body>
</html>
"""


@app.get("/api/outputs")
def api_outputs() -> dict[str, list[OutputRecord]]:
    return {
        "uploads": list_files(UPLOADS_DIR, "uploads"),
        "masks": list_files(MASKS_DIR, "masks"),
        "pngs": list_files(PNGS_DIR, "pngs"),
    }


@app.get("/outputs", response_class=HTMLResponse)
def outputs_page() -> str:
    groups = {
        "uploads 原图": list_files(UPLOADS_DIR, "uploads"),
        "masks 分割遮罩": list_files(MASKS_DIR, "masks"),
        "pngs 透明素材": list_files(PNGS_DIR, "pngs"),
    }
    sections = []
    for title, records in groups.items():
        rows = "\n".join(
            f"<tr><td><a href='{escape(record.url)}'>{escape(record.name)}</a></td><td>{record.size}</td><td>{escape(record.modified_at)}</td></tr>"
            for record in records
        )
        if not rows:
            rows = "<tr><td colspan='3'>暂无文件</td></tr>"
        sections.append(
            f"""
            <section>
              <h2>{escape(title)}</h2>
              <table>
                <thead><tr><th>文件</th><th>大小 bytes</th><th>生成时间</th></tr></thead>
                <tbody>{rows}</tbody>
              </table>
            </section>
            """
        )

    return f"""
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>输出文件清单</title>
  <style>
    body {{ margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f6f8fb; color: #18202a; }}
    header {{ padding: 20px 28px; background: #18324a; color: white; }}
    header a {{ color: white; }}
    main {{ padding: 22px; display: grid; gap: 16px; }}
    section {{ background: white; border: 1px solid #dbe3ee; border-radius: 8px; padding: 16px; }}
    h1 {{ margin: 0 0 8px; font-size: 22px; }}
    h2 {{ margin: 0 0 12px; font-size: 16px; }}
    table {{ border-collapse: collapse; width: 100%; }}
    th, td {{ text-align: left; border-bottom: 1px solid #e3e9f0; padding: 9px; font-size: 14px; }}
    th {{ background: #eef3f7; }}
  </style>
</head>
<body>
  <header>
    <h1>输出文件清单</h1>
    <a href="/">返回成果展示页</a>
  </header>
  <main>
    {''.join(sections)}
  </main>
</body>
</html>
"""


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/upload", response_model=UploadResponse)
async def upload_image(image: UploadFile = File(...)) -> UploadResponse:
    image_path = await save_upload(image)
    return UploadResponse(
        status="success",
        filename=image_path.name,
        original_url=url_for(image_path, UPLOADS_DIR, "uploads"),
    )


@app.post("/segment/point", response_model=SegmentResponse)
async def segment_point(
    image: UploadFile | None = File(default=None),
    image_path: str | None = Form(default=None),
    x: float = Form(...),
    y: float = Form(...),
    point_type: str = Form(default="positive"),
    point_label: int | None = Form(default=None),
) -> SegmentResponse:
    if point_label is not None:
        if point_label not in {0, 1}:
            raise HTTPException(status_code=400, detail="point_label must be 1 for positive or 0 for negative.")
        point_type = "positive" if point_label == 1 else "negative"

    if point_type not in {"positive", "negative"}:
        raise HTTPException(status_code=400, detail="point_type must be positive or negative.")

    original_path = await get_or_save_image(image, image_path)
    mask_path, png_path = build_output_paths(original_path, "point")
    make_point_mask(original_path, mask_path, x, y)
    export_transparent_png(original_path, mask_path, png_path)

    return SegmentResponse(
        status="success",
        method="point",
        original_url=url_for(original_path, UPLOADS_DIR, "uploads"),
        mask_url=url_for(mask_path, MASKS_DIR, "masks"),
        png_url=url_for(png_path, PNGS_DIR, "pngs"),
        message="Point segmentation completed by the local color-connected demo algorithm.",
    )


@app.post("/segment/lang", response_model=SegmentResponse)
async def segment_lang(
    image: UploadFile | None = File(default=None),
    image_path: str | None = Form(default=None),
    prompt: str = Form(...),
) -> SegmentResponse:
    if not prompt.strip():
        raise HTTPException(status_code=400, detail="prompt cannot be empty.")

    original_path = await get_or_save_image(image, image_path)
    mask_path, png_path = build_output_paths(original_path, "lang")
    make_prompt_mask(original_path, mask_path, prompt)
    export_transparent_png(original_path, mask_path, png_path)

    return SegmentResponse(
        status="success",
        method="lang",
        original_url=url_for(original_path, UPLOADS_DIR, "uploads"),
        mask_url=url_for(mask_path, MASKS_DIR, "masks"),
        png_url=url_for(png_path, PNGS_DIR, "pngs"),
        message=f"Text segmentation completed by the local prompt-aware demo algorithm for '{prompt.strip()}'.",
    )
