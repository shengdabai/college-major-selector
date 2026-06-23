# college-major-selector

高考志愿决策参考工具：上传任意省份录取数据，生成冲稳保推荐 + 内置 AI 大学专业顾问，纯静态零后端

## Business Context

- **Category:** education product
- **Audience:** learners, teachers, parents, and education operators who need a clearer learning or exam-prep workflow.
- **Repository status:** Public repository. Keep examples, docs, and issues free of credentials, private data, and machine-specific paths.
- **Topics:** ai, china, college-admissions, college-application, edtech, education, gaokao, javascript, static-site

## What This Project Is For

- 高考志愿决策参考工具：上传任意省份录取数据，生成冲稳保推荐 + 内置 AI 大学专业顾问，纯静态零后端.
- Give users a concrete learning workflow instead of a loose collection of content.
- Make practice, feedback, review, or recommendation steps easier to repeat.

## Where It Fits

This repository supports productized learning workflows: diagnostic input, guided practice, review loops, and clearer handoff between learner, teacher, and software.

## Technical Overview

- **Primary language:** JavaScript
- **Detected stack:** JavaScript
- **Default branch:** `main`
- **Visibility:** `PUBLIC`
- **License:** MIT License

## Repository Map

- `docs`
- `scripts`
- `data`
- `LICENSE`
- `README.md`
- `SECURITY.md`
- `app.js`
- `index.html`

## Quick Start

Use the commands that match the current project state:

```bash
python3 -m http.server 8000
```

| Command | Purpose |
|---|---|
| `python3 -m http.server 8000` | Preview static files locally. |

## Operating Notes

- Keep real credentials out of the repository. Use local environment files, GitHub repository secrets, or the deployment platform secret manager.
- If a `.env.example` file exists, treat it as documentation only; never commit filled-in `.env` files.
- Before publishing screenshots, demos, or client examples, remove private names, internal paths, account IDs, and API endpoints.
- The `Repository Hygiene` workflow is a lightweight guardrail, not a replacement for product-specific tests.

## Delivery Checklist

- [ ] README describes the user, business outcome, and operating boundary.
- [ ] Setup or preview commands are current and do not rely on private machine state.
- [ ] No real secrets, private user data, or machine-local state are tracked.
- [ ] Screenshots, demos, or sample outputs are safe to share publicly when the repository is public.
- [ ] Product-specific tests or smoke checks are documented before production use.

## Roadmap

- Tighten the fastest path from clone to useful demo.
- Add project-specific screenshots, sample outputs, or a short walkthrough where useful.
- Promote repeated manual steps into scripts, tests, or documented workflows.
- Keep security, privacy, and licensing boundaries explicit as the project evolves.

## Maintainer Notes

Maintained by [Tony Sheng](https://github.com/shengdabai). This README is written as a business-facing handoff: it should help a future collaborator, client, or reviewer understand why the repository exists, how to inspect it, and what must be true before it is reused or shipped.

---

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
- ⚠️ **隐私提示**：API Key 通过 `localStorage` 明文保存在浏览器本地存储中。使用完毕后，可在浏览器开发者工具（F12 → Application → Local Storage）手动清除，避免在公共设备上留存。

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

可用且持续打磨中。当前为单文件静态站，已覆盖四种决策模式。录取数据由用户自行上传——项目本身不内置任何省份录取数据。欢迎贡献各省的数据处理脚本与界面改进。

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

本项目使用 [MIT License](LICENSE)。
