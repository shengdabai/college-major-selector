#!/usr/bin/env bash
# 重新生成 tailwind.css（Tailwind CLI 3.x，不要用 4.x：配置格式不同）。
# 改了 index.html 或 app.js 里的 Tailwind 类名、或改了 tailwind.config.cjs 之后必须运行本脚本，
# 并把生成的 tailwind.css 一起提交；页面直接加载 tailwind.css，不会在浏览器里临时生成样式。
# 离线时可用 TAILWIND_CLI 指向本机已有的 3.x CLI，例如：TAILWIND_CLI="node /path/to/tailwindcss/lib/cli.js" scripts/build-css.sh
# 浏览器范围：原来的 Play CDN 会给 backdrop-blur 等加 -webkit- 前缀（iOS 17 及更早的 Safari 需要）；
# Tailwind CLI 默认的范围不含这些旧 Safari，会漏掉前缀，所以这里显式写上。需要别的范围可自己设 BROWSERSLIST 覆盖。
set -euo pipefail
cd "$(dirname "$0")/.."
export BROWSERSLIST="${BROWSERSLIST:-defaults, Safari >= 12, iOS >= 12}"
${TAILWIND_CLI:-npx --yes tailwindcss@3.4.19} -c tailwind.config.cjs -i src/tailwind.input.css -o tailwind.css --minify
