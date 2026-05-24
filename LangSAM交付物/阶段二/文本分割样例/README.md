# 文本分割样例

本目录用于存放 LangSAM 文本分割的输出图（用于接入验收/回归对照）。

建议样例至少包含：

- 1 张单目标（如 `wheel.`）
- 1 张多目标（如 `kiwi. watermelon. blueberry.`）
- 1 张人物（如 `person.`）

当前样例来自项目自带 `assets/outputs` 输出文件，后续联调 `/segment/lang` 后可替换为后端实际接口输出结果。

| 样例 | 输入图 | Prompt | 输出图 |
| --- | --- | --- | --- |
| 1 | `样例1_car_input.jpeg` | `wheel.` | `样例1_car_wheel_output.png` |
| 2 | `样例2_fruits_input.jpg` | `kiwi. watermelon. blueberry.` | `样例2_fruits_output.png` |
| 3 | `样例3_person_input.jpg` | `person.` | `样例3_person_output.png` |
