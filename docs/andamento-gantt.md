# Andamento dos projetos e página do Gantt (1ª versão)

Pedido do dono (27/10): o Início precisa mostrar uma prévia do andamento dos projetos e se estão atrasados ("o principal de tudo"); e uma página só com o gráfico de Gantt no tamanho da página, com uma lista para trocar de projeto e o cabeçalho padrão.

## O que é "andamento" (js/andamento.js)
- Cada tarefa do cronograma do projeto ganhou **% feito** (`pct`, 0 a 100), informado pela equipe na aba Schedule. É o único dado novo; vai no mesmo JSON `cronograma` do projeto (nada muda no banco).
- **Previsto** = quanto devia estar feito hoje pelo calendário: dias corridos desde o início ÷ duração (por tarefa; o do projeto é a média ponderada pela duração).
- **Feito** = média ponderada do % feito pela duração.
- **Tarefa atrasada** = devia ter terminado (término < hoje) e não chegou a 100%.
- **Situação do projeto:** `atrasado` (alguma tarefa atrasada) · `em-dia` · `nao-iniciado` (hoje antes da primeira tarefa) · `concluido` (tudo em 100%) · `sem-cronograma`. Projetos perdidos ficam de fora.

## Onde aparece
- **Schedule do projeto:** coluna % feito; na linha do tempo, a barra preenche o % e a tarefa atrasada fica vermelha (nome e barra); atalho **Tela inteira** para a página do Gantt.
- **Página Gantt** (`#/measure/gantt/<projeto>`, item Gantt no menu): lista de projetos com cronograma (atrasados primeiro, com "· Atrasado" no nome), quatro indicadores (situação, feito × previsto, início → término, tarefas) e o gráfico no tamanho da página. Botão **Editar o cronograma** leva à aba Schedule.
- **Início › Andamento dos projetos:** primeiro bloco do painel. Uma linha por projeto: situação, barra do feito com o tracejado do previsto, a tarefa mais atrasada (ou o término previsto / data de início); resumo com atrasados, em dia, não iniciados, concluídos e projetos ganhos sem cronograma. Cada linha abre o Gantt do projeto.

## Dados de demonstração
A Reforma de cozinha (ganha) tem um cronograma em andamento com uma tarefa atrasada (drywall em 60%); as Townhouses têm um cronograma futuro (não iniciado).

## Testes
`tests/projeto-espaco.test.mjs` (coluna % feito, atrasada, página do Gantt) e `tests/inicio-primeira-versao.test.mjs` (bloco do Início na conta real).
