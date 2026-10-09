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
- **Crew:** regras do ponto em `js/crew.js` (batida imutável, ajuste é batida nova; sem arredondamento; hora extra pela regra de jornada do Settings; deslocamento entre obras é hora paga; cerca de 150 m que sinaliza e não bloqueia). Telas em `js/crew-telas.js`. O encarregado bate o ponto pela equipe; a equipe do RDO do Daily vem do ponto. Documentação do módulo: `docs/crew.md` (manter atualizada a cada mudança no Crew).
- **Permissões:** nunca checar papel fixo; usar `pode(u, 'permissão')` (catálogo `PERMISSOES` em `js/settings.js`; perfis e usuários configuráveis em Settings › Perfis/Usuários). Nova tela ou ação nasce com a permissão que exige. A tela inicial sai de `inicioDoUsuario` (um módulo só → direto nele).
- **Settings** (`js/settings.js`, `js/settings-telas.js`, doc `docs/settings.md`): abre para quem tem permissões `settings.*`. Funcionários ficam em `estado().funcionarios` (cadastro da empresa, não do Crew); regras de jornada e encargos em `estado().settings` com vigência (`regraEm`, `encargosEm`; nunca no passado) e auditoria (`auditar`). **Nada de regra de negócio fixa no código:** novos parâmetros entram no Settings com padrão, vigência quando mexem com dinheiro, e auditoria. Não amarrar a um estado (padrão: New Hampshire / FLSA federal).
- **Custos do Crew:** valor hora com vigência (`f.valores`, `valorHoraEm`; nunca reescrever o passado; não começar em semana aprovada), encargos sobre a folha (Settings), orçamento por obra (`crew.orcamentos`, com avanço físico), semanas antigas em `crew.historico` ([data, pessoa, obra, etapa, minutos]). Motor: `lancamentosDaSemana` → `custosDoPeriodo` / `resumoDaObra` (projeção pelo avanço ou pelo ritmo; no rumo / atenção ≤ 5% / estouro).
- **Mapa do dia:** Leaflet guardado em `vendor/leaflet/` (não usar CDN) com blocos do OpenStreetMap; se a biblioteca não carregar, fica o SVG de `mapaSvg()`. Endereços das obras e **Percurso do dia** (`percursoDoDia`): rotas pelas ruas via OSRM público e endereço das batidas fora da cerca via Nominatim; sem internet ficam as linhas retas tracejadas. Registros de localização (`trilhaDoDia` + `passosDoDia`): pontos na batida, na troca, na abertura do app e a cada 15 min (5 min em deslocamento), nunca no intervalo nem com o ponto fechado; reprodução (playback) em `montarMapa`. Requisito ainda provisório: ver docs/crew-analise.md §5.5. No teste, blocos de rua, OSRM e Nominatim são simulados.
- **Notificações:** sininho na barra superior (`notificacoesDe` em `js/plataforma.js`); cada módulo informa as suas (`notificacoesDaily` em `js/app.js`, `notificacoesCrew` em `js/crew-telas.js`).
- Testes: `tests/demo.test.mjs` (Daily), `tests/crew.test.mjs` (Crew), `tests/measure.test.mjs` (Measure, tela de computador), `tests/cronograma.test.mjs` (cronograma da obra), `tests/obras.test.mjs` (cadastro de obras), `tests/ingles.test.mjs` (telas em inglês) e `tests/imperial.test.mjs` (Node puro).
- **Atores** (`docs/saas.md` §Atores, `js/contatos.js`): a empresa que assina é "a empresa" (prestadora ou construtora), nunca "a construtora" fixa. Construtoras, clientes e fornecedores são **contatos** de um diretório único com marcadores; projeto e obra têm **contratante** (recebe proposta e diário) e, se for outro, **dono**. A demonstração tem duas empresas isoladas (Construtora Exemplo, da Ana; Northfield Framing & Siding, a prestadora do Tom); `estado()` devolve só a empresa do usuário da sessão. **O Measure é da prestadora**: a construtora não abre os desenhos (só receberá relatórios).
- **Measure** (`js/imperial.js`, `js/measure.js`, `js/measure-telas.js`, doc `docs/measure.md`): nunca calcular com texto ou fração; guardar polegadas/pol²/pol³ e pontos em coordenadas da página do PDF (nunca pixels); escala por folha com conferência; condição separada das medições; PDF.js em `vendor/pdfjs/` (sem CDN). Unidades imperiais na tela (ft-in, lin ft, sq ft, cu yd). Fórmulas só pelo `js/formulas.js` (mathjs restrita em `vendor/mathjs/`, lista branca; nunca `eval`); perda e arredondamento são campos da linha, não números na fórmula; toda quantidade mostra o rastro do cálculo.
- **Obras** (`js/obras.js`, `js/obras-telas.js`, doc `docs/obras.md`): a obra é da empresa (não de um módulo); cadastro em Settings › Obras, com atalhos no Daily e no projeto ganho do Measure. Só obra `situacao: 'andamento'` cobra diário (`ehDiaDeTrabalho` em `prazos.js`) e aparece no campo e no ponto. `cidade` é o texto pronto ("Manchester, NH 03104"); `municipio`, `estado` e `zip` ficam separados. Modelos de etapas em `modelosCronograma`.
- **Cronograma** (`js/cronograma.js`, `js/cronograma-telas.js`, `js/cronograma-excel.js`, doc `docs/cronograma.md`): quem monta é a prestadora; a construtora só vê a versão publicada (retrato em `compartilhados`, fora das empresas, simulando o servidor). % concluído vem do RDO aprovado ou de ajuste do escritório, sempre com histórico; linha de base nunca é sobrescrita. Excel pela ExcelJS em `vendor/exceljs/` (carregada só na exportação).
- Login é mockup: todos caem na página dos módulos. A distinção de papel acontece dentro do módulo.

## Branch

A branch principal é a `main`: é a que o GitHub Pages publica e a que vai para a demonstração. Trabalhe e publique nela.

## Idioma: inglês (padrão) e português

- O produto é em inglês; o português fica como opção (botão PT | EN). Tudo está em [`docs/i18n.md`](docs/i18n.md).
- **Todo texto que a pessoa vê passa por `tr()`/`tn()`** de `js/i18n.js`, com a frase inteira em português como chave e o inglês em `js/i18n-en.js`. Use variáveis (`{nome}`), não concatene pedaços de frase.
- Datas, horas, dinheiro, distâncias e clima só pelas funções de `js/util.js` e `dinheiro()`.
- Depois de mexer em texto: `node tools/i18n-faltando.mjs` (frases sem inglês) e `node tests/ingles.test.mjs` (português nas telas em inglês).
- As suítes `demo`, `crew` e `measure` rodam em português (fixam `kbt.idioma = 'pt'`).

## Testes

`tests/demo.test.mjs` percorre o roteiro da demonstração no Chromium (Playwright). Rode depois de qualquer mudança:

```bash
python3 -m http.server 8123 &
node tests/demo.test.mjs http://localhost:8123/
```

Ao mudar arquivos do app, suba a versão do cache em `sw.js` (`korbuild-rdo-vN`).
