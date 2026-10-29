"""Builds a plain HTML page for every site, an index of them, sitemap.xml and
robots.txt, so search engines can find the stories (the map itself uses #links,
which Google ignores). Run by the Pages workflow before deploy; output is not
committed. Usage: python3 scripts/build_pages.py
"""
import json, html, os, re, shutil
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = 'https://folklore.thequarry.media/'
OUT = os.path.join(ROOT, 'stories')
CATS = {
    'fairies': ('Fairies', 'Les pouques', '#8fd3c4'),
    'witches': ('Witches', 'Les sorciers', '#e6a54b'),
    'beasts': ('The Devil and his beasts', 'Lé Diable', '#de6a55'),
    'ghosts': ('Ghosts', 'Les revenants', '#c8c4ec'),
    'stones': ('Old stones and customs', 'Les vieilles pierres', '#b8c47f'),
}
BEACON = """<script type='module' src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "98f22e0dac6a476193fba479b5a3c8d2"}'></script>"""
e = lambda s: html.escape(str(s or ''), quote=True)

CSS = """
:root{--bg:#16171b;--rule:#2e2f35;--ink:#ece6d8;--soft:#a8a397;--faint:#77736c}
*{box-sizing:border-box}
html{background:var(--bg)}
body{margin:0;background:var(--bg);color:var(--ink);font:18px/1.6 "Alegreya Sans","Gill Sans","Segoe UI",system-ui,sans-serif}
main{max-width:720px;margin:0 auto;padding:28px 16px 64px}
a{color:var(--ink);text-underline-offset:3px}
.top{display:flex;justify-content:space-between;gap:12px;font-size:15px;color:var(--soft);margin-bottom:28px}
.top a{color:var(--soft)}
.cat{font-family:"Alegreya Sans SC","Alegreya Sans",sans-serif;letter-spacing:.14em;font-size:14px}
h1{font-family:"IM Fell English",Georgia,serif;font-weight:400;font-size:clamp(34px,7vw,52px);line-height:1.05;margin:8px 0 10px}
.gloss{color:var(--soft);font-style:italic;margin:0 0 18px}
.meta{font-size:15px;color:var(--soft);border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:8px 0;margin-bottom:22px}
figure{margin:0 0 22px}
figure img{width:100%;height:auto;display:block;filter:sepia(.25)}
figcaption{font-size:14px;color:var(--faint);margin-top:6px}
.cta{display:inline-block;margin:6px 0 26px;padding:10px 18px;border:1px solid var(--rule);border-radius:999px;text-decoration:none;font-weight:500}
.cta:hover{background:#1e1f24}
h2{font-family:"IM Fell English",Georgia,serif;font-weight:400;font-size:24px;margin:30px 0 8px}
.src,.help,.foot{font-size:15px;color:var(--soft)}
.foot{margin-top:40px;border-top:1px solid var(--rule);padding-top:14px}
ul.all{list-style:none;padding:0;margin:0}
ul.all li{border-bottom:1px solid var(--rule);padding:12px 0}
ul.all a{font-family:"IM Fell English",Georgia,serif;font-size:22px;text-decoration:none}
ul.all span{display:block;font-size:15px;color:var(--soft)}
ul.all .dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:8px}
"""

def page(title, desc, canon, image, body):
    return f"""<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{canon}">
<meta property="og:type" content="article">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{canon}">
<meta property="og:image" content="{image}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/images/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IM+Fell+English&family=Alegreya+Sans:ital,wght@0,400;0,500;1,400&family=Alegreya+Sans+SC:wght@500&display=swap">
<style>{CSS}</style>
</head>
<body>
<main>
<div class="top"><a href="/">Guernsey Folklore Map</a><a href="https://thequarry.media">The Quarry</a></div>
{body}
<div class="foot">
<p>Part of the <a href="/">Guernsey Folklore Map</a>, a shared project by <a href="https://thequarry.media">The Quarry</a> to keep the island's old stories alive. Many sites are on private land: please keep to public roads and paths.</p>
<p><a href="https://thequarry.media/#/portal/signup">Get The Quarry's weekly newsletter</a> · <a href="/stories/">All the stories</a></p>
<p>We count visits with Cloudflare Web Analytics, which sets no cookies and collects no personal data.</p>
</div>
</main>
{BEACON}
</body>
</html>
"""

def first_sentence(text, limit=155):
    s = text.split('. ')[0].rstrip('.') + '.'
    return s if len(s) <= limit else s[:limit - 1].rsplit(' ', 1)[0] + '…'

def main():
    sites = [f['properties'] | {'lon': f['geometry']['coordinates'][0], 'lat': f['geometry']['coordinates'][1]}
             for f in json.load(open(os.path.join(ROOT, 'data/sites.geojson')))['features']]
    sites.sort(key=lambda s: re.sub(r"^(le|la|les|l')\s*", '', s['name'].lower()))
    shutil.rmtree(OUT, ignore_errors=True)
    os.makedirs(OUT)
    urls = [BASE, BASE + 'stories/']

    for s in sites:
        label, fr, col = CATS[s['category']]
        canon = f"{BASE}stories/{s['id']}/"
        urls.append(canon)
        imgs = s.get('images') or []
        image = BASE + imgs[0]['src'] if imgs else BASE + 'images/og.jpg'
        desc = first_sentence(' '.join(s['story']))
        figs = ''.join(
            f'<figure><img src="/{e(i["src"])}" alt="{e(i["caption"])}" loading="lazy">'
            f'<figcaption>{e(i.get("year", ""))} {e(i["caption"])}. {e(i.get("credit", ""))}</figcaption></figure>'
            for i in imgs)
        access = f'<p class="meta"><b>Visiting:</b> {e(s["access"])}</p>' if s.get('access') else ''
        body = f"""<article>
<div class="cat" style="color:{col}">{e(label.upper())} · {e(fr)}</div>
<h1>{e(s['name'])}</h1>
<p class="gloss">{e(s['gloss'])}</p>
<div class="meta">{e(s['parish'])}, Guernsey · {'Site' if s.get('location_precision') == 'site' else 'Approximate location'}</div>
{access}
<a class="cta" href="/#{e(s['id'])}">See it on the map &rarr;</a>
{figs}
{''.join(f'<p>{e(p)}</p>' for p in s['story'])}
<h2>Sources</h2>
<ul class="src">{''.join(f'<li><a href="{e(x["url"])}">{e(x["title"])}</a></li>' for x in s['sources'])}</ul>
<p class="help">Know more about {e(s['name'])}, have a photo of it, or think the pin is in the wrong place? Email <a href="mailto:editor@thequarry.media?subject={e('Folklore map: ' + s['name'])}">editor@thequarry.media</a>.</p>
</article>"""
        os.makedirs(os.path.join(OUT, s['id']))
        with open(os.path.join(OUT, s['id'], 'index.html'), 'w') as fh:
            fh.write(page(f"{s['name']}: {label} | Guernsey Folklore Map", desc, canon, image, body))

    items = ''.join(
        f'<li><a href="/stories/{e(s["id"])}/"><span class="dot" style="background:{CATS[s["category"]][2]}"></span>{e(s["name"])}</a>'
        f'<span>{e(s["gloss"])} · {e(s["parish"])}</span></li>' for s in sites)
    body = f"""<h1>Guernsey's folklore, place by place</h1>
<p class="gloss">{len(sites)} places in Guernsey and Sark where the island's old stories are attached to the ground, retold from MacCulloch's Guernsey Folk Lore (1903), Pitts's witch-trial transcripts and Guernsey Museums.</p>
<a class="cta" href="/">Open the map &rarr;</a>
<ul class="all">{items}</ul>"""
    with open(os.path.join(OUT, 'index.html'), 'w') as fh:
        fh.write(page('All the stories | Guernsey Folklore Map',
                      f'{len(sites)} Guernsey folklore sites: fairies, witches, the Devil, black dogs and ghosts, with their stories and sources.',
                      BASE + 'stories/', BASE + 'images/og.jpg', body))

    today = date.today().isoformat()
    with open(os.path.join(ROOT, 'sitemap.xml'), 'w') as fh:
        fh.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
        fh.writelines(f'  <url><loc>{u}</loc><lastmod>{today}</lastmod></url>\n' for u in urls)
        fh.write('</urlset>\n')
    with open(os.path.join(ROOT, 'robots.txt'), 'w') as fh:
        fh.write(f'User-agent: *\nAllow: /\n\nSitemap: {BASE}sitemap.xml\n')
    print(f'built {len(sites)} story pages, sitemap with {len(urls)} urls')

if __name__ == '__main__':
    main()
