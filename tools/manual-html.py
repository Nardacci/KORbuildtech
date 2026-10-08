"""Gera manual/manual-de-teste.html a partir de manual/KORbuild_Manual_de_teste.docx.

Uso:  pip install mammoth  &&  python3 tools/manual-html.py
Rode de novo sempre que o .docx mudar. As imagens vão embutidas no HTML."""
import pathlib
import re
import mammoth

RAIZ = pathlib.Path(__file__).resolve().parent.parent
DOCX = RAIZ / 'manual' / 'KORbuild_Manual_de_teste.docx'
SAIDA = RAIZ / 'manual' / 'manual-de-teste.html'

with open(DOCX, 'rb') as f:
    corpo = mammoth.convert_to_html(f).value

# O .docx não usa estilos de título: os títulos são texto em negrito. Aqui viram h2/h3/h4,
# para a página ter estrutura e um índice no alto.
guias = []
def guia(m):
    nome = m.group(1)
    ancora = 'guia-' + str(len(guias) + 1)
    guias.append((ancora, nome))
    return '<h2 id="' + ancora + '">' + nome + '</h2>'
corpo = re.sub(r'<p><strong>(KORbuild [^<]+ — Guia de teste)</strong></p>', guia, corpo)
SECOES = 'Antes de começar|Roteiro de teste|Retorno|Limitações conhecidas'
corpo = re.sub(r'<p>(?:<strong>)?(' + SECOES + r')(?:</strong>)?</p>', r'<h3>\1</h3>', corpo)
corpo = re.sub(r'<p><strong>(Parte \d+ — [^<]+)</strong></p>', r'<h4>\1</h4>', corpo)
indice = '<h1>KORbuild — Manual de teste</h1><ul class="indice">' + ''.join(
    '<li><a href="#' + a + '">' + n.replace(' — Guia de teste', '') + '</a></li>' for a, n in guias) + '</ul>'
corpo = indice + corpo

PAGINA = '''<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>KORbuild — Manual de teste</title>
<style>
  :root { --texto: #1d2433; --mudo: #5b6475; --borda: #dde2ea; --fundo: #ffffff; --faixa: #f4f6f9; --marca: #0b4f8a; }
  @media (prefers-color-scheme: dark) {
    :root { --texto: #e7ebf2; --mudo: #a3acbb; --borda: #333b49; --fundo: #141821; --faixa: #1c2230; --marca: #7fb6ea; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--fundo); color: var(--texto); font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  .barra { position: sticky; top: 0; display: flex; gap: 12px; align-items: center; justify-content: space-between; flex-wrap: wrap;
    padding: 10px 16px; background: var(--faixa); border-bottom: 1px solid var(--borda); }
  .barra a { color: var(--marca); font-weight: 600; text-decoration: none; }
  .barra a:hover { text-decoration: underline; }
  main { max-width: 820px; margin: 0 auto; padding: 24px 16px 64px; overflow-wrap: anywhere; }
  h1, h2, h3 { line-height: 1.25; }
  h1 { font-size: 1.8em; } h2 { margin-top: 2em; border-bottom: 1px solid var(--borda); padding-bottom: 4px; }
  a { color: var(--marca); }
  img { max-width: 100%; height: auto; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: .92em; display: block; overflow-x: auto; }
  td, th { border: 1px solid var(--borda); padding: 6px 8px; vertical-align: top; }
  td p, th p { margin: 0; }
  .indice { display: flex; flex-wrap: wrap; gap: 8px; padding: 0; list-style: none; }
  .indice a { display: inline-block; padding: 4px 12px; border: 1px solid var(--borda); border-radius: 999px; text-decoration: none; }
  h2 { scroll-margin-top: 56px; }
  @media print { .barra { display: none; } }
</style>
</head>
<body>
<nav class="barra"><a href="../#/entrar">← Voltar ao KORbuild</a><a href="KORbuild_Manual_de_teste.docx" download>Baixar (Word)</a></nav>
<main>
''' + corpo + '''
</main>
</body>
</html>
'''

SAIDA.write_text(PAGINA, encoding='utf-8')
print('gerado', SAIDA.relative_to(RAIZ), len(PAGINA), 'bytes')
