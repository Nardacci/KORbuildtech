# KORbuild

Protótipo de validação da plataforma KORbuild (veja o README). Site estático, sem build: HTML, CSS e módulos JS em `js/`.

## Produto

- **Plataforma SaaS** com três módulos: **KORbuild Daily** (diário de obra / RDO), **KORbuild Crew** (ponto da equipe → horas → custo) e **KORbuild Measure** (plantas → medições → quantidades → orçamento). Estes são os nomes definidos; não use "DailyLog", "Workforce", "Takeoff" nem "STACK" (marca de terceiros).
- Prioridade: Daily (em construção) → Crew → Measure.
- Tudo é por **empresa** (o cliente da plataforma): usuários, obras, dados e módulos contratados. Nada de dado solto fora de uma empresa. A estrutura está em `docs/saas.md`.
- Papéis: `admin` (escritório) e `campo` (canteiro); o cliente final é convidado externo, por link. Telas novas checam o papel em `desenhar()` (`js/app.js`).
- Obras, pessoas e funções são cadastros da plataforma, compartilhados pelos módulos.

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
