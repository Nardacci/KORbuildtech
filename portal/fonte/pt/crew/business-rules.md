# Regras de negócio

Cada regra tem um código (`CRW-nnn`) para ser citada em reuniões, testes e pedidos de mudança. A coluna **Situação** diz se a regra já funciona no protótipo.

!!! note "Origem"
    Estas regras vêm do código do protótipo e da especificação do Crew registrada na documentação do projeto. Os pontos em aberto estão marcados como **A confirmar** no fim.

## Batidas

| Código | Regra | Situação |
|---|---|---|
| CRW-001 | Uma batida **nunca é editada nem apagada**. A correção é uma **batida nova**, marcada como ajuste, com quem fez, quando e o motivo. A original continua à vista. | Funcionando |
| CRW-002 | **Toda hora pertence a uma obra e a uma etapa (cost code).** É isso que permite o custo por obra. | Funcionando |
| CRW-003 | **Sem arredondamento.** Todo minuto é pago; a "regra dos 7 minutos" não é usada. | Funcionando |
| CRW-004 | O encarregado pode bater o ponto de **várias pessoas de uma vez**. Cada batida registra quem bateu. | Funcionando |
| CRW-005 | Cada batida registra a hora, a obra, a etapa, a posição do GPS e a precisão, se estava dentro da cerca, quem bateu e se teve foto. | Funcionando |
| CRW-006 | **Nota na batida (opcional):** na entrada, na troca de obra, na chegada e na saída, até 280 caracteres. Aparece para o escritório e não muda as horas. Os intervalos são um toque, sem nota. | Funcionando |
| CRW-007 | Só obras **em andamento** aparecem no ponto. | Funcionando |

## Cerca

| Código | Regra | Situação |
|---|---|---|
| CRW-010 | Cada obra tem uma **cerca**: a localização e um raio (150 m por padrão, de 50 a 2.000 m, definido no cadastro da obra). | Funcionando |
| CRW-011 | **A cerca sinaliza, não bloqueia.** A batida fora dela é aceita, marcada **fora da obra**, e vai para o escritório conferir. O GPS costuma errar dentro de estruturas de concreto. | Funcionando |
| CRW-012 | Sem GPS no celular, vale a localização da obra. | Funcionando |

## A jornada

| Código | Regra | Situação |
|---|---|---|
| CRW-020 | **O deslocamento entre obras durante a jornada é hora paga** (29 CFR 785.38). O trajeto de casa até a obra não é. | Funcionando |
| CRW-021 | **Na troca de obra**, a batida é feita onde a pessoa está (a obra de onde está saindo) e começa o deslocamento; a **Chegada** é conferida pela cerca da obra nova. | Funcionando |
| CRW-022 | **O intervalo não é pago.** O mínimo e depois de quantas horas vêm da regra de jornada (padrão de New Hampshire: 30 min depois de 5 horas, RSA 275:30-a). O intervalo que não foi feito gera alerta. | Funcionando |
| CRW-023 | **Saída que faltou:** um dia passado que ficou aberto não conta horas até alguém ajustar. Gera alerta e uma notificação para o encarregado. | Funcionando |

## Hora extra e timesheets

| Código | Regra | Situação |
|---|---|---|
| CRW-030 | **A hora extra segue a regra de jornada vigente** (Settings). Padrão da empresa: New Hampshire / FLSA federal — acima de **40 horas na semana** (segunda a domingo) paga **1,5×**. | Funcionando |
| CRW-031 | Se a regra tiver **hora extra diária** (por exemplo, acima de 8 h → 1,5×; acima de 12 h → 2×), as horas já pagas como extra diária não contam de novo para a extra semanal. | Funcionando |
| CRW-032 | Uma regra de jornada vale para semanas inteiras, a partir de uma segunda-feira. | Funcionando |
| CRW-033 | **Regular rate ponderada:** se o valor hora mudou no meio da semana, o adicional da hora extra (0,5×) é calculado sobre a média ponderada da semana. | Funcionando |
| CRW-034 | **Autônomos (1099) e isentos** não têm hora extra. Autônomos também não têm encargos. | Funcionando |
| CRW-035 | **Aprovação semanal:** o escritório aprova ou devolve a semana (com o motivo). Só semanas aprovadas vão para o CSV da folha. | Funcionando |
| CRW-036 | A semana não pode ser aprovada enquanto alguém estiver **sem saída**. | Funcionando |

## Custo

| Código | Regra | Situação |
|---|---|---|
| CRW-040 | **Valor hora com vigência:** uma mudança cria um valor novo "a partir de" uma data, com o motivo. O passado nunca é reescrito: cada dia usa o valor vigente naquele dia. | Funcionando |
| CRW-041 | Um valor hora novo não pode começar **dentro de uma semana já aprovada** (ela foi para a folha). | Funcionando |
| CRW-042 | **Custo da obra** = horas × valor vigente no dia + o adicional de hora extra **rateado entre as obras** pelas horas da semana + os **encargos** sobre a folha. | Funcionando |
| CRW-043 | **Encargos** têm vigência (Settings › Encargos). Padrão: 32,05% (FICA 7,65%, FUTA 0,60%, SUTA 2,80%, workers' comp 14,00%, benefícios 7,00%). | Funcionando |
| CRW-044 | **Projeção:** com o avanço físico, projeção ao final = realizado ÷ avanço. Sem ele, realizado + média das últimas 4 semanas completas × semanas que faltam até a data de término. | Funcionando |
| CRW-045 | **Situação da obra:** **No rumo** (projeção ≤ orçamento), **Atenção** (até 5% acima), **Estouro previsto** (mais de 5% acima). | Funcionando |

## Localização

| Código | Regra | Situação |
|---|---|---|
| CRW-050 | **Localização só com o ponto aberto.** Registrada em cada batida, quando o app é aberto durante a jornada e a cada 15 minutos na obra (a cada 5 em deslocamento). Nunca no intervalo, depois da saída ou fora do horário. A pessoa é avisada disso e precisa aceitar o aviso antes. | Funcionando na conta de verdade com o app aberto (simulado na demonstração); em segundo plano, com o app das lojas |
| CRW-051 | O mapa do dia é visto por quem acompanha o ponto (escritório). | Funcionando |

## Acesso

| Código | Regra | Situação |
|---|---|---|
| CRW-060 | **Valores em dinheiro** (custos, salários nos timesheets) exigem **Ver custos e valores em dinheiro**. Trabalhadores e encarregados veem horas, nunca dinheiro. | Funcionando |
| CRW-061 | **Aprovar, devolver, ajustar e exportar** exigem **Aprovar e ajustar timesheets**. Sem ela, os timesheets são só leitura. | Funcionando |
| CRW-062 | **Cada empresa bate o ponto do próprio pessoal.** Uma prestadora nunca vê as pessoas de outra empresa. Na obra de uma construtora, a construtora vê as pessoas da prestadora no canteiro — nomes, função, entrada, horas — mas **nunca salários, encargos ou custo**. | Funcionando |
| CRW-063 | A **construtora** não usa o Crew: ela gerencia as obras e não bate o ponto de ninguém. | Funcionando |

!!! confirm "A confirmar"
    - Se o workers' comp deve variar por função (encargos por função).
    - Prevailing wage (Davis-Bacon) em obras públicas: um valor por obra e por função.
    - Rateio da hora extra: pelas horas (hoje) ou para a obra que a causou; configurável por empresa?
    - Alertas de custo nas notificações quando uma obra fica em **Atenção** ou **Estouro previsto**.
    - Se o encarregado vê o orçamento de horas da obra (sem valores em dinheiro).
