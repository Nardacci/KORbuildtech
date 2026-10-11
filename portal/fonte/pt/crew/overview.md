# Visão geral

O **Crew** é o ponto da equipe. Ele registra **quem trabalhou, onde, em qual etapa e por quanto tempo**, transforma isso em **timesheets semanais aprovados para a folha** e em **custo de mão de obra por obra**: orçado × realizado × projeção até o fim.

## As três perguntas que ele responde

1. **Quem trabalhou, onde e quanto?** Batidas com GPS, a cerca da obra e uma foto da equipe, se quiser.
2. **Quanto eu pago?** O timesheet da semana, com a hora extra calculada pela regra de jornada da empresa, aprovado e exportado para a folha num arquivo CSV.
3. **Quanto esta obra está custando, e ela vai terminar dentro do orçamento?** O custo de mão de obra por obra e por etapa, com a projeção até o fim — a tempo de agir.

As mesmas batidas preenchem a equipe do diário do **Daily**, então o campo informa a equipe uma vez só.

## Quem usa

| Quem | Onde | O que faz |
|---|---|---|
| **Trabalhador** | Celular | **Meu ponto**: bate entrada e saída no próprio celular, vê as próprias batidas e as horas da semana (nunca valores em dinheiro). |
| **Encarregado** | Celular | **Ponto da equipe**: bate o ponto da equipe inteira por um celular só; **Horas**: a semana da equipe, com alertas. |
| **Escritório** (administrador, gestor de obras) | Computador | **Agora** (quem está trabalhando onde), **Timesheets** (aprovar, devolver, ajustar, exportar), **Custos** (orçado, realizado, projeção). |

Funcionários, valores hora, encargos e regras de jornada ficam no **Settings**, porque todos os módulos usam. O Crew só lê.

O Crew é das empresas que executam (as prestadoras). A construtora não bate ponto: ela vê, no Daily, as pessoas e as horas das prestadoras nas obras dela, sem valores (veja [Como o KORbuild se organiza](@/organization.html)).

## As telas principais

| Tela | Quem vê | O que mostra |
|---|---|---|
| **Meu ponto** | Trabalhador | O relógio, a situação de hoje, um botão grande com o que cabe agora (entrada, intervalo, troca de obra, saída), as batidas de hoje e a semana. |
| **Ponto da equipe** | Encarregado | A equipe, com a situação de cada pessoa; selecione as pessoas e use **Entrada · Intervalo · Volta · Trocar de obra · Chegou · Saída**. |
| **Horas** | Encarregado | As horas da semana da equipe, por pessoa e por dia, com alertas. |
| **Agora** | Escritório | Quem está trabalhando em cada obra, em intervalo ou em deslocamento, e as batidas fora da obra para conferir. |
| **Timesheets** | Escritório | A semana de todos: horas por dia, total, hora extra, custo e situação; aprovar, devolver e exportar. |
| **Semana do funcionário** | Escritório | Os dias de uma pessoa, com **Ajustar** (uma batida nova, com motivo) e o **Mapa do dia**. |
| **Mapa do dia** | Escritório | O dia num mapa de ruas: batidas, a cerca da obra, o trajeto, **Reproduzir** e a linha do tempo. |
| **Custos** | Escritório (com a permissão de custos) | Por obra (orçado, realizado, projeção, gráfico), por mês e por semana. |

![Meu ponto, no celular do trabalhador](img/crew-my-clock-before-mobile.png)

![Agora: quem está trabalhando em cada obra](img/crew-now.png)

## Ideias principais

| Termo | O que é |
|---|---|
| **Batida** | Um registro do ponto: entrada, início do intervalo, fim do intervalo, troca de obra, chegada, saída. Uma batida **nunca é editada nem apagada**; a correção é uma batida nova, marcada como ajuste, com quem fez e por quê. |
| **Cerca** | Um círculo em volta da obra (150 m por padrão, definido em cada obra). A batida fora dele é aceita, mas fica marcada para o escritório conferir. |
| **Etapa (cost code)** | O serviço em que a hora foi gasta (fundação, estrutura, alvenaria…). Toda hora pertence a uma obra e a uma etapa. |
| **Deslocamento** | Ir de uma obra para outra durante a jornada. É hora paga. |
| **Timesheet** | A semana de uma pessoa, de segunda a domingo: horas totais, normais e extras, custo e situação. |
| **Encargos** | O que a empresa paga além do salário (FICA, desemprego, workers' comp, benefícios), como % da folha. |
| **Custo carregado** | Valor hora × (1 + encargos): o que uma hora realmente custa à empresa. |
| **Projeção ao final** | Para onde vai o custo de mão de obra da obra, pelo que foi gasto e pelo quanto da obra já foi executado. |

## Ligado aos outros módulos

- **Daily:** a equipe do diário pode vir de quem bateu ponto na obra naquele dia.
- **Obras** (Settings › Obras): a localização da obra e o raio da cerca vêm do cadastro da obra. Só obras **em andamento** aparecem no ponto.
- **Settings:** funcionários e valores hora (com vigência), encargos, regras de jornada (hora extra e intervalo).
