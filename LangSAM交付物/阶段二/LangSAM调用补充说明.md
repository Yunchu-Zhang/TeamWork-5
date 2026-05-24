# LangSAM 调用补充说明（用于接入 `/segment/lang`）

目标：后端在 `/segment/lang` 接口里，输入 `图片 + prompt`，输出 `mask/标注图/结构化结果`，并把后续 PNG 抠图交给后端自己的 PNG 生成模块处理。

## 1. 推荐接入方式（进程内调用）

直接在后端代码里 import 并调用 `lang_sam.LangSAM`：

```python
from PIL import Image
from lang_sam import LangSAM

model = LangSAM(sam_type="sam2.1_hiera_small")  # 建议服务启动时初始化一次，复用单例

image_pil = Image.open(image_path).convert("RGB")
results = model.predict(
    images_pil=[image_pil],
    texts_prompt=[text_prompt],   # 例如 "cup." 或 "kiwi. watermelon."
    box_threshold=0.3,
    text_threshold=0.25,
)
result0 = results[0]
```

### `/segment/lang` 伪代码（FastAPI 风格）

下面示例只演示 LangSAM 的调用点；`uploads/`、`masks/`、`pngs/` 的落盘和 URL 返回格式请按后端工程约定实现。

```python
from fastapi import APIRouter, UploadFile, File, Form

router = APIRouter()
model = LangSAM(sam_type="sam2.1_hiera_small")  # 启动时初始化一次

@router.post("/segment/lang")
async def segment_lang(
    image: UploadFile = File(...),
    text_prompt: str = Form(...),
    sam_type: str = Form("sam2.1_hiera_small"),
    box_threshold: float = Form(0.3),
    text_threshold: float = Form(0.25),
):
    image_pil = Image.open(image.file).convert("RGB")
    results = model.predict([image_pil], [text_prompt], box_threshold=box_threshold, text_threshold=text_threshold)
    result0 = results[0]

    # TODO: 把 result0["masks"] 合并/保存到 masks/，再生成透明 PNG 到 pngs/
    return {
        "status": "success",
        "method": "lang",
        "boxes": result0["boxes"].tolist() if hasattr(result0["boxes"], "tolist") else result0["boxes"],
        "labels": result0["labels"],
    }
```

### `LangSAM.predict(...)` 输入参数

| 参数 | 类型 | 必填 | 示例 | 说明 |
| --- | --- | --- | --- | --- |
| `images_pil` | `list[PIL.Image.Image]` | 是 | `[image_pil]` | 可批量预测，后端接口通常传 1 张图即可 |
| `texts_prompt` | `list[str]` | 是 | `["person."]` | 与 `images_pil` 一一对应 |
| `box_threshold` | `float` | 否 | `0.3` | GroundingDINO 检测框阈值 |
| `text_threshold` | `float` | 否 | `0.25` | 文本匹配阈值 |

### `LangSAM.predict(...)` 返回结构

返回 `list[dict]`，每张图对应一个 dict。常用字段如下：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `boxes` | `np.ndarray` | 检测框坐标，通常为 `xyxy` |
| `scores` | `np.ndarray` | 检测分数 |
| `labels` | `list[str]` | 文本标签 |
| `masks` | `np.ndarray` | mask，形状通常为 `[N, H, W]` 或 `[H, W]`（取决于命中数量） |
| `mask_scores` | `np.ndarray` | mask 质量分数 |

备注：如果 prompt 未命中目标，`labels` 可能为空，`masks` 为空数组，此时应返回“未检测到目标”的业务状态。

## 2. mask 导出建议（后端保存到 `masks/`）

后端常见做法是把多实例 mask 合并成 1 张二值 mask，再保存为 PNG：

```python
import numpy as np
from PIL import Image

masks = result0["masks"]  # 可能是 [N,H,W]
if masks is None or len(masks) == 0:
    merged = None
else:
    merged = np.any(masks.astype(bool), axis=0)  # [H,W]
    mask_img = Image.fromarray((merged.astype(np.uint8) * 255), mode="L")
    mask_img.save(mask_path)
```

如果希望保留每个实例的 mask，可逐个保存：`mask_0.png`、`mask_1.png`。

## 3. 标注图导出（可选，用于调试/验收截图）

项目自带工具函数可把 mask + 框 + 标签画回原图：

```python
import numpy as np
from lang_sam.utils import draw_image

image_array = np.asarray(image_pil)
annotated = draw_image(
    image_array,
    result0["masks"],
    result0["boxes"],
    result0["scores"],
    result0["labels"],
)
Image.fromarray(annotated).save(annotated_path)
```

## 4. 另一种方式（进程外调用：HTTP `/predict`）

如果后端不想直接引入 Python 模型依赖，可把 LangSAM 当成独立服务启动：

```text
cd /d A:\_Sofaware\项目\lang-segment-anything-main
conda activate sam2_env
python lang_sam\server.py
```

该服务提供：

- URL：`http://localhost:8000/predict`
- 输入：`multipart/form-data`
  - `image`: 图片文件
  - `sam_type`: 例如 `sam2.1_hiera_small`
  - `box_threshold`: 例如 `0.3`
  - `text_threshold`: 例如 `0.25`
  - `text_prompt`: 例如 `person.`
- 输出：`image/png`（已叠加 mask/框/标签的结果图）

备注：此方式返回的是“标注图 PNG”，如果后端需要“二值 mask”用于 PNG 抠图，建议使用进程内调用拿到 `masks` 数组，或自行改造服务返回 mask。
