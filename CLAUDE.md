# KORbuild

Protótipo de validação da plataforma KORbuild (veja o README). Site estático, sem build: HTML, CSS e módulos JS em `js/`.

## Mercado: Estados Unidos

- **O produto é feito para o mercado americano** (pelo menos neste momento). Regras de negócio, legislação (FLSA, leis estaduais, OSHA, Davis-Bacon), unidades, formatos e integrações seguem os EUA.
- O Brasil não é mercado-alvo agora. Exigências só brasileiras (Portaria 671/REP-P, CNPJ, CREA, LGPD como regra principal) não orientam o produto.
- O protótipo continua em português só para a nossa conversa interna; termos, dados de exemplo, unidades e formatos dos EUA entram na etapa de localização (veja "Idioma").

## Produto

- **Plataforma SaaS** com três módulos: **KORbuild Daily** (diário de obra / RDO), **KORbuild Crew** (ponto da equipe → horas → custo) e **KORbuild Measure** (plantas → medições → quantidades → orçamento). Estes são os nomes definidos; não use "DailyLog", "Workforce", "Takeoff" nem "STACK" (marca de terceiros).
- Prioridade: Daily (em construção) → Crew → Measure.
- Tudo é por **empresa** (o cliente da plataforma): usuários, obras, dados e módulos contratados. Nada de dado solto fora de uma empresa. A estrutura está em `docs/saas.md`.
- Papéis: `admin` (escritório) e `campo` (canteiro); o cliente final é convidado externo, por link. Telas novas checam o papel em `desenhar()` (`js/app.js`).
- Obras, pessoas e funções são cadastros da plataforma, compartilhados pelos módulos.
- O KORbuild Match **não** faz parte deste pacote (por enquanto, só os três módulos acima).

## Visual e navegação

- Identidade própria do KORbuild, **sem nada do Match** (nem cores, nem fonte, nem componentes): grafite e laranja de obra, fonte Inter, cantos discretos. Os tokens estão no topo de `css/app.css`; cada módulo tem uma cor (`--cor-daily`, `--cor-crew`, `--cor-measure`).
- **Marca:** logotipo "KOR" em peso forte + "build" em peso leve, com o sobrescrito "Team operations platform" e a assinatura "Build better teams. Run better operations." (não perder essa essência). O símbolo K laranja é o ícone do app e aparece na barra superior. Tudo em `logotipo()`, `marca()`, `ASSINATURA` e `SOBRESCRITO` (`js/icones.js`).
- Todas as telas logadas usam `casca()` (`js/plataforma.js`): barra superior (marca, módulo, atalho para os módulos, menu do usuário) e, dentro de um módulo, menu lateral no computador e abas embaixo no celular. Telas do Daily passam por `moldura()` em `js/app.js`, que monta o menu conforme o papel.
- RDO obrigatório: prazo 18h, lembrete 16h, alerta às 18h, escalada para o escritório às 8h do dia seguinte. Canais: só o **sininho** e a notificação do sistema (sem SMS nem e-mail). Regras em `docs/alertas.md`, lógica em `js/prazos.js`. O teste usa horário fixo (`page.clock.setFixedTime`).
- **Crew:** regras do ponto em `js/crew.js` (batida imutável, ajuste é batida nova; sem arredondamento; hora extra semanal 40 h/1,5×; deslocamento entre obras é hora paga; cerca de 150 m que sinaliza e não bloqueia). Telas em `js/crew-telas.js`. O encarregado bate o ponto pela equipe; a equipe do RDO do Daily vem do ponto.
- **Mapa do dia:** Leaflet guardado em `vendor/leaflet/` (não usar CDN) com blocos do OpenStreetMap; se a biblioteca não carregar, fica o SVG de `mapaSvg()`. No teste, os blocos de rua são simulados.
- **Notificações:** sininho na barra superior (`notificacoesDe` em `js/plataforma.js`); cada módulo informa as suas (`notificacoesDaily` em `js/app.js`, `notificacoesCrew` em `js/crew-telas.js`).
- Testes: `tests/demo.test.mjs` (Daily) e `tests/crew.test.mjs` (Crew), ambos com horário fixo.
- Login é mockup: todos caem na página dos módulos. A distinção de papel acontece dentro do módulo.

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
