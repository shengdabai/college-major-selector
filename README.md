# 智慧大学 · 高考志愿决策参考工具

> 为高中生准备的大学与专业对照工具 — 支持任意省份数据 · 接入 AI 大模型

**[English README →](README_EN.md)**

![首页](docs/screenshot-01-home.png)

---

基于教育部公开数据（**2,756 所院校 · 860 个本科专业**），支持上传任意省份录取数据，提供五种维度的志愿决策参考。纯静态网页，无需后端，无需注册，完全离线可用。**全国通用**：不内置任何省份的考生/录取数据，录取数据由用户在本地浏览器上传，不经过任何服务器。

---

## 五种使用模式

| 模式 | 说明 |
|------|------|
| **01 地域 → 学校 → 专业** | 按省份/城市/等级/类型筛选院校，展开查看开设专业与优势专业 |
| **02 专业 → 地域 → 学校** | 选定专业后反查全国开设院校，支持按省份/等级/优势二次筛选 |
| **03 录取数据 · 分数推荐** | 上传本省录取 JSON 后，按位次生成冲/稳/保三档志愿推荐（推荐数量按本省平行志愿数自动调整） |
| **04 大学专业顾问** | 接入任意 OpenAI 兼容 AI 大模型（ChatGPT 或国内主流 API），内置高考志愿专家系统提示词 |
| **05 各省志愿规则** | 全国 31 省高考模式（3+3 / 3+1+2 / 文理）、志愿模式、平行志愿数量、批次速查 |

---

## 快速启动

```bash
git clone https://github.com/shengdabai/college-major-selector.git
cd college-major-selector

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

不会写代码？直接在网页模式三点击「**下载 JSON 模板/示例**」，照着模板手工填几条即可。也可参照 `scripts/build_admission_json.py`（通用模板，按你 Excel 表头改字段映射）批量转换，支持同时上传多个年份文件。

---

## 模式四：AI 大学专业顾问

![AI顾问](docs/screenshot-04-advisor.png)

在左侧用「**服务商快选**」选择一家大模型（自动填入地址与模型），填入 API Key，点击「保存配置并连接」，AI 顾问自动发送开场白即可开始对话。默认示例为 OpenAI（ChatGPT），**也可一键切换为国内主流大模型**，或填任意自建/代理服务。

| 服务商 | API Base URL | 推荐模型 |
|--------|-------------|----------|
| OpenAI（ChatGPT） | `https://api.openai.com/v1` | `gpt-4o` |
| DeepSeek 深度求索 | `https://api.deepseek.com/v1` | `deepseek-chat` |
| 阿里云百炼 · 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-max` |
| Moonshot · Kimi | `https://api.moonshot.cn/v1` | `moonshot-v1-8k` |
| 智谱 AI · GLM | `https://open.bigmodel.cn/api/paas/v4` | `glm-4-plus` |
| 火山方舟 · 豆包 | `https://ark.cn-beijing.volces.com/api/v3` | `doubao-pro-32k` |
| 百度千帆 · 文心 | `https://qianfan.baidubce.com/v2` | `ernie-4.5-turbo-8k` |
| 腾讯混元 | `https://api.hunyuan.cloud.tencent.com/v1` | `hunyuan-turbo` |
| MiniMax | `https://api.minimax.chat/v1` | `abab6.5s-chat` |
| 硅基流动（聚合） | `https://api.siliconflow.cn/v1` | `deepseek-ai/DeepSeek-V3` |
| 任意自建/代理 | 你的代理地址 | 对应模型名 |

> 各服务商的接口地址/模型名可能随官方更新调整，以服务商官方文档为准。

- 系统提示词内置固定，无需用户设置，确保专业顾问水准
- API Key 仅存于本地浏览器，不会上传至任何服务器

---

## 模式五：各省志愿规则

全国 31 省的高考与志愿规则速查：高考模式（3+3 / 3+1+2 / 传统文理）、志愿模式（院校专业组 / 专业+院校）、本科批平行志愿数量、批次设置，以及各省教育考试院官方入口。选定省份后了解本省规则，再回到模式三上传本省数据，系统会按你省的平行志愿数量给出冲 / 稳 / 保推荐。

> 规则数据为公开信息整理（`data/province_rules.json`），仅供参考，最终以各省教育考试院当年正式公告为准。

---

## 项目结构

```
.
├── index.html              # 主页面（单文件 SPA）
├── app.js                  # 全部交互逻辑
├── data/
│   ├── universities.json   # 全国高校数据（2,756 所）
│   ├── majors.json         # 本科专业目录（860 个）
│   └── province_rules.json # 全国 31 省志愿填报规则
├── scripts/
│   ├── build_admission_json.py    # 录取数据转 JSON 通用模板（按需改字段映射）
│   ├── parse_data.py              # 院校/专业公开数据解析
│   └── build_relations.py         # 院校-专业关系（启发式）
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
