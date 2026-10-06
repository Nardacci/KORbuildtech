#!/usr/bin/env python3
"""KORbuild — marca os textos de interface para tradução: 'Texto' → t('Texto').

Uso: python3 tools/i18n-envolver.py js/arquivo.js [--aplicar]
Sem --aplicar, só mostra o que mudaria. Em português, t(x) devolve x: a troca não muda o app em pt.

Regras (heurísticas; o teste em inglês acusa o que escapar):
  - só literais com aspas simples, fora de comentários e expressões regulares;
  - pula literais de lógica: comparações, case, chaves de objeto, nomes de ação, seletores, imports;
  - num literal com HTML, marca só o texto entre as tags e os atributos de texto (title, aria-label,
    placeholder, alt, data-texto, data-confirmar);
  - literal sem HTML: marca se parece frase (tem espaço, acento ou começa com maiúscula).
"""
import re
import sys

LETRA = re.compile(r'[A-Za-zÀ-ÿ]')
ACENTO = re.compile(r'[À-ÿ]')
ATRIB_TEXTO = {'title', 'aria-label', 'placeholder', 'alt', 'data-texto', 'data-confirmar', 'data-titulo'}
FUNCOES_PULAR = {
    'includes', 'startsWith', 'endsWith', 'split', 'replace', 'replaceAll', 'querySelector', 'querySelectorAll',
    'getElementById', 'getItem', 'setItem', 'removeItem', 'icone', 'addEventListener', 'removeEventListener', 'closest',
    'matches', 'getAttribute', 'setAttribute', 'removeAttribute', 'toggle', 'contains', 'indexOf', 'lastIndexOf',
    'import', 'require', 'open', 'createElement', 'route', 'fetch', 'normalize', 'padStart', 'padEnd', 'RegExp',
    'test', 'match', 'search', 'execCommand', 'postMessage', 'go', 'hasOwnProperty', 't', 'tr', 'tn', 'campo', 'obra', 'item',
    'contato', 'projeto', 'funcionario', 'modulo', 'perfil', 'pode', 'auditarDado', 'dispatchEvent', 'Event',
}


def ler_literais(src):
    """Devolve [(inicio, fim)] de cada literal com aspas simples (fim exclusivo, aspas incluídas)."""
    out = []
    i, n = 0, len(src)
    ultimo_sig = ''  # último caractere significativo fora de string/comentário (para achar regex)
    while i < n:
        c = src[i]
        if c == '/' and i + 1 < n and src[i + 1] == '/':
            j = src.find('\n', i)
            i = n if j < 0 else j
            continue
        if c == '/' and i + 1 < n and src[i + 1] == '*':
            j = src.find('*/', i + 2)
            i = n if j < 0 else j + 2
            continue
        if c in '"`':
            j = i + 1
            while j < n and src[j] != c:
                j += 2 if src[j] == '\\' else 1
            i = j + 1
            ultimo_sig = c
            continue
        if c == "'":
            j = i + 1
            while j < n and src[j] != "'":
                j += 2 if src[j] == '\\' else 1
            out.append((i, j + 1))
            i = j + 1
            ultimo_sig = "'"
            continue
        if c == '/' and (ultimo_sig == '' or ultimo_sig in '(,=:[!&|?{};+-*%<>~^' or src[max(0, i - 7):i].rstrip().endswith('return')):
            # expressão regular
            j = i + 1
            em_classe = False
            while j < n:
                if src[j] == '\\':
                    j += 2
                    continue
                if src[j] == '[':
                    em_classe = True
                elif src[j] == ']':
                    em_classe = False
                elif src[j] == '/' and not em_classe:
                    break
                elif src[j] == '\n':
                    break
                j += 1
            j += 1
            while j < n and src[j].isalpha():
                j += 1
            i = j
            ultimo_sig = '/'
            continue
        if not c.isspace():
            ultimo_sig = c
        i += 1
    return out


def contexto_de_logica(src, ini, fim):
    antes = src[max(0, ini - 60):ini]
    depois = src[fim:fim + 12]
    a = antes.rstrip()
    if re.search(r'(===|!==|==|!=|\bcase|\bfrom|\bimport)$', a):
        return True
    if re.match(r'\s*(===|!==|==|!=)', depois):
        return True
    if re.match(r'(:|\()', depois):  # chave de objeto ou nome de método
        return True
    m = re.search(r'([A-Za-z_$][\w$]*)\s*\(\s*$', a)
    if m and m.group(1) in FUNCOES_PULAR:
        return True
    # segundo argumento de funções de lógica: fn(x, 'y')
    m = re.search(r'([A-Za-z_$][\w$]*)\s*\([^()]*,\s*$', a)
    if m and m.group(1) in FUNCOES_PULAR | {'formatar', 'definirFonteNotificacoes'}:
        return True
    if re.search(r'(data-acao|dataset\.\w+|\.id|\.tipo|\.status|\.estado|\.papel|\.modo|\.categoria|\.situacao)\s*=\s*$', a):
        return True
    return False


NAO_TRADUZIR = {'KORbuild', 'Daily', 'Crew', 'Measure', 'Settings', 'KORbuild Daily', 'KORbuild Crew', 'KORbuild Measure', 'KORbuild Settings', 'GPS', 'PDF', 'CSV', 'EIN', 'OK'}


def parece_frase(s):
    t = s.strip()
    if not LETRA.search(t) or t in NAO_TRADUZIR:
        return False
    if re.search(r'(^#|\\[dswbDSWnp(.\[]|^&|rgba?\(|\dpx|sans-serif|^\[|^\$\d|\.js$|\.css$|\.png$|\.pdf$|^https?:|^kbt\.|^data:|^\./|=>|\$\{)', t):
        return False
    if ' ' not in t and not ACENTO.search(t):
        if re.fullmatch(r'[a-z0-9_./:-]+', t):  # id, classe, rota, chave
            return False
        if re.fullmatch(r'[A-Z0-9_./-]+', t) and len(t) <= 5:  # sigla (PDF, CSV, GPS)
            return False
        if re.fullmatch(r'[a-z]+[A-Z]\w*', t):  # camelCase
            return False
    if re.fullmatch(r'[a-z0-9 _-]+', t) and '-' in t and ' ' in t:  # lista de classes
        return False
    return True


def envolver(trecho):
    """Texto (já sem as aspas) → lista de partes: ('lit', '...') ou ('t', '...')."""
    lead = re.match(r'\s*', trecho).group(0)
    tail = re.search(r'\s*$', trecho).group(0)
    meio = trecho[len(lead):len(trecho) - len(tail)] if tail else trecho[len(lead):]
    partes = []
    if lead:
        partes.append(('lit', lead))
    partes.append(('t', meio))
    if tail:
        partes.append(('lit', tail))
    return partes


def dividir(conteudo):
    """Divide o conteúdo de um literal em partes, marcando texto entre tags e atributos de texto."""
    tem_html = '<' in conteudo or '>' in conteudo or '="' in conteudo or conteudo.startswith('"')
    if not tem_html:
        if parece_frase(conteudo):
            return envolver(conteudo)
        return [('lit', conteudo)]
    partes = []
    i, n = 0, len(conteudo)
    # Estado inicial: o literal pode começar dentro de uma tag (ex.: '" class="x">Texto').
    p_lt, p_gt = conteudo.find('<'), conteudo.find('>')
    if p_gt >= 0 and (p_lt < 0 or p_gt < p_lt):
        estado = 'tag'
    elif p_lt < 0 and p_gt < 0:
        estado = 'tag'  # só atributos: ' href="', '" data-id="'
    else:
        estado = 'texto'
    ate = p_gt if p_gt >= 0 and (p_lt < 0 or p_gt < p_lt) else (p_lt if p_lt >= 0 else len(conteudo))
    if estado == 'tag' and conteudo[:ate].count('"') % 2 == 1 and not re.match(r'\s*[\w-]+="', conteudo):
        # começa no meio do valor de um atributo de nome desconhecido
        j = conteudo.find('"')
        valor = conteudo[:j]
        if valor.strip() and parece_frase(valor) and (' ' in valor.strip() or ACENTO.search(valor)) and not re.search(r'[a-z]-[a-z]', valor):
            partes += envolver(valor)
        else:
            partes.append(('lit', valor))
        partes.append(('lit', '"'))
        i = j + 1
    buf = ''
    while i < n:
        c = conteudo[i]
        if estado == 'texto':
            if c == '<':
                if buf:
                    partes += envolver(buf) if parece_frase(buf) else [('lit', buf)]
                    buf = ''
                estado = 'tag'
                partes.append(('lit', '<'))
                i += 1
                continue
            buf += c
            i += 1
            continue
        # dentro de tag: copia, e marca valores de atributos de texto
        m = re.match(r'([\w-]+)="', conteudo[i:])
        if m and (i == 0 or not re.match(r'[\w-]', conteudo[i - 1])):
            nome = m.group(1)
            partes.append(('lit', m.group(0)))
            i += len(m.group(0))
            j = conteudo.find('"', i)
            valor = conteudo[i:] if j < 0 else conteudo[i:j]
            if nome in ATRIB_TEXTO and valor.strip() and parece_frase(valor):
                partes += envolver(valor)
            else:
                partes.append(('lit', valor))
            if j < 0:
                i = n
            else:
                partes.append(('lit', '"'))
                i = j + 1
            continue
        if c == '>':
            estado = 'texto'
        partes.append(('lit', c))
        i += 1
    if buf:
        partes += envolver(buf) if parece_frase(buf) else [('lit', buf)]
    # junta literais vizinhos
    juntas = []
    for tipo, v in partes:
        if juntas and tipo == 'lit' and juntas[-1][0] == 'lit':
            juntas[-1] = ('lit', juntas[-1][1] + v)
        elif v != '' or tipo == 't':
            juntas.append((tipo, v))
    return juntas


def processar(src):
    trocas = []
    chaves = []
    for ini, fim in ler_literais(src):
        bruto = src[ini + 1:fim - 1]
        if not LETRA.search(bruto) or contexto_de_logica(src, ini, fim):
            continue
        partes = dividir(bruto)
        if not any(tp == 't' for tp, _ in partes):
            continue
        codigo = ' + '.join(("tr('" + v + "')") if tp == 't' else ("'" + v + "'") for tp, v in partes)
        if len(partes) > 1:
            codigo = '(' + codigo + ')'
        trocas.append((ini, fim, codigo))
        chaves += [v for tp, v in partes if tp == 't']
    novo = src
    for ini, fim, codigo in reversed(trocas):
        novo = novo[:ini] + codigo + novo[fim:]
    return novo, trocas, chaves


if __name__ == '__main__':
    caminho = sys.argv[1]
    src = open(caminho, encoding='utf-8').read()
    novo, trocas, chaves = processar(src)
    if '--aplicar' in sys.argv:
        open(caminho, 'w', encoding='utf-8').write(novo)
        print(caminho, len(trocas), 'literais marcados')
    else:
        for ini, fim, codigo in trocas:
            linha = src.count('\n', 0, ini) + 1
            print(f'{linha}: {src[ini:fim]}  →  {codigo}')
