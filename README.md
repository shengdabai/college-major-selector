# 🎓 智慧大学 · 高考志愿决策参考工具

> 为高中生与家长准备的大学 / 专业对照与志愿决策工具 — 支持任意省份录取数据 · 冲稳保推荐 · 内置 AI 大学专业顾问

[![last commit](https://img.shields.io/github/last-commit/shengdabai/college-major-selector)](https://github.com/shengdabai/college-major-selector/commits)
[![stars](https://img.shields.io/github/stars/shengdabai/college-major-selector?style=social)](https://github.com/shengdabai/college-major-selector/stargazers)
[![follow @shengdabai](https://img.shields.io/github/followers/shengdabai?style=social)](https://github.com/shengdabai)

**[English README →](README_EN.md)**

![首页](docs/screenshot-01-home.png)

---

## 这是什么

一个**纯静态、零后端、零注册**的高考志愿决策参考工具。基于教育部公开数据（**2,756 所院校 · 860 个本科专业**），你可以上传本省的录取数据，得到冲 / 稳 / 保三档志愿推荐，还能接入任意 AI 大模型作为你的专属大学专业顾问。

打开网页即用，数据全部留在本地浏览器，完全离线可跑。

## 为什么做它

每年高考填志愿，信息分散在十几个网站、几本厚厚的招生册子里。位次怎么换算、哪些学校能冲、哪些专业值得报，普通家庭往往只能凭感觉。

这个工具把**公开院校数据 + 你自己的录取数据 + AI 顾问**整合到一个页面里，让填报决策有据可依，而不是赌运气。

---

## ✨ 功能

| 模式 | 说明 |
|------|------|
| **01 地域 → 学校 → 专业** | 按省份 / 城市 / 等级（985/211/双一流）/ 类型筛选院校，展开查看开设专业与优势专业 |
| **02 专业 → 地域 → 学校** | 按学科门类三级钻取（门类 → 专业类 → 专业），反查全国开设该专业的院校，可二次筛选 |
| **03 录取数据 · 冲稳保推荐** | 上传本省录取 JSON 后，按等效位次比例自动生成冲 / 稳 / 保三档志愿推荐，每条标注当年最低分与最低位次 |
| **04 AI 大学专业顾问** | 接入任意 OpenAI 兼容大模型，内置高考志愿专家系统提示词，建立用户画像并输出可填报的志愿方案 |

**冲稳保的算法逻辑**：以你的等效位次为基准——
- 🔴 **冲一冲**：录取位次比你高 15%–50%（敢于尝试，难度较大）
- 🟠 **稳一稳**：录取位次与你相近 ±15%（命中率高，志愿主体）
- 🟢 **保一保**：录取位次比你低 15%–80%（兜底防滑档）

---

## 🧱 技术栈

- **纯前端单页应用**：`index.html` + `app.js`，无构建步骤、无依赖安装
- **Tailwind CSS**（CDN）+ Noto Serif SC / Inter / JetBrains Mono 字体
- **原生 JavaScript**，无框架
- **Python 脚本**用于把各省原始数据解析成统一 JSON 格式
- **AI 顾问**通过浏览器直连 OpenAI 兼容接口（`/chat/completions`），API Key 仅存本地

---

## 🚀 快速开始

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

> ⚠️ 不能直接双击 `index.html`，浏览器会拦截 `fetch` 请求，必须通过本地服务器访问。

---

## 📖 使用说明

### 怎么上传录取数据（模式三）

1. 准备本省的四类原始数据（均来自各省招生考试信息网公开数据）：
   - 历年**招生计划**（院校、专业、计划人数、学费、选科要求）
   - 历年**专业录取分数**（最低分、最低位次）
   - 历年**院校录取分数**（最低分、最低位次）
   - 历年**一分一段表**（分数 → 累计人数）
2. 整理成 JSON，文件名需包含 4 位数字年份（如 `2024.json`）：

   ```json
   {
     "plans": [...],
     "majorScores": [...],
     "schoolScores": [...],
     "rankTable": [{ "score": 680, "cum": 120 }],
     "_meta": { "province": "某省", "year": 2024, "subject": "物理类" }
   }
   ```

   可参照 `scripts/parse_qinghai_history.py` 修改字段映射生成 JSON，支持同时上传多个年份文件。
3. 上传后输入你的分数或位次，工具会换算等效位次并生成冲 / 稳 / 保推荐。

![录取数据上传](docs/screenshot-03-score.png)

### 怎么用 AI 顾问（模式四）

在左侧填入 API 配置，点击「保存配置并连接」，AI 顾问会自动发送开场白，即可开始对话。

| 服务商 | API Base URL | 推荐模型 |
|--------|-------------|----------|
| OpenAI | `https://api.openai.com/v1` | `gpt-4o` |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| 阿里百炼 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-max` |
| 任意代理 | 你的代理地址 | 对应模型名 |

- 系统提示词内置固定，无需用户设置，确保专业顾问水准
- API Key 仅存于本地浏览器，**不会上传至任何服务器**

![AI顾问](docs/screenshot-04-advisor.png)

---

## 📁 项目结构

```
.
├── index.html              # 主页面（单文件 SPA）
├── app.js                  # 全部交互逻辑（含冲稳保算法 + AI 顾问）
├── data/
│   ├── universities.json   # 全国高校数据（2,756 所）
│   ├── majors.json         # 本科专业目录（860 个）
│   └── major_index.json    # 专业 → 院校反查索引
├── scripts/
│   └── parse_*.py          # 各省数据处理脚本（可按需修改字段映射）
└── docs/
    └── screenshot-*.png    # 界面截图
```

---

## 🗺️ 状态

可用且持续打磨中。当前为单文件静态站，已覆盖四种决策模式。录取数据由用户自行上传——项目本身不内置任何省份录取数据。欢迎贡献各省的数据解析脚本与界面改进。

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

## 🤝 关于与连接

我是 **Tony（盛）**，一名中文培训师，教过 6000+ 名学员。我用 AI 打造中文教学与高考备考工具，让普通家庭也能用上原本需要付费咨询才能获得的决策支持。

如果这个工具对你有帮助，欢迎 ⭐ **[Star 本项目](https://github.com/shengdabai/college-major-selector)** 并关注 **[@shengdabai](https://github.com/shengdabai)**，你的支持是我持续维护的动力。

**配套的高考备考工具：**

- [gaokao-review](https://github.com/shengdabai/gaokao-review) — 高考复习工具
- [gaokao-600](https://github.com/shengdabai/gaokao-600) — 高考 600 分提分工具
- [gaokao-assistant](https://github.com/shengdabai/gaokao-assistant) — 高考备考助手

---

## License

暂无开源协议（保留所有权利）。如需复用，欢迎先开 Issue 沟通。
