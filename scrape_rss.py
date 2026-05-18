#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Simple RSS collector: parse a list of feeds, respect robots.txt, and write articles.json (max 500 entries).
Run: python scrape_rss.py
"""
import feedparser
import requests
import json
import time
import os
from urllib.parse import urlparse
import urllib.robotparser as robotparser

USER_AGENT = "AI-News-Collector-Bot/1.0 (+https://example.com)"
HEADERS = {"User-Agent": USER_AGENT}

FEEDS = [
    "https://techcrunch.com/tag/artificial-intelligence/feed/",
    "https://venturebeat.com/category/ai/feed/",
    "https://www.theverge.com/rss/index.xml",
    "https://www.wired.com/feed/rss",
    "https://www.technologyreview.com/feed/",
    "https://export.arxiv.org/rss/cs.AI",
    "https://export.arxiv.org/rss/cs.LG",
    "https://export.arxiv.org/rss/cs.CL",
    "https://www.jiqizhixin.com/rss",
    "https://news.ycombinator.com/rss",
    "https://www.reddit.com/r/MachineLearning/.rss",
    "https://medium.com/feed/tag/artificial-intelligence",
    "https://www.theguardian.com/technology/rss",
    "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml",
    "https://www.zdnet.com/topic/artificial-intelligence/rss.xml",
    "https://feeds.arstechnica.com/arstechnica/technology-lab",
    "https://www.engadget.com/rss.xml",
]

MAX_ITEMS = 500

articles = []
seen = set()
domain_info = {}


def get_domain_root(url):
    p = urlparse(url)
    return f"{p.scheme}://{p.netloc}"


def check_robots_for(domain_root):
    if domain_root in domain_info:
        return domain_info[domain_root]
    rp = robotparser.RobotFileParser()
    robots_url = domain_root.rstrip('/') + '/robots.txt'
    try:
        rp.set_url(robots_url)
        rp.read()
        allowed = rp.can_fetch('*', domain_root + '/')
        delay = rp.crawl_delay('*') or 1
    except Exception:
        allowed = True
        delay = 1
    domain_info[domain_root] = (allowed, delay)
    return allowed, delay


MODULE_KEYWORDS = [
    ("大模型与基础技术", ["large model","大模型","multimodal","agent","code generation","copilot","cursor","long context","推理","vllm","moe","multi-modal"]),
    ("应用落地", ["search","问答","搜索","办公","productivity","教育","医疗","health","finance","金融","法律","content","创作","视频生成","video generation","midjourney"]),
    ("前沿探索", ["robot","机器人","embodied","具身","world model","世界模型","edge","边缘","ai for science","protein","蛋白质"]),
    ("基础设施与工具", ["gpu","nvidia","ascend","算力","training","训练","inference","推理","quantize","量化","mcp","skills","vllm","moe"]),
    ("2025 年最热细分赛道", ["agent platform","video generation","ai 编程助手","赛道","startup","funding","融资","机器人","具身智能"]),
]


def classify_module(text):
    t = (text or "").lower()
    best = ("应用落地", 0)
    for name, kws in MODULE_KEYWORDS:
        score = 0
        for kw in kws:
            if kw in t:
                score += 1
        if score > best[1]:
            best = (name, score)
    return best[0]


def parse_feed(feed_url):
    domain_root = get_domain_root(feed_url)
    allowed, delay = check_robots_for(domain_root)
    if not allowed:
        print(f"robots.txt blocks {domain_root}; skipping {feed_url}")
        return
    try:
        resp = requests.get(feed_url, headers=HEADERS, timeout=20)
        resp.raise_for_status()
        fp = feedparser.parse(resp.content)
        for e in fp.entries:
            if len(articles) >= MAX_ITEMS:
                break
            link = e.get('link') or e.get('id') or ''
            if not link or link in seen:
                continue
            title = e.get('title','').strip()
            summary = e.get('summary','').strip() if 'summary' in e else e.get('description','').strip() if 'description' in e else ''
            author = e.get('author','')
            published = e.get('published','') or e.get('updated','')
            tags = []
            if 'tags' in e:
                for t in e.get('tags',[]):
                    term = t.get('term') if isinstance(t, dict) else t
                    if term:
                        tags.append(term)
            module = classify_module(title + ' ' + summary)
            articles.append({
                'title': title,
                'link': link,
                'summary': summary,
                'author': author,
                'published': published,
                'tags': tags,
                'source': domain_root,
                'module': module,
            })
            seen.add(link)
        time.sleep(delay)
    except Exception as ex:
        print('Error parsing', feed_url, ex)
        time.sleep(1)


def main():
    print('Starting collection; target=', MAX_ITEMS)
    for f in FEEDS:
        if len(articles) >= MAX_ITEMS:
            break
        parse_feed(f)

    # fallback: try arXiv query in smaller batches
    if len(articles) < MAX_ITEMS:
        try:
            batch = 100
            start = 0
            while len(articles) < MAX_ITEMS and start < 1000:
                q = 'all:artificial+intelligence'
                url = f"https://export.arxiv.org/api/query?search_query={q}&start={start}&max_results={batch}"
                r = requests.get(url, headers=HEADERS, timeout=30)
                fp = feedparser.parse(r.content)
                for e in fp.entries:
                    if len(articles) >= MAX_ITEMS:
                        break
                    link = e.get('link') or e.get('id') or ''
                    if not link or link in seen:
                        continue
                    title = e.get('title','').strip()
                    summary = e.get('summary','').strip()
                    author = ', '.join(a.get('name') for a in e.get('authors',[])) if 'authors' in e else ''
                    published = e.get('published','')
                    module = classify_module(title + ' ' + summary)
                    articles.append({
                        'title': title,
                        'link': link,
                        'summary': summary,
                        'author': author,
                        'published': published,
                        'tags': [],
                        'source': 'arXiv',
                        'module': module,
                    })
                    seen.add(link)
                start += batch
                time.sleep(3)
        except Exception as ex:
            print('arXiv fallback error', ex)

    print('Collected', len(articles))
    out_path = os.path.join(os.path.dirname(__file__), 'articles.json')
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(articles[:MAX_ITEMS], f, ensure_ascii=False, indent=2)
    print('Wrote', out_path)


if __name__ == '__main__':
    main()
