# Gantt físico-financeiro · fatia 1: valor por tarefa e curva S

Cada tarefa do cronograma passa a ter um **valor**, vindo do Takeoff, e a página do Gantt mostra a **curva S** do projeto.

## Como o valor é calculado (`js/valor-cronograma.js`)
- **Valor da tarefa = material (+ imposto) + horas × custo da hora da função** (+ equipamento e subempreiteiro, se houver). As quantidades vêm das medições com assemblies (`quantidadesDoProjeto`) e os preços de `precoEm`/`custoDe`, os mesmos da proposta. O custo da hora da função já inclui os encargos da data.
- **Ligação tarefa ↔ Takeoff pela etapa (cost code) do item.** A tarefa gerada em Schedule › "Gerar a partir das etapas" guarda `etapa`; renomear a tarefa não quebra a ligação. Tarefa criada à mão usa o próprio nome como etapa. Etapa em mais de uma tarefa: o valor é dividido por igual.
- O que o Takeoff calculou e nenhuma tarefa recebeu aparece como **"Fora do cronograma"** (não entra no total das tarefas). Item sem preço fica de fora e é listado.
- **Base dos valores** (seletor "Valores em", guardado só neste aparelho): **Custo**, **Custo + overhead** ou **Preço de venda** (padrão), com as margens que valem hoje (Settings › Preços e margens).

## Curva S
- **Previsto:** o valor de cada tarefa espalhado por igual nos dias dela (dias corridos), somado dia a dia, acumulado.
- **Feito:** valor × % feito da tarefa, somado. O ponto verde é o feito de hoje; a linha vermelha tracejada é hoje.
- Resumo: valor total, previsto até hoje, feito até hoje e a diferença (negativa em vermelho).

## Onde aparece
Página **Gantt** (`#/measure/gantt/<projeto>`), abaixo do gráfico: resumo, curva S e a tabela por tarefa (horas, material, mão de obra, valor na base escolhida, % do total, feito).

## O que ainda não faz (próximas fatias)
- Fatia 2: horas lançadas no RDO e conciliação com as horas orçadas.
- Fatia 3: custo real do Crew contra o orçado.
- A curva S usa só o previsto linear; sem curva realizada dia a dia (precisa do histórico do % feito).

## Teste
`tests/gantt-valor.test.mjs` (conta de demonstração): valor da tarefa contra a conta à parte, etapa sem tarefa, total, curva que só sobe, feito = valor × %, troca de base e base guardada.

## Fatia 2: horas orçadas × apontadas nos diários
- **No diário (RDO):** a atividade que aponta uma "Tarefa do cronograma" ganhou o campo **Horas gastas nesta tarefa hoje (todas as pessoas somadas)**. Vai no mesmo JSON do diário (nenhuma migração) e aparece no relatório da atividade (`· 24 h`).
- **Fonte única:** as horas apontadas são lidas dos diários **aprovados** da obra do projeto (`horasApontadas`), nunca copiadas para a tarefa. Diário enviado e ainda não aprovado não conta; atividade sem tarefa também não.
- **Horas orçadas:** as horas dos itens de mão de obra medidos no Takeoff para a etapa da tarefa (fatia 1).
- **Bloco "Horas: orçado e apontado"** na página do Gantt (só aparece com horas orçadas ou apontadas): por tarefa, orçadas, apontadas (e quantos diários), consumo ÷ % feito, projeção e custo das horas (horas apontadas × custo médio da hora da tarefa, que já inclui os encargos da função).
- **Situação:** *Dentro do orçado* · *Horas acima do avanço* (consumo maior que o % feito + 10 pontos) · *Passou do orçado* (apontou mais do que o orçado). A projeção (apontadas ÷ % feito) só aparece com 10% ou mais feito.
- **Teste:** `tests/gantt-horas.test.mjs` (Takeoff + diários aprovados e enviados, vírgula decimal, projeção, custo, os dois alertas) e, em `tests/daily-primeira-versao.test.mjs`, o ciclo completo: digitar as horas no diário, aprovar e ver no Gantt.
- **Ainda não faz:** horas por função (o custo usa a média da tarefa) e o custo real do Crew (fatia 3).

## Fatia 3: custo real do ponto (Crew) × orçado
- **Bloco "Custo real do ponto × orçado"** na página do Gantt; só aparece se a obra do projeto tem ponto lançado no Crew (empresa com o módulo).
- **Real:** o custo que o próprio Crew calcula (`lancamentosDaSemana`): salário base do dia + adicional de hora extra + encargos, na obra do projeto. Sem cópia: é lido do ponto a cada abertura.
- **Ligação com a tarefa:** pelo **nome da etapa** que a pessoa escolheu ao bater o ponto (a etapa da obra deve ter o nome da tarefa; as etapas que nascem do cronograma do projeto já têm). Ponto em etapa que nenhuma tarefa tem (deslocamento, limpeza) fica em "Ponto sem tarefa": entra no custo real total, não nas tarefas.
- **Orçado:** a mão de obra do Takeoff a **custo** (função × horas, com encargos), sem overhead nem lucro, porque o ponto também é custo. A curva S da fatia 1 continua na base escolhida.
- **Por tarefa:** orçado · real (e horas do ponto) · real − orçado · orçado × % feito (o que já devia ter custado pelo avanço) · projeção ao término (real ÷ % feito, a partir de 10%) · situação: *Dentro do orçado*, *Custo acima do avanço* (real mais de 10% acima do orçado × % feito) e *Passou do orçado*.
- **Resumo:** mão de obra orçada, custo real até hoje (inclui o ponto sem tarefa), orçado × % feito e projeção ao término (em vermelho se passar do orçado).
- **Limite conhecido:** em conta com banco, as etapas da obra são do servidor; se o nome da etapa do ponto não bater com o da tarefa, o custo cai em "Ponto sem tarefa". Nada de banco foi alterado nas três fatias.
- **Teste:** `tests/gantt-real.test.mjs` (ponto de 8 h na etapa da tarefa e 2 h fora, a US$ 40/h com encargos; real, variação, orçado × % feito, projeção, ponto sem tarefa e o alerta de estouro).

## Resumo das três fatias
1. Valor por tarefa e curva S (`valor-cronograma.js`, `gantt-valor.test.mjs`).
2. Horas gastas no diário × horas orçadas (`gantt-horas.test.mjs`).
3. Custo real do Crew × mão de obra orçada (`gantt-real.test.mjs`).
