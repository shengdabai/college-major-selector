# University Major Selector · Gaokao Decision Tool

> A browser-based tool for Chinese high school students — supports any province's data · plug in any AI model

**[中文说明 →](README.md)**

![Homepage](docs/screenshot-01-home.png)

---

Built on Ministry of Education public data (**2,756 universities · 860 undergraduate majors**), this tool helps students and parents make informed university and major choices. Pure static HTML — no backend, no registration, works fully offline. **Nationwide**: no province's candidate/admission data is bundled; admission data is uploaded by the user and parsed locally in the browser, never sent to any server.

---

## Five Modes

| Mode | Description |
|------|-------------|
| **01 Region → School → Major** | Filter universities by province/city/tier/type; view majors offered |
| **02 Major → School** | Pick a major, find all universities offering it nationwide |
| **03 Score-Based Recommendation** | Upload your province's admission data; get reach/match/safety recommendations (count adapts to your province's parallel-choice quota) |
| **04 AI University Advisor** | Connect any OpenAI-compatible AI (ChatGPT or major Chinese providers); system prompt is fixed by expert advisors |
| **05 Provincial Rules** | Quick reference of all 31 provinces' exam modes (3+3 / 3+1+2 / traditional), voluntary modes, parallel-choice counts, and batches |

---

## Quick Start

```bash
git clone https://github.com/shengdabai/college-major-selector.git
cd college-major-selector

# Start a local server (pick one)
python3 -m http.server 8000
# or
npx serve .

# Open in browser
open http://localhost:8000
```

> You must use a local server — opening `index.html` directly will fail due to browser `fetch` restrictions.

---

## Mode 2: Major → School

![Major Filter](docs/screenshot-02-major.png)

Three-level drill-down: discipline category → subject group → specific major. Filter results by province, university tier, and whether it's a featured/key program.

---

## Mode 3: Upload Province Data · Score Recommendations

![Score Upload](docs/screenshot-03-score.png)

### Data You Need

- Historical **enrollment plans** (school, major, seats, tuition, subject requirements)
- Historical **major admission scores** (minimum score, minimum rank)
- Historical **school admission scores** (minimum score, minimum rank)
- Historical **rank tables** (score → cumulative count)

Source: your province's official college entrance exam website (all public data)

### JSON Format

File name must contain a 4-digit year (e.g. `2024.json`):

```json
{
  "plans": [...],
  "majorScores": [...],
  "schoolScores": [...],
  "rankTable": [{ "score": 680, "cum": 120 }],
  "_meta": { "province": "YourProvince", "year": 2024, "subject": "Physics" }
}
```

No coding needed: click "**Download JSON template/sample**" in Mode 3 and fill in a few rows by hand. Or use `scripts/build_admission_json.py` (a generic template — adjust the column mapping to your Excel headers) to batch-convert. Multiple year files can be uploaded at once.

---

## Mode 4: AI University Advisor

![AI Advisor](docs/screenshot-04-advisor.png)

Use the "**Provider quick-pick**" on the left (auto-fills base URL and model), enter your API Key, and click "Save & Connect". The advisor sends an opening message automatically. The default sample is OpenAI (ChatGPT), but you can switch to a major Chinese provider with one click, or enter any self-hosted/proxy endpoint.

| Provider | API Base URL | Recommended Model |
|----------|-------------|-------------------|
| OpenAI (ChatGPT) | `https://api.openai.com/v1` | `gpt-4o` |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| Alibaba Qwen | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-max` |
| Moonshot · Kimi | `https://api.moonshot.cn/v1` | `moonshot-v1-8k` |
| Zhipu · GLM | `https://open.bigmodel.cn/api/paas/v4` | `glm-4-plus` |
| Volcengine · Doubao | `https://ark.cn-beijing.volces.com/api/v3` | `doubao-pro-32k` |
| Baidu · ERNIE | `https://qianfan.baidubce.com/v2` | `ernie-4.5-turbo-8k` |
| Tencent Hunyuan | `https://api.hunyuan.cloud.tencent.com/v1` | `hunyuan-turbo` |
| MiniMax | `https://api.minimax.chat/v1` | `abab6.5s-chat` |
| SiliconFlow (aggregator) | `https://api.siliconflow.cn/v1` | `deepseek-ai/DeepSeek-V3` |
| Any self-hosted/proxy | your proxy URL | model name |

> Provider base URLs/model names may change over time — refer to each provider's official docs.

- The system prompt is fixed by expert Gaokao advisors — you cannot modify it, ensuring consistent quality
- Your API key is stored only in your browser's localStorage; it is never sent to any server other than your chosen AI provider

---

## Mode 5: Provincial Voluntary Rules

A quick reference for all 31 provinces: exam mode (3+3 / 3+1+2 / traditional), voluntary mode (college-major-group vs. major+college), undergraduate parallel-choice counts, batch setup, and each province's official exam-authority link. Pick your province to learn its rules, then upload your data in Mode 3 — recommendations are sized to your province's parallel-choice quota.

> Rules data (`data/province_rules.json`) is compiled from public sources for reference only; always defer to your provincial education examination authority's official announcement for the current year.

---

## Project Structure

```
.
├── index.html              # Single-page app
├── app.js                  # All interaction logic
├── data/
│   ├── universities.json   # 2,756 universities
│   ├── majors.json         # 860 undergraduate majors
│   └── province_rules.json # Voluntary rules for all 31 provinces
├── scripts/
│   ├── build_admission_json.py    # Generic Excel→JSON template (adapt column mapping)
│   ├── parse_data.py              # University/major public-data parser
│   └── build_relations.py         # School-major relations (heuristic)
└── docs/
    └── screenshot-*.png    # UI screenshots
```

---

## Data Sources

- Ministry of Education: *National List of Regular Higher Education Institutions* (2021)
- *Catalog of Undergraduate Majors in Regular Higher Education Institutions* (2026)
- Official lists of 985 / 211 / Double First-Class universities
- Admission data: uploaded by the user — **no province-specific data is bundled with this project**

## Disclaimer

- "Majors offered" and "featured programs" are heuristic inferences based on school type, not official data
- Score recommendations are based on historical rank percentiles and are for reference only
- Always consult your school's official enrollment prospectus and your province's education examination authority

---

## License

MIT — free to use, PRs and issues welcome.
