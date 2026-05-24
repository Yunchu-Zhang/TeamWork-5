# FastAPI 后端运行说明

本后端为现有前端提供真实分割接口，默认监听 `http://127.0.0.1:8000`。前端已请求 `/segment/point` 和 `/segment/lang`，不需要改页面结构。

## 环境准备

使用本机 Python 3.13 创建虚拟环境并安装依赖：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\setup_backend.ps1
```

脚本会创建 `backend/.venv/`，安装 FastAPI、Uvicorn、Pillow、NumPy、Torch CPU、SAM2、Transformers、Supervision 等依赖。当前机器未检测到 CUDA 工具时会按 CPU 推理，首次模型下载和推理会明显较慢。

## 启动

只启动后端：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\start_backend.ps1
```

同时启动后端和静态前端：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\start_project.ps1
```

访问地址：

- 前端：`http://127.0.0.1:4173`
- 后端健康检查：`http://127.0.0.1:8000/health`
- Swagger：`http://127.0.0.1:8000/docs`

## 接口

`GET /health`

```json
{"status": "ok"}
```

`POST /segment/point`

表单字段：

- `image`: 图片文件
- `x`: 原图像素坐标 x
- `y`: 原图像素坐标 y
- `point_label`: `1` 表示前景点，`0` 表示背景点，默认 `1`

`POST /segment/lang`

表单字段：

- `image`: 图片文件
- `prompt` 或 `text_prompt`: 英文目标描述，例如 `cup`

成功返回格式：

```json
{
  "status": "success",
  "method": "point",
  "original_url": "/uploads/xxx.png",
  "mask_url": "/masks/xxx_mask.png",
  "png_url": "/pngs/xxx_object.png"
}
```

## 模型策略

- SAM2 点选分割使用 `sam2.1_hiera_small`，checkpoint 自动下载到 `backend/runtime/models/`。
- LangSAM 使用仓库内 `*lang-segment-anything-main` 本地源码，并调用 `LangSAM.predict(...)`。
- GroundingDINO 由 Hugging Face 加载 `IDEA-Research/grounding-dino-base`。
- 如果模型下载、网络、依赖或推理失败，接口返回明确 HTTP 错误，不生成假 mask 或假 PNG。

## 输出文件

运行时文件会写入：

- 原图：`backend/runtime/uploads/`
- 二值 mask：`backend/runtime/masks/`
- 透明背景 PNG：`backend/runtime/pngs/`
- 模型缓存：`backend/runtime/models/`

透明 PNG 使用 mask 作为 alpha 通道，并裁剪到目标外接区域。

## 测试

后端单测和 API contract 测试：

```powershell
backend\.venv\Scripts\python.exe -m unittest discover backend/tests
```

前端 smoke 和语法检查：

```powershell
node --test frontend/smoke-test.mjs
node --check frontend/app.js
```

## 常见失败

- `ModuleNotFoundError`: 先运行 `scripts/setup_backend.ps1`。
- `SAM2 segmentation failed`: 检查 `backend/runtime/models/` 是否能下载 checkpoint，或网络是否能访问 Meta checkpoint 地址。
- `LangSAM segmentation failed`: 检查 Hugging Face 访问是否正常，或 `*lang-segment-anything-main` 本地源码是否存在。
- CPU 首次推理长时间无响应：模型下载和初始化较慢，等待终端日志完成。
