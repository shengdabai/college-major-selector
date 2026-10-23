/** Tailwind 3.x 配置（原 index.html 内联 tailwind.config 原样搬出，theme 部分未改）。
 *  content 只扫描页面实际加载的文件：index.html 与 app.js。
 *  data/、docs/、.github/ 下没有脚本也没有类名，不扫描。 */
module.exports = {
  content: ['./index.html', './app.js'],
  theme: {
    extend: {
      colors: {
        paper:  { DEFAULT:'#faf9f5', 50:'#fdfcf9', 100:'#f6f4ec', 200:'#ece9dc' },
        ink:    { DEFAULT:'#1a1a1a', 2:'#4a4a4a', 3:'#8a8a8a', 4:'#bdbdbd' },
        line:   { DEFAULT:'#e5e3dc', 2:'#d4d1c5' },
        accent: { DEFAULT:'#c8102e', 2:'#1f3a5f', soft:'#fbeae5' },
        push:   { DEFAULT:'#b03a2e', soft:'#f8e8e3' },
        warn:   { DEFAULT:'#c47a2c', soft:'#f7ecd9' },
        safe:   { DEFAULT:'#4a7c59', soft:'#e3ede4' },
        gold:   { DEFAULT:'#b8870b', soft:'#f4ecd0' },
      },
      fontFamily: {
        display: ['"Noto Serif SC"', '"Source Han Serif SC"', '"Songti SC"', 'serif'],
        sans:    ['"Inter"', '-apple-system', 'BlinkMacSystemFont', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', '"SF Mono"', 'ui-monospace', 'monospace'],
      },
      letterSpacing: { tight2: '-0.02em', wide2: '0.18em' },
      boxShadow: { card: '0 1px 0 rgba(26,26,26,.04), 0 0 0 1px rgba(26,26,26,.06)' },
    }
  },
  // 类名在 app.js 里都以完整字符串出现（含三元表达式两个分支），扫描器能直接读到，目前不需要 safelist。
  // 以后如果用 `bg-${x}` 这类拼接写法，拼出来的类名要在这里逐个列出。
  safelist: [],
}
