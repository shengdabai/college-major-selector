# 智慧大学 · 高考志愿决策参考工具

> 为高中生准备的大学与专业对照工具 — 支持任意省份数据 · 接入 AI 大模型

**[English README →](README_EN.md)**

![首页](docs/screenshot-01-home.png)

---

基于教育部公开数据（**2,756 所院校 · 860 个本科专业**），支持上传任意省份录取数据，提供四种维度的志愿决策参考。纯静态网页，无需后端，无需注册，完全离线可用。

---

## 四种使用模式

| 模式 | 说明 |
|------|------|
| **01 地域 → 学校 → 专业** | 按省份/城市/等级/类型筛选院校，展开查看开设专业与优势专业 |
| **02 专业 → 地域 → 学校** | 选定专业后反查全国开设院校，支持按省份/等级/优势二次筛选 |
| **03 录取数据 · 分数推荐** | 上传本省录取 JSON 后，按位次生成冲/稳/保三档志愿推荐 |
| **04 大学专业顾问** | 接入任意 OpenAI 兼容 AI 大模型，内置高考志愿专家系统提示词 |

---

## 快速启动

```bash
git clone https://github.com/shengdabai/university-major-selector.git
cd university-major-selector

# 启动本地服务器（任选其一）
python3 -m http.server 8000
# 或
npx serve .

# 浏览器访问
open http://localhost:8000
```

> 不能直接双击 `index.html`，浏览器会拦截 `fetch` 请求，必须通过本地服务器访问。

---

## 模式二：专业 → 学校

![专业筛选](docs/screenshot-02-major.png)

按学科门类三级钻取（门类 → 专业类 → 专业），反查全国开设该专业的院校，支持按省份、办学层次、是否优势专业二次筛选。

---

## 模式三：上传省份数据 · 分数推荐

![录取数据上传](docs/screenshot-03-score.png)

### 所需原始数据

- 历年**招生计划**（含院校、专业、计划人数、学费、选科要求）
- 历年**专业录取分数**（最低分、最低位次）
- 历年**院校录取分数**（最低分、最低位次）
- 历年**一分一段表**（分数 → 累计人数）

数据来源：各省招生考试信息网（均为公开数据）

### JSON 格式

文件名需包含 4 位数字年份（如 `2024.json`），格式如下：

```json
{
  "plans": [...],
  "majorScores": [...],
  "schoolScores": [...],
  "rankTable": [{ "score": 680, "cum": 120 }],
  "_meta": { "province": "某省", "year": 2024, "subject": "物理类" }
}
```

参照 `scripts/parse_qinghai_history.py` 修改字段映射生成 JSON，支持同时上传多个年份文件。

---

## 模式四：AI 大学专业顾问

![AI顾问](docs/screenshot-04-advisor.png)

在左侧填入 API 配置，点击「保存配置并连接」，AI 顾问自动发送开场白，即可开始对话。

| 服务商 | API Base URL | 推荐模型 |
|--------|-------------|----------|
| OpenAI | `https://api.openai.com/v1` | `gpt-4o` |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| 阿里百炼 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-max` |
| 任意代理 | 你的代理地址 | 对应模型名 |

- 系统提示词内置固定，无需用户设置，确保专业顾问水准
- API Key 仅存于本地浏览器，不会上传至任何服务器

---

## 项目结构

```
.
├── index.html              # 主页面（单文件 SPA）
├── app.js                  # 全部交互逻辑
├── data/
│   ├── universities.json   # 全国高校数据（2,756 所）
│   └── majors.json         # 本科专业目录（860 个）
├── scripts/
│   └── parse_qinghai_history.py   # 数据处理脚本（可按需修改）
└── docs/
    └── screenshot-*.png    # 界面截图
```

---

## 数据来源

- 教育部《全国普通高等学校名单》(2021)
- 《普通高等学校本科专业目录》(2026)
- 985 / 211 / 双一流官方公示名单
- 录取数据：由用户自行上传，项目本身不内置任何省份录取数据

## 免责声明

- "开设专业""优势专业"为基于学校类型的启发式推断，非官方数据
- 分数推荐基于历年位次比例，仅供参考，不构成志愿填报建议
- 最终请以学校招生章程与省教育考试院官方公告为准

---

## License

MIT — 自由使用，欢迎 PR 和 Issue。
