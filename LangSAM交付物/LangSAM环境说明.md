# LangSAM 环境说明

## 1. 当前使用的环境

本项目实际运行环境是 Conda 环境 `sam2_env`。

| 项目 | 当前值 |
| --- | --- |
| Conda 环境名 | `sam2_env` |
| Python 路径 | `B:\_environment\Conda\envs\sam2_env\python.exe` |
| Python 版本 | Python 3.10.20 |
| 主项目目录 | `A:\_Sofaware\项目\lang-segment-anything-main` |
| 交付目录 | `A:\_Sofaware\项目\LangSAM交付物` |
| Conda 环境文件 | `A:\_Sofaware\项目\lang-segment-anything-main\项目environment.yml` |
| 环境检查脚本 | `A:\_Sofaware\项目\lang-segment-anything-main\环境测试.py` |

注意：不要直接使用系统默认 Python。当前 PowerShell 默认 Python 是 3.13.1，不是本项目实际运行环境。

## 2. 当前依赖情况

已在 `sam2_env` 中执行 `环境测试.py`，主要依赖满足项目要求。

| 依赖包 | 项目要求 | 当前环境版本 | 说明 |
| --- | --- | --- | --- |
| torch | >= 2.3.1 | 2.6.0+cu124 | 深度学习框架 |
| torchvision | >= 0.18.1 | 0.21.0+cu124 | 图像处理和视觉组件 |
| transformers | >= 4.44.2 | 5.8.0 | GroundingDINO 文本检测模型 |
| sam-2 | Git 安装 | 已安装 | SAM2 分割模型 |
| supervision | >= 0.23.0 | 0.28.0 | 绘制 mask、框和标签 |
| opencv-python-headless | >= 4.10.0.84 | 4.13.0.92 | 图像处理 |
| litserve | >= 0.2.8 | 0.2.17 | 后端推理服务 |
| gradio | >= 5.29.0 | 6.14.0 | 网页交互界面 |

如果接手人不确定依赖是否完整，应优先进入 `sam2_env` 后运行：

```text
python 环境测试.py
```

如果换到新机器或环境损坏，可用项目里的 Conda 环境文件重新创建或更新环境：

```text
conda env create -f 项目environment.yml
```

或在已有 `sam2_env` 上更新：

```text
conda env update -n sam2_env -f 项目environment.yml
```

## 3. 模型权重位置

SAM2 权重文件保存在项目目录内：

```text
A:\_Sofaware\项目\lang-segment-anything-main\torch\hub\checkpoints
```

当前已存在的权重文件：

| 文件名 | 说明 |
| --- | --- |
| `sam2.1_hiera_small.pt` | 默认演示使用的小模型权重 |
| `sam2.1_hiera_large.pt` | 大模型权重 |

代码已调整为优先从项目内 `torch\hub\checkpoints` 加载 SAM2 权重；如果缺少对应权重，才会下载到该目录。

GroundingDINO 默认从 Hugging Face Hub 加载：`IDEA-Research/grounding-dino-base`。

## 4. 主要运行文件

| 文件 | 作用 |
| --- | --- |
| `app.py` | 启动 LitServe 后端和 Gradio 页面 |
| `lang_sam\server.py` | LitServe 推理服务，提供 `/predict` 接口 |
| `环境测试.py` | 检查核心依赖是否安装且版本满足要求 |
| `项目environment.yml` | Conda 环境配置文件 |

项目目录中还存在一份嵌套副本 `lang-segment-anything-main\lang-segment-anything-main`。本交付说明以外层项目目录为准。
