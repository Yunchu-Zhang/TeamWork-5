# LangSAM 环境说明

## 1. 项目位置

- 主项目目录：`A:\_Sofaware\项目\lang-segment-anything-main`
- 本次交付目录：`A:\_Sofaware\项目\LangSAM交付物`
- Gradio 启动文件：`A:\_Sofaware\项目\lang-segment-anything-main\app.py`
- 服务端文件：`A:\_Sofaware\项目\lang-segment-anything-main\lang_sam\server.py`
- 环境检查脚本：`A:\_Sofaware\项目\lang-segment-anything-main\环境测试.py`

注意：项目目录中还存在一份嵌套副本 `lang-segment-anything-main\lang-segment-anything-main`。本说明以外层项目目录为准。

## 2. Python 版本

- 项目 `pyproject.toml` 要求：Python >= 3.10
- 建议演示环境：Python 3.10 或 Python 3.11


## 3. 主要依赖包

项目 `requirements.txt` 中的主要依赖如下：

| 依赖包 | 要求版本/来源 | 用途 |
| --- | --- | --- |
| torch | >= 2.3.1 | 深度学习运行框架 |
| torchvision | >= 0.18.1 | 图像处理和 PyTorch 视觉组件 |
| transformers | >= 4.44.2 | 加载 GroundingDINO 文本检测模型 |
| sam-2 | GitHub: facebookresearch/segment-anything-2 | SAM 2 分割模型 |
| supervision | >= 0.23.0 | 绘制检测框、mask、标签 |
| opencv-python-headless | >= 4.10.0.84 | 图像处理 |
| litserve | >= 0.2.8 | 推理服务接口 |
| gradio | >= 5.29.0 | 网页交互界面 |


## 4. 模型文件位置

当前项目目录内未发现 `.pt`、`.pth`、`.safetensors`、`.ckpt` 等本地模型权重文件。

代码默认模型加载方式：

| 模型 | 默认来源 | 代码位置 |
| --- | --- | --- |
| SAM 2.1 | `https://dl.fbaipublicfiles.com/segment_anything_2/...` 自动下载 | `lang_sam\models\sam.py` |
| GroundingDINO | Hugging Face Hub：`IDEA-Research/grounding-dino-base` | `lang_sam\models\gdino.py` |

如果需要离线运行，可以在代码中使用：

```python
LangSAM(
    sam_ckpt_path="本地 SAM2 权重路径",
    gdino_model_ckpt_path="本地 GroundingDINO 模型目录",
    gdino_processor_ckpt_path="本地 GroundingDINO processor 目录",
)
```

联网运行时，模型通常会缓存到用户目录下的 PyTorch/Hugging Face 缓存目录，例如：

- `%USERPROFILE%\.cache\torch`
- `%USERPROFILE%\.cache\huggingface`

## 5. 本次可交付截图

成功案例截图来自项目自带输出：

- `案例截图\成功案例1_car_wheel.png`
- `案例截图\成功案例2_fruits.png`
- `案例截图\成功案例3_person.png`

失败案例截图为当前环境无法启动的说明图：

- `案例截图\失败案例1_当前环境依赖缺失无法启动.png`

