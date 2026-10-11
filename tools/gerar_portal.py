"""Gera o portal de especificações e manual do KORbuild (portal/) a partir do Markdown em portal/fonte/.

Uso:
  pip install markdown python-docx
  node tools/capturas-portal.mjs          # (opcional) refaz as capturas das telas em portal/img/
  python3 tools/gerar_portal.py           # gera as páginas, a busca, os Word e confere os links

O texto é escrito uma vez só (portal/fonte/<idioma>/...). Daqui saem a página web e o Word de cada documento.
Markdown aceito, além do comum (títulos, listas, tabelas, negrito, links):
  ![Legenda](img/arquivo.png)        imagem com legenda (arquivo terminado em -mobile.png sai no tamanho de celular)
  [texto](@/daily/user-manual.html)   link para outra página do portal ("@/" é a raiz do portal)
  !!! who "Who can do it"            quadros: who (quem pode), tip, warning, simulated (simulado no protótipo),
                                     confirm (a confirmar), say (o que dizer na apresentação), note
"""
import html
import json
import os
import re
import sys
from datetime import date
from html.parser import HTMLParser
from pathlib import Path

import markdown

RAIZ = Path(__file__).resolve().parent.parent
PORTAL = RAIZ / 'portal'
FONTE = PORTAL / 'fonte'
IDIOMA = 'en'   # um idioma por vez (decisão de outubro de 2026); o português entra depois em fonte/pt
HOJE = date.today().strftime('%B %-d, %Y')

# ---------------------------------------------------------------- catálogo

MODULOS = [
    {'id': 'daily', 'nome': 'Daily', 'cor': 'var(--cor-daily)', 'ico': 'D',
     'resumo': 'Daily construction reports from the field: crew, weather, work performed, GPS-stamped photos and issues. '
               'The office reviews, approves and shares a sealed PDF with the client. Also home to the job list and the job schedule.',
     'paginas': [
         {'slug': 'overview', 'titulo': 'Overview', 'grupo': 'Start here', 'desc': 'What Daily does, who uses it and the main screens.'},
         {'slug': 'user-manual', 'titulo': 'User manual', 'grupo': 'Using it', 'desc': 'Step by step, task by task, with screenshots.'},
         {'slug': 'business-rules', 'titulo': 'Business rules', 'grupo': 'Rules and access', 'desc': 'Every rule the system enforces, with an ID.'},
         {'slug': 'roles-and-permissions', 'titulo': 'Roles and permissions', 'grupo': 'Rules and access', 'desc': 'Who can do what in Daily.'},
         {'slug': 'prototype-status', 'titulo': 'Prototype status', 'grupo': 'Rules and access', 'desc': 'What is simulated today and what comes next.'},
     ]},
    {'id': 'crew', 'nome': 'Crew', 'cor': 'var(--cor-crew)', 'ico': 'C',
     'resumo': 'Crew time clock with GPS and geofence, weekly timesheets with overtime, approval and payroll export, '
               'and labor cost by job: budget × actual × forecast to completion.',
     'paginas': [
         {'slug': 'overview', 'titulo': 'Overview', 'grupo': 'Start here', 'desc': 'What Crew does, who uses it and the main screens.'},
         {'slug': 'user-manual', 'titulo': 'User manual', 'grupo': 'Using it', 'desc': 'Clock in, approve timesheets, follow labor cost — step by step.'},
         {'slug': 'business-rules', 'titulo': 'Business rules', 'grupo': 'Rules and access', 'desc': 'Punches, geofence, overtime, cost and forecast rules, with IDs.'},
         {'slug': 'roles-and-permissions', 'titulo': 'Roles and permissions', 'grupo': 'Rules and access', 'desc': 'Who can do what in Crew.'},
         {'slug': 'prototype-status', 'titulo': 'Prototype status', 'grupo': 'Rules and access', 'desc': 'What is simulated today and what comes next.'},
     ]},
    {'id': 'measure', 'nome': 'Measure', 'cor': 'var(--cor-measure)', 'ico': 'M',
     'resumo': 'Plan takeoff in feet and inches: scale, measure, assemblies, quantities, quote lists and proposals.', 'paginas': []},
    {'id': 'settings', 'nome': 'Settings', 'cor': 'var(--cor-settings)', 'ico': 'S',
     'resumo': 'Company setup: employees, labor burden, work rules, jobs, contacts, users and access roles, audit log.', 'paginas': []},
]
GERAIS = [
    {'slug': 'presenting', 'titulo': "Presenter's guide", 'desc': 'How to present KORbuild to a customer: the story, the order of the screens, '
                                                                 'which demo user to sign in with and what to say at each step.'},
]
GRUPOS = ['Start here', 'Using it', 'Rules and access']

E = html.escape


# ---------------------------------------------------------------- Markdown → HTML

def converter(md_texto, raiz):
    md = markdown.Markdown(extensions=['tables', 'toc', 'attr_list', 'admonition', 'md_in_html', 'sane_lists'],
                           extension_configs={'toc': {'toc_depth': '2-3'}})
    corpo = md.convert(md_texto)
    toc = md.toc_tokens
    # links "@/..." = raiz do portal
    corpo = corpo.replace('href="@/', 'href="' + raiz)
    # imagem sozinha no parágrafo vira figura com legenda; "-mobile" no nome = tamanho de celular
    def figura(alt, src):
        alt = html.unescape(alt)
        classe = ' class="celular"' if '-mobile' in src else ''
        return f'<figure{classe}><img src="{raiz}{src}" alt="{E(alt)}" loading="lazy"><figcaption>{E(alt)}</figcaption></figure>'
    corpo = re.sub(r'<p><img alt="([^"]*)" src="(img/[^"]+)"\s*/?></p>', lambda m: figura(m.group(1), m.group(2)), corpo)
    return corpo, toc


def titulo_e_corpo(caminho):
    texto = caminho.read_text(encoding='utf-8')
    m = re.match(r'#\s+(.+)\n', texto)
    titulo = m.group(1).strip() if m else caminho.stem
    return titulo, texto[m.end():] if m else texto


# ---------------------------------------------------------------- moldura

def cabecalho(titulo, raiz, ativo=''):
    def nav(id_, href, rotulo):
        return f'<a href="{raiz}{href}"{" aria-current=page" if ativo == id_ else ""}>{rotulo}</a>'
    return f"""<!DOCTYPE html>
<html lang="{IDIOMA}">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{E(titulo)}</title>
<meta name="description" content="KORbuild product guide: specifications, business rules and user manual for each module.">
<link rel="icon" href="{raiz}../icons/icon-192.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{raiz}assets/portal.css">
</head>
<body data-raiz="{raiz}">
<header class="topo">
  <a class="marca" href="{raiz}index.html" aria-label="KORbuild product guide, home"><img src="{raiz}../icons/icon-192.png" alt=""><span><b>KOR</b>build</span><small>Guide</small></a>
  <nav class="topo-nav" aria-label="Main">
    {nav('modulos', 'index.html#modules', 'Modules')}
    {nav('presenting', 'presenting.html', "Presenter's guide")}
  </nav>
  <div class="topo-acoes">
    <label class="busca"><span aria-hidden="true">⌕</span><input id="busca" type="search" placeholder="Search rules, screens, tasks…" aria-label="Search the guide" autocomplete="off"></label>
    <a class="btn-topo" href="{raiz}../?demo#/entrar">Open the prototype</a>
    <button class="menu-celular" type="button" aria-label="Menu and search">☰</button>
  </div>
  <div class="busca-resultados" id="busca-resultados" role="listbox" hidden></div>
</header>
"""


def rodape(raiz):
    return f"""<footer class="rodape">
  <div><b>KORbuild</b> product guide · updated {HOJE} · <a href="{raiz}../">Main sign-in</a> · <a href="{raiz}../?demo#/entrar">Prototype</a></div>
  <div>Screenshots come from the prototype with sample data. Names, companies and numbers are fictitious.</div>
</footer>
<button class="voltar-topo" type="button" aria-label="Back to top">↑</button>
<script src="{raiz}assets/portal.js"></script>
</body></html>
"""


def toc_html(toc):
    if not toc:
        return '<span></span>'
    itens = []
    for t in toc:
        itens.append(f'<li><a href="#{t["id"]}">{E(html.unescape(t["name"]))}</a></li>')
        itens += [f'<li class="sub"><a href="#{c["id"]}">{E(html.unescape(c["name"]))}</a></li>' for c in t['children'][:14]]
    return f'<nav class="toc" aria-label="On this page"><div class="toc-titulo">On this page</div><ul>{"".join(itens)}</ul></nav>'


# ---------------------------------------------------------------- páginas

def pagina_documento(mod, p, corpo, toc, palavra_word):
    raiz = '../'
    lat = []
    for g in GRUPOS:
        itens = [x for x in mod['paginas'] if x['grupo'] == g]
        if itens:
            lat.append(f'<div class="lat-titulo">{g}</div><ul>' + ''.join(
                f'<li><a href="{x["slug"]}.html"{" aria-current=page" if x is p else ""}>{E(x["titulo"])}</a></li>' for x in itens) + '</ul>')
    return cabecalho(f"{p['titulo']} · {mod['nome']} · KORbuild guide", raiz, 'modulos') + f"""
<div class="doc-layout" style="--cor:{mod['cor']}">
  <aside class="lateral" aria-label="{mod['nome']} documents">
    <a class="lat-modulo" href="index.html"><span class="ico">{mod['ico']}</span>{mod['nome']}</a>
    {''.join(lat)}
  </aside>
  <main class="doc" id="conteudo">
    <nav class="trilha" aria-label="You are here"><a href="{raiz}index.html">Home</a> › <a href="index.html">{mod['nome']}</a> › {E(p['grupo'])}</nav>
    <header class="doc-cabecalho">
      <h1>{E(p['titulo'])}</h1>
      <div class="doc-acoes"><a class="botao" href="{raiz}files/{palavra_word}" download>⤓ Download Word</a><button class="botao botao-secundario" type="button" onclick="window.print()">⎙ Print</button></div>
    </header>
    <article class="texto">
{corpo}
    </article>
  </main>
  {toc_html(toc)}
</div>
""" + rodape(raiz)


def pagina_geral(g, corpo, toc, palavra_word):
    raiz = ''
    return cabecalho(f"{g['titulo']} · KORbuild guide", raiz, g['slug']) + f"""
<div class="doc-layout" style="--cor:var(--cor-geral)">
  <aside class="lateral" aria-label="Modules">
    <a class="lat-modulo" href="index.html"><span class="ico">K</span>KORbuild</a>
    <div class="lat-titulo">Guide</div><ul>{''.join(f'<li><a href="{x["slug"]}.html"{" aria-current=page" if x is g else ""}>{E(x["titulo"])}</a></li>' for x in GERAIS)}</ul>
    <div class="lat-titulo">Modules</div><ul>{''.join(f'<li><a href="{m["id"]}/index.html">{m["nome"]}</a></li>' for m in MODULOS)}</ul>
  </aside>
  <main class="doc" id="conteudo">
    <nav class="trilha" aria-label="You are here"><a href="index.html">Home</a> › Guide</nav>
    <header class="doc-cabecalho">
      <h1>{E(g['titulo'])}</h1>
      <div class="doc-acoes"><a class="botao" href="files/{palavra_word}" download>⤓ Download Word</a><button class="botao botao-secundario" type="button" onclick="window.print()">⎙ Print</button></div>
    </header>
    <article class="texto">
{corpo}
    </article>
  </main>
  {toc_html(toc)}
</div>
""" + rodape(raiz)


def pagina_modulo(mod):
    raiz = '../'
    grupos = []
    for g in GRUPOS:
        itens = [x for x in mod['paginas'] if x['grupo'] == g]
        if itens:
            grupos.append(f'<h2>{g}</h2><div class="cartoes">' + ''.join(
                f'<a class="cartao-doc" href="{x["slug"]}.html"><b>{E(x["titulo"])}</b><span>{E(x["desc"])}</span></a>' for x in itens) + '</div>')
    if not grupos:
        grupos.append('<h2>Coming soon</h2><p>The documentation of this module is being written. Meanwhile, see it working in the '
                      f'<a href="{raiz}../?demo#/entrar">prototype</a>.</p>')
    return cabecalho(f"{mod['nome']} · KORbuild guide", raiz, 'modulos') + f"""
<div class="mod-cabeca" style="--cor:{mod['cor']}">
  <nav class="trilha" aria-label="You are here"><a href="{raiz}index.html">Home</a> › {mod['nome']}</nav>
  <div class="mod-caixa"><span class="ico">{mod['ico']}</span><div><h1>{mod['nome']}</h1><p>{E(mod['resumo'])}</p></div></div>
</div>
<div class="mod-grupos" style="--cor:{mod['cor']}">{''.join(grupos)}</div>
""" + rodape(raiz)


def pagina_inicial():
    cartoes = ''.join(
        f'<a class="cartao-mod" href="{m["id"]}/index.html" style="--cor:{m["cor"]}"><span class="ico">{m["ico"]}</span><b>{m["nome"]}</b>'
        f'<span>{E(m["resumo"])}</span>' + ('' if m['paginas'] else '<span class="em-breve">Documentation coming soon</span>') + '</a>'
        for m in MODULOS)
    return cabecalho('KORbuild product guide', '', 'inicio') + f"""
<section class="heroi"><div class="heroi-dentro">
  <p class="sobrescrito">KORbuild product guide</p>
  <h1>Everything KORbuild does, in one place.</h1>
  <p class="lead">KORbuild is a platform for construction companies in the United States: general contractors and the trade contractors
  they hire. This guide explains each module — what it is for, the rules it enforces, who can do what — and walks through every task
  with screenshots, so anyone can present the product with confidence.</p>
  <div class="botoes">
    <a class="botao" href="presenting.html">Presenter's guide →</a>
    <a class="botao botao-secundario" href="#modules">Explore the modules</a>
    <a class="botao botao-secundario" href="../?demo#/entrar">Open the prototype ↗</a>
  </div>
</div></section>
<section class="faixa" id="modules">
  <h2>Modules</h2>
  <p>One account, one set of jobs and people, shared by every module. Each company turns on the modules it needs.</p>
  <div class="cartoes">{cartoes}</div>
</section>
<section class="faixa">
  <h2>Where to start</h2>
  <p>Pick the path that matches why you are here.</p>
  <div class="publicos">
    <div class="publico"><h3>I will present KORbuild to a customer</h3><p>Read the presenter's guide: the story, the order of the screens and what to say.</p>
      <ul><li><a href="presenting.html">Presenter's guide</a></li><li><a href="../?demo#/entrar">Open the prototype</a></li></ul></div>
    <div class="publico"><h3>I will use KORbuild every day</h3><p>Go to your module and open the user manual: one task at a time, with screenshots.</p>
      <ul><li><a href="daily/user-manual.html">Daily — user manual</a></li><li><a href="crew/user-manual.html">Crew — user manual</a></li></ul></div>
    <div class="publico"><h3>I need the rules and permissions</h3><p>Each module lists its business rules with IDs and who can do what.</p>
      <ul><li><a href="daily/business-rules.html">Daily — business rules</a></li><li><a href="daily/roles-and-permissions.html">Daily — roles and permissions</a></li><li><a href="crew/business-rules.html">Crew — business rules</a></li><li><a href="crew/roles-and-permissions.html">Crew — roles and permissions</a></li></ul></div>
  </div>
</section>
<div style="height:40px"></div>
""" + rodape('')


# ---------------------------------------------------------------- busca

class Texto(HTMLParser):
    def __init__(self):
        super().__init__(); self.partes = []
    def handle_data(self, d): self.partes.append(d)


def texto_puro(trecho):
    t = Texto(); t.feed(trecho)
    return re.sub(r'\s+', ' ', ''.join(t.partes)).strip()


def entradas_de_busca(url, pagina, corpo):
    saida = []
    pedacos = re.split(r'(<h[23] id="[^"]+">.*?</h[23]>)', corpo)
    titulo, ancora = pagina, ''
    for pedaco in pedacos:
        m = re.match(r'<h[23] id="([^"]+)">(.*?)</h[23]>', pedaco)
        if m:
            ancora, titulo = m.group(1), texto_puro(m.group(2))
            continue
        txt = texto_puro(pedaco)
        if txt:
            saida.append({'url': url + ('#' + ancora if ancora else ''), 'pagina': pagina, 'titulo': titulo, 'texto': txt[:600]})
    return saida


# ---------------------------------------------------------------- Word

def gerar_word(titulo, subtitulo, corpo_html, destino, raiz_img):
    from docx import Document
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    from docx.shared import Pt, RGBColor, Cm

    doc = Document()
    sec = doc.sections[0]
    sec.page_width, sec.page_height = Cm(21.59), Cm(27.94)  # US Letter
    for lado in ('left_margin', 'right_margin'):
        setattr(sec, lado, Cm(2.2))
    estilo = doc.styles['Normal']; estilo.font.name = 'Calibri'; estilo.font.size = Pt(10.5)
    for n, tam in ((1, 18), (2, 14), (3, 12)):
        h = doc.styles[f'Heading {n}']; h.font.name = 'Calibri'; h.font.size = Pt(tam); h.font.color.rgb = RGBColor(0x14, 0x1B, 0x26)
    p = doc.add_paragraph(); r = p.add_run('KORbuild'); r.bold = True; r.font.size = Pt(11); r.font.color.rgb = RGBColor(0xC2, 0x41, 0x0C)
    doc.add_heading(titulo, 0)
    if subtitulo:
        doc.add_paragraph(subtitulo).runs[0].italic = True

    def sombrear(par, cor):
        ppr = par._p.get_or_add_pPr(); shd = OxmlElement('w:shd')
        shd.set(qn('w:val'), 'clear'); shd.set(qn('w:color'), 'auto'); shd.set(qn('w:fill'), cor); ppr.append(shd)

    numbering = doc.part.numbering_part.numbering_definitions._numbering
    estilo_num = doc.styles['List Number']._element.pPr.numPr.numId.val
    abstrato = [n for n in numbering.findall(qn('w:num')) if n.get(qn('w:numId')) == str(estilo_num)][0].find(qn('w:abstractNumId')).get(qn('w:val'))

    def nova_numeracao():
        ids = [int(n.get(qn('w:numId'))) for n in numbering.findall(qn('w:num'))]
        novo = max(ids) + 1
        num = OxmlElement('w:num'); num.set(qn('w:numId'), str(novo))
        ab = OxmlElement('w:abstractNumId'); ab.set(qn('w:val'), abstrato); num.append(ab)
        ov = OxmlElement('w:lvlOverride'); ov.set(qn('w:ilvl'), '0')
        st = OxmlElement('w:startOverride'); st.set(qn('w:val'), '1'); ov.append(st); num.append(ov)
        numbering.append(num)
        return novo

    def numerar(par, num_id, nivel):
        ppr = par._p.get_or_add_pPr()
        npr = OxmlElement('w:numPr')
        il = OxmlElement('w:ilvl'); il.set(qn('w:val'), str(nivel)); npr.append(il)
        ni = OxmlElement('w:numId'); ni.set(qn('w:val'), str(num_id)); npr.append(ni)
        ppr.append(npr)

    CORES = {'who': 'ECFDF3', 'warning': 'FFFAEB', 'simulated': 'FFFAEB', 'tip': 'FFF2EA', 'confirm': 'FEF3F2', 'say': 'EEF1F5', 'note': 'EEF4FF'}

    class Montar(HTMLParser):
        def __init__(self):
            super().__init__()
            self.par = None; self.fmt = []; self.listas = []; self.tabela = None; self.linha = None; self.celula = None
            self.cabecalho = False; self.caixa = None; self.ignorar = 0; self.figcaption = False; self.numeros = []
        def novo(self, estilo=None):
            alvo = self.celula if self.celula is not None else doc
            self.par = alvo.add_paragraph(style=estilo) if estilo else alvo.add_paragraph()
            if self.caixa:
                sombrear(self.par, CORES.get(self.caixa, 'EEF4FF'))
            return self.par
        def handle_starttag(self, tag, attrs):
            a = dict(attrs)
            if tag in ('h1', 'h2', 'h3', 'h4'):
                self.par = doc.add_heading('', level=min(3, int(tag[1]) - 1 if tag != 'h1' else 1))
            elif tag == 'p':
                classe = a.get('class', '')
                if not (self.par is not None and not self.par.text and self.listas):
                    self.novo()
                if 'admonition-title' in classe:
                    self.fmt.append('b')
            elif tag in ('ul', 'ol'):
                self.listas.append(tag)
                self.numeros.append(nova_numeracao() if tag == 'ol' else None)
            elif tag == 'li':
                nivel = len(self.listas)
                base = 'List Number' if self.listas and self.listas[-1] == 'ol' else 'List Bullet'
                self.novo(base + (f' {nivel}' if nivel > 1 else ''))
                if self.numeros and self.numeros[-1] is not None:
                    numerar(self.par, self.numeros[-1], nivel - 1)
            elif tag in ('strong', 'b'):
                self.fmt.append('b')
            elif tag in ('em', 'i'):
                self.fmt.append('i')
            elif tag == 'code':
                self.fmt.append('c')
            elif tag == 'div' and 'admonition' in a.get('class', ''):
                self.caixa = (a.get('class', '').split() + ['note'])[1]
            elif tag == 'table':
                self.tabela = doc.add_table(rows=0, cols=0); self.tabela.style = 'Table Grid'; self.colunas = 0
            elif tag == 'tr':
                self.linha = []
            elif tag in ('td', 'th'):
                self.cabecalho = tag == 'th'; self.linha.append([]); self.em_celula = True
            elif tag == 'img':
                arq = raiz_img / a.get('src', '').split('img/', 1)[-1]
                if arq.exists():
                    largura = Cm(7) if '-mobile' in arq.name else Cm(16)
                    doc.add_picture(str(arq), width=largura)
                    doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
            elif tag == 'figcaption':
                self.figcaption = True; self.novo(); self.par.alignment = WD_ALIGN_PARAGRAPH.CENTER; self.fmt.append('i')
            elif tag == 'br' and self.par is not None:
                self.par.add_run().add_break()
        def handle_endtag(self, tag):
            if tag in ('strong', 'b', 'em', 'i', 'code') and self.fmt:
                self.fmt.pop()
            elif tag == 'p' and self.fmt and self.fmt[-1] == 'b' and self.par is not None and self.caixa:
                self.fmt.pop()
            elif tag in ('ul', 'ol') and self.listas:
                self.listas.pop()
                if self.numeros: self.numeros.pop()
            elif tag == 'div' and self.caixa:
                self.caixa = None
            elif tag in ('td', 'th'):
                self.em_celula = False
            elif tag == 'tr' and self.linha is not None:
                linhas = self._linhas = getattr(self, '_linhas', []); linhas.append((self.linha, self.cabecalho))
            elif tag == 'table':
                linhas = getattr(self, '_linhas', [])
                if linhas:
                    ncol = max(len(l) for l, _ in linhas)
                    t = doc.add_table(rows=len(linhas), cols=ncol); t.style = 'Table Grid'
                    for i, (cels, cab) in enumerate(linhas):
                        for j, partes in enumerate(cels):
                            cel = t.cell(i, j); cel.text = ''
                            par = cel.paragraphs[0]
                            for txt, f in partes:
                                run = par.add_run(txt); run.bold = 'b' in f or (i == 0); run.italic = 'i' in f; run.font.size = Pt(9)
                            if i == 0:
                                sombrear(par, 'F2F4F7')
                    # remove a tabela vazia criada no início
                    self.tabela._tbl.getparent().remove(self.tabela._tbl)
                self.tabela = None; self._linhas = []
            elif tag == 'figcaption':
                self.figcaption = False
                if self.fmt: self.fmt.pop()
        def handle_data(self, dado):
            if not dado.strip():
                if '\n' in dado or self.par is None or not self.par.text:
                    return
                dado = ' '
            if getattr(self, 'em_celula', False):
                self.linha[-1].append((dado, set(self.fmt)))
                return
            if self.tabela is not None:
                return
            if self.par is None:
                self.novo()
            run = self.par.add_run(dado)
            run.bold = 'b' in self.fmt; run.italic = 'i' in self.fmt
            if 'c' in self.fmt:
                run.font.name = 'Consolas'

    Montar().feed(corpo_html)
    doc.save(destino)


# ---------------------------------------------------------------- conferência de links

def conferir_links():
    erros = []
    for pagina in PORTAL.rglob('*.html'):
        if 'fonte' in pagina.parts:
            continue
        txt = pagina.read_text(encoding='utf-8')
        ids = set(re.findall(r'id="([^"]+)"', txt))
        for alvo in re.findall(r'(?:href|src)="([^"]+)"', txt):
            if re.match(r'(https?:|mailto:|data:)', alvo) or '?demo' in alvo:
                continue
            caminho, _, ancora = alvo.partition('#')
            if not caminho:
                if ancora and ancora not in ids:
                    erros.append(f'{pagina.relative_to(RAIZ)}: âncora #{ancora} não existe')
                continue
            arq = (pagina.parent / caminho).resolve()
            if arq.is_dir():
                arq = arq / 'index.html'
            if not arq.exists():
                erros.append(f'{pagina.relative_to(RAIZ)}: {alvo} não existe')
            elif ancora and arq.suffix == '.html' and f'id="{ancora}"' not in arq.read_text(encoding='utf-8'):
                erros.append(f'{pagina.relative_to(RAIZ)}: {alvo} (âncora não existe)')
    return erros


# ---------------------------------------------------------------- principal

def main():
    origem = FONTE / IDIOMA
    (PORTAL / 'files').mkdir(exist_ok=True)
    busca = []
    faltando = []
    for g in GERAIS:
        arq = origem / f'{g["slug"]}.md'
        if not arq.exists():
            faltando.append(str(arq)); continue
        titulo, md = titulo_e_corpo(arq)
        g['titulo'] = titulo
        corpo, toc = converter(md, '')
        word = f'KORbuild - {titulo}.docx'.replace("'", '')
        (PORTAL / f'{g["slug"]}.html').write_text(pagina_geral(g, corpo, toc, word), encoding='utf-8')
        gerar_word(titulo, 'KORbuild product guide', corpo, PORTAL / 'files' / word, PORTAL / 'img')
        busca += entradas_de_busca(f'{g["slug"]}.html', titulo, corpo)
    for mod in MODULOS:
        pasta = PORTAL / mod['id']; pasta.mkdir(exist_ok=True)
        for p in mod['paginas']:
            arq = origem / mod['id'] / f'{p["slug"]}.md'
            if not arq.exists():
                faltando.append(str(arq)); continue
            titulo, md = titulo_e_corpo(arq)
            p['titulo'] = titulo
            corpo, toc = converter(md, '../')
            word = f'KORbuild {mod["nome"]} - {titulo}.docx'
            (pasta / f'{p["slug"]}.html').write_text(pagina_documento(mod, p, corpo, toc, word), encoding='utf-8')
            gerar_word(f'{mod["nome"]} — {titulo}', 'KORbuild product guide', corpo, PORTAL / 'files' / word, PORTAL / 'img')
            busca += entradas_de_busca(f'{mod["id"]}/{p["slug"]}.html', f'{mod["nome"]} · {titulo}', corpo)
        (pasta / 'index.html').write_text(pagina_modulo(mod), encoding='utf-8')
    (PORTAL / 'index.html').write_text(pagina_inicial(), encoding='utf-8')
    (PORTAL / 'search.json').write_text(json.dumps(busca, ensure_ascii=False), encoding='utf-8')
    erros = conferir_links()
    for f in faltando:
        print('falta a fonte:', f)
    for e in erros:
        print('LINK QUEBRADO', e)
    print(f'portal gerado: {len(busca)} trechos na busca, {len(erros)} links quebrados')
    sys.exit(1 if erros or faltando else 0)


if __name__ == '__main__':
    main()
