# Guia da marca — KORbuild Takeoff (aprovado em 20/10/2026)

Página de aprovação (com os exemplos): https://claude.ai/artifact/3WuMDjraLTKU3pTC3MdCXE

- **Nome:** o produto se chama **KORbuild Takeoff**. "Settings" é só a área de cadastros. A palavra "Measure" não aparece para a pessoa na 1ª versão (o código por baixo continua `measure`). No topo, o logotipo leva "KORbuild" + o subtítulo **TAKEOFF** (`logotipo()` em `js/icones.js`; o painel de administração da plataforma não leva o subtítulo). A frase "Team operations platform" fica só na tela de entrada e em material institucional.
- **Símbolo:** um K de duas peças: haste e braço de cima em laranja `#F26A1B`; a diagonal de baixo em grafite `#141B26` (branca sobre fundo escuro), com a dobra em tom suave. Desenhado em `marca()` (`js/icones.js`) e nos ícones do app (`tools/gerar-icones.mjs` gera `icons/*.png`: quadrado laranja, K branco). O arquivo mestre do designer, quando existir, substitui este redesenho.
- **Cores:** laranja da marca `#F26A1B` (símbolo, destaques, gráficos; sobre fundo escuro); laranja de ação `#C2410C` (botão com texto branco, 5,2:1; links); `#9A3412` ao passar o mouse; `#FFF2EA` item ativo. Grafite `#141B26` (topo, texto forte). Painel escuro do Início `#14161A` / `#1D2025`. Neutros `#F5F6F8` fundo, `#E4E7EC` borda, `#5D6B82` texto suave. Estados: info `#1D4ED8`, sucesso `#15803D`, atenção `#B54708`, erro `#B42318`. Na 1ª versão a cor do módulo (antes índigo) é o laranja (`:root[data-versao="primeira"]` em `css/app.css`).
- **Tipografia:** Inter; títulos 700; texto 400/500; números do painel 700.
- **Claro e escuro:** telas de trabalho claras; o Início em painel escuro.
- **Não fazer:** texto branco pequeno sobre `#F26A1B`; degradês, 3D ou foto no símbolo; índigo no Takeoff.
- **App instalado:** o build de produção (`tools/gerar-producao.mjs`) troca o nome do manifesto para "KORbuild Takeoff" (nome curto "Takeoff"). A homologação, que usa o mesmo código, mantém "KORbuild" no manifesto.
