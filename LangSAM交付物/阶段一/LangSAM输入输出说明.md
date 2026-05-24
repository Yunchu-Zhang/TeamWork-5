# LangSAM 输入输出说明

## 1. 输入格式

LangSAM 的核心输入包含两部分：

| 输入项 | 格式 | 示例 | 说明 |
| --- | --- | --- | --- |
| 图片 | 本地图片路径或网页上传图片 | `assets\car.jpeg` | 支持常见图片格式，如 JPG、JPEG、PNG |
| 文本提示词 | 英文目标词或短语 | `wheel.`、`person.`、`cup.` | 建议使用英文，多个目标可用英文句点分隔 |
| Box Threshold | 小数，0 到 1 | `0.3` | GroundingDINO 检测框置信度阈值 |
| Text Threshold | 小数，0 到 1 | `0.25` | 文本匹配置信度阈值 |
| SAM Model | 下拉选择 | `sam2.1_hiera_small` | SAM2 模型大小，越大通常越慢、效果可能更好 |

Gradio 页面中，图片通过 `Input Image` 上传，提示词写在 `Text Prompt` 输入框中。

Python 调用示例：

```python
from PIL import Image
from lang_sam import LangSAM

model = LangSAM()
image_pil = Image.open("./assets/car.jpeg").convert("RGB")
results = model.predict([image_pil], ["wheel."])
```

## 2. 文本提示词写法

建议：

- 使用英文名词，不要使用中文。
- 单目标可以写 `cup.`、`chair.`、`person.`。
- 多目标可以写 `kiwi. watermelon. blueberry.`。
- 目标词尽量具体，避免太抽象。
- 代码会自动给没有句点的 prompt 补上句点，但手动写句点更清晰。

不建议：

- 使用很长的中文描述。
- 使用过于抽象的词，例如 `thing`、`object`。
- 对非常小、被遮挡、背景复杂的目标期待稳定识别。

## 3. 输出格式

网页输出：

| 输出项 | 形式 | 说明 |
| --- | --- | --- |
| Output Image | PNG/RGB 图片 | 在原图上叠加 mask、检测框、分数和标签 |

接口输出：

| 输出项 | 形式 | 说明 |
| --- | --- | --- |
| HTTP Response | `image/png` | `/predict` 接口返回处理后的 PNG 图片 |

Python `model.predict()` 输出：

```python
[
    {
        "boxes": ndarray,
        "scores": ndarray,
        "labels": list,
        "masks": ndarray,
        "mask_scores": ndarray,
    }
]
```

字段含义：

| 字段 | 说明 |
| --- | --- |
| boxes | 检测框坐标，通常为 xyxy 格式 |
| scores | GroundingDINO 检测分数 |
| labels | 识别到的文本标签 |
| masks | SAM2 输出的分割 mask |
| mask_scores | mask 质量分数 |

## 4. 输出保存位置

当前 `app.py` 的 Gradio 页面只在网页右侧显示结果，不会自动保存新图片。

项目自带示例输出位于：

```text
A:\_Sofaware\项目\lang-segment-anything-main\assets\outputs
```

本次整理后的交付截图位于：

```text
A:\_Sofaware\项目\LangSAM交付物\案例截图
```

## 5. 成功案例截图

| 文件名 | 输入图片 | Prompt | 输出说明 |
| --- | --- | --- | --- |
| `成功案例1_car_wheel.png` | `assets\car.jpeg` | `wheel.` | 成功分割汽车轮胎 |
| `成功案例2_fruits.png` | `assets\fruits.jpg` | `kiwi. watermelon. blueberry.` | 成功分割多种水果 |
| `成功案例3_person.png` | `assets\person.jpg` | `person.` | 成功分割人物 |

## 6. 失败案例截图

| 文件名 | 类型 | 说明 |
| --- | --- | --- |
| `失败案例1_当前环境依赖缺失无法启动.png` | 环境失败 | 未进入 `sam2_env`、直接使用系统默认 Python 时，会缺少 Gradio、LitServe、Transformers、SAM2 等依赖，导致无法启动 |

说明：`sam2_env` 中依赖已经满足要求。当前这张失败图属于环境使用错误案例，不是“目标太小、背景复杂、文本识别失败”这一类真实模型推理失败案例。正式验收如果严格要求失败案例截图，建议再补充一张真实推理失败图。

## 7. Prompt 示例表

| Prompt | 稳定程度 | 适用场景 | 备注 |
| --- | --- | --- | --- |
| `person.` | 高 | 人物、行人、全身或半身照 | 常见类别，通常较稳定 |
| `car.` | 高 | 汽车整体 | 车辆清晰时效果好 |
| `wheel.` | 高 | 汽车、自行车轮子 | 项目自带成功案例 |
| `dog.` | 高 | 狗 | 动物主体清晰时稳定 |
| `cat.` | 高 | 猫 | 背景简单时效果好 |
| `cup.` | 中高 | 杯子、水杯 | 目标太小或透明杯可能失败 |
| `chair.` | 中高 | 椅子 | 多把椅子重叠时可能漏检 |
| `book.` | 中 | 书、本子 | 与桌面背景相近时可能失败 |
| `phone.` | 中 | 手机 | 小目标或反光时不稳定 |
| `bottle.` | 中高 | 瓶子 | 透明瓶、遮挡瓶可能不稳定 |
| `kiwi.` | 中高 | 水果 | 项目自带多水果案例 |
| `watermelon.` | 中高 | 水果 | 项目自带多水果案例 |
| `blueberry.` | 中 | 小水果 | 单个目标太小时可能漏检 |
| `food.` | 中 | 食物整体 | 类别较宽泛，mask 可能不够精确 |
| `thing.` | 低 | 不建议 | 过于抽象，识别不稳定 |
