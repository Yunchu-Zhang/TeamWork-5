# 后端交付给组员说明

本压缩包用于小组内部联调与验收，不包含个人实验报告。

## 目录说明

```text
backend/              FastAPI 后端代码
tests/                PNG 导出与 mask 处理测试
docs/                 后端运行说明、接口说明、验收记录、SAM2 接入记录
evidence_screenshots/ 后端实际运行截图材料
sample_images/        组员测试图片样例
sample_outputs/       已生成的 uploads、masks、pngs 示例输出
```

## 启动方式

建议将本包内容放入项目根目录后运行：

```bash
pip install -r docs/requirements.txt
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

启动后访问：

```text
http://127.0.0.1:8000/
http://127.0.0.1:8000/docs
http://127.0.0.1:8000/outputs
```

## 已实现接口

```text
GET  /health
POST /upload
POST /segment/point
POST /segment/lang
GET  /api/outputs
```

两个分割接口统一返回：

```json
{
  "status": "success",
  "method": "point 或 lang",
  "original_url": "/uploads/xxx.jpg",
  "mask_url": "/masks/xxx_mask.png",
  "png_url": "/pngs/xxx_object.png",
  "message": "..."
}
```

## 说明

- `/segment/point` 支持 `point_type=positive/negative`，也兼容 SAM2 草案字段 `point_label=1/0`。
- `/segment/lang` 使用 `prompt` 字段，支持前端传入英文目标词。
- `sample_outputs/` 中的文件是使用组员测试图片实际调用后端生成的结果。
- 个人实验报告未放入本交付包。

