AI News Hub — 仿掘金（样例）

说明：
- 本仓库包含一个静态前端（index.html, app.js, style.css）和一个 Python 爬虫脚本（scrape_rss.py）。
- 当前 articles.json 包含样例文章。要抓取并生成 500 条新闻，请在本机运行爬虫。

快速使用：
1. 安装依赖（Python 3.8+）：
   python -m pip install -r requirements.txt
2. 运行爬虫生成完整数据：
   python scrape_rss.py
   生成文件： articles.json（最多 500 条）
3. 本地预览：
   在项目根目录运行： python -m http.server 8000
   在浏览器打开： http://localhost:8000/

注意：爬虫会遵守 robots.txt 并加速率限制；若遇到站点限制或 429，请稍后重试或调整 FEEDS 列表。
