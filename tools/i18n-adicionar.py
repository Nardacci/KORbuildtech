#!/usr/bin/env python3
"""Acrescenta traduções a js/i18n-en.js. Uso: python3 tools/i18n-adicionar.py "Seção" < traducoes.json
O JSON é um objeto { "frase em português": "English" }. Chave repetida: avisa e mantém a primeira."""
import json, re, sys

caminho = 'js/i18n-en.js'
src = open(caminho, encoding='utf-8').read()
novos = json.load(sys.stdin)
existentes = set(json.loads('"' + m + '"') for m in re.findall(r"^\s*'((?:\\.|[^'\\])*)':", src, re.M) for _ in [0]) if False else None

def lit(s):
    return "'" + s.replace('\\', '\\\\').replace("'", "\\'").replace('\n', '\\n') + "'"

chaves = set()
for m in re.finditer(r"^  '((?:\\.|[^'\\])*)':", src, re.M):
    chaves.add(re.sub(r"\\(.)", r"\1", m.group(1)))
linhas = []
for k, v in novos.items():
    if k in chaves:
        print('já existe:', k, file=sys.stderr)
        continue
    chaves.add(k)
    linhas.append('  ' + lit(k) + ': ' + lit(v) + ',')
fim = src.rstrip().rfind('};')
bloco = '\n  // ---------- ' + sys.argv[1] + ' ----------\n' + '\n'.join(linhas) + '\n'
src = src[:fim].rstrip() + '\n' + bloco + '};\n'
open(caminho, 'w', encoding='utf-8').write(src)
print(len(linhas), 'traduções acrescentadas')
