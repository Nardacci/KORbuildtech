# KORbuild RDO

Protótipo de validação do Relatório Diário de Obra (veja o README). Site estático, sem build: HTML, CSS e módulos JS em `js/`.

## Branch

A branch principal é a `main`: é a que o GitHub Pages publica e a que vai para a demonstração. Trabalhe e publique nela.

## Idioma: o protótipo é em português, a versão final será toda em inglês

- O protótipo e a demonstração continuam em português (pt-BR) por enquanto.
- O produto final será em inglês. Ao criar ou mudar algo, evite amarrar o produto ao Brasil sem necessidade:
  - texto que a pessoa vê fica perto do topo de cada módulo ou em constantes nomeadas (ex.: `SITUACOES`, `TIPOS_OCORRENCIA`, `STATUS_RDO` em `js/relatorio.js`), não espalhado em lógica;
  - datas, números e unidades passam por funções de `js/util.js` (`dataCurta`, `tamanho`…), para trocar o formato num lugar só;
  - termos e campos só do Brasil (RDO, CREA, CNPJ, "praticável/impraticável", m² e °C) ficam isolados em dados (`js/exemplo.js`) ou rótulos, nunca em regra de negócio.
- **Não traduzir agora.** A tradução (textos, termos do setor como *Daily Report / Daily Log*, unidades e formatos dos EUA) acontece só quando o projeto estiver finalizado, como uma etapa própria. Até lá, tudo novo é escrito em português.

## Testes

`tests/demo.test.mjs` percorre o roteiro da demonstração no Chromium (Playwright). Rode depois de qualquer mudança:

```bash
python3 -m http.server 8123 &
node tests/demo.test.mjs http://localhost:8123/
```

Ao mudar arquivos do app, suba a versão do cache em `sw.js` (`korbuild-rdo-vN`).
