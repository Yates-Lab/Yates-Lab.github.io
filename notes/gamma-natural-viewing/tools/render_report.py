"""Rebuild index.html from report.md: python tools/render_report.py.

Requires Python markdown, beautifulsoup4 and Pillow. No analysis data access.
"""
from pathlib import Path
import markdown
from bs4 import BeautifulSoup
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
soup = BeautifulSoup(markdown.markdown((ROOT/'report.md').read_text(), extensions=['tables','fenced_code','toc']), 'html.parser')
edition = soup.find('h1').find_next_sibling('p'); edition['class']='edition'
for p in list(soup.find_all('p')):
    if not p.get_text().startswith('Figure '): continue
    prior = p.find_previous_sibling()
    assert prior.find('img')
    fig = soup.new_tag('figure', id='figure-'+p.get_text().split('.')[0].split()[1]); prior.insert_before(fig)
    if prior.name=='p':
        for child in list(prior.contents): fig.append(child.extract())
        prior.decompose()
    else:
        fig.append(prior.extract())
    cap=soup.new_tag('figcaption')
    for child in list(p.contents): cap.append(child.extract())
    p.decompose(); fig.append(cap)
for img in soup.find_all('img'):
    width,height=Image.open(ROOT/img['src']).size
    img.attrs.update({'width':width,'height':height,'loading':'lazy','decoding':'async','tabindex':'0','role':'button','aria-label':'Enlarge: '+img.get('alt','Figure')})
for table in list(soup.find_all('table')):
    wrapper=soup.new_tag('div',attrs={'class':'table-scroll','tabindex':'0','aria-label':'Scrollable data table'})
    table.wrap(wrapper)
toc='<aside class="contents"><b>In this report</b>'+''.join(f'<a href="#{h["id"]}">{h.get_text()}</a>' for h in soup.find_all('h2'))+'<a href="session_coverage.csv">Download coverage table</a><a href="depth_landmarks.csv">Download depth landmarks</a></aside>'
tools=BeautifulSoup('''<div class="tools"><a href="fixations/"><strong>Browse individual fixations →</strong><span>Gaze, LFP, spikes and phase on one clock. Twelve saved examples from both animals.</span></a><a href="explore/"><strong>Compare the 30 sessions →</strong><span>Saccade-triggered power and phase, image spectra, and reference choices.</span></a></div>''','html.parser')
edition.insert_after(tools)
head='''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow"><meta name="description" content="A working research report on gamma during natural viewing, with synchronized fixation examples and comparisons across 30 marmoset V1 sessions."><title>Gamma during natural viewing · Yates Lab</title><link rel="stylesheet" href="assets/site.css"><link rel="stylesheet" href="assets/report.css"></head><body><a class="skip" href="#report">Skip to report</a><nav class="lab-nav" aria-label="Research note"><a class="lab-brand" href="../../">Yates Lab <span>Active Vision &amp; Neural Computation</span></a><div><a href="./" aria-current="page">Report</a><a href="fixations/">Fixation browser</a><a href="explore/">Across sessions</a><a href="report.pdf">PDF</a></div></nav>'''
tail='''</main></div><footer>Working report · 28 September 2026 · Active Vision and Neural Computation Lab<br>Unlisted public page. Figures from other papers retain their source attribution. <a href="report.md">Editable report</a>.</footer><dialog aria-label="Enlarged scientific figure"><button autofocus>Close ×</button><img alt=""></dialog><script src="assets/report.js"></script></body></html>'''
(ROOT/'index.html').write_text(head+'<div class="report-layout">'+toc+'<main id="report">'+str(soup)+tail)
print('Rendered report with',len(soup.find_all('figure')),'figures.')
