# KORbuild Crew — documentação do módulo

> **O que é:** o módulo de ponto e horas em campo da plataforma KORbuild. Registra **quem trabalhou, onde, em qual etapa e por quanto tempo**, transforma isso em **timesheet aprovado para a folha** e em **custo de mão de obra por obra**, com orçado × realizado × projeção.
>
> **Mercado-alvo:** Estados Unidos (regras FLSA, US$). **Idioma do protótipo:** português; a tradução para inglês fica para o fim do projeto (ver o glossário na seção 13).
>
> **Documentos relacionados:** [`crew-analise.md`](crew-analise.md) (análise de negócio, mercado e concorrência, riscos), [`alertas.md`](alertas.md) (sininho), [`saas.md`](saas.md) (planos e módulos).

**Sumário**
1. Objetivo e tese
2. Perfis e permissões
3. Mapa das telas
4. Conceitos e dados
5. Regras de negócio
6. Fluxos principais
7. GPS, mapa do dia e registros de localização
8. Custos: valor hora, encargos, orçamento e projeção
9. Notificações (sininho)
10. Ligação com o Daily
11. Protótipo × produção (o que é simulado)
12. Requisitos e situação
13. Glossário PT → EN
14. Perguntas em aberto e próximos passos

---

## 1. Objetivo e tese

O Crew não vende "ponto eletrônico". Ele responde a três perguntas do dono da construtora ou da empreiteira:

1. **Quem trabalhou, onde e quanto?** É a prova da jornada: batidas com GPS, cerca da obra e foto.
2. **Quanto devo pagar?** É o timesheet semanal aprovado, com hora extra calculada e CSV para a folha.
3. **Quanto essa obra está custando, e vai fechar dentro do orçado?** É o custo por obra e etapa, com projeção para o fim.

O ponto alimenta o RDO do Daily (equipe do dia) e o custo da obra. **Nenhum concorrente pesquisado fecha esse ciclo ponto → RDO → custo num produto só.**

---

## 2. Perfis e permissões

Quem pode o quê vem dos **perfis de acesso** do Settings (configuráveis; ver [`settings.md` §5](settings.md)). Perfis prontos:

| Perfil | Quem é | O que faz no Crew | Onde |
| --- | --- | --- | --- |
| **Trabalhador** | Quem bate o próprio ponto (Diego) | **Meu ponto**: entrada, intervalo, troca de obra, saída, o dia e as horas da semana (sem valores) | Celular; entra direto no Meu ponto, sem a tela de módulos |
| **Encarregado** (campo) | Mestre de obras ou encarregado (Carlos, Roberto) | Bate o ponto da equipe toda e acompanha as horas dela; também preenche o RDO do Daily | Celular, abas **Ponto** e **Horas** |
| **Gestor de obras** | Diretora de obras (Márcia) | Acompanha, aprova timesheets e vê custos; não mexe no Settings | Computador |
| **Administrador** (escritório) | Gestor, RH ou financeiro (Ana) | Tudo do escritório, mais o Settings (funcionários, encargos, regras, usuários, perfis) | Computador, abas **Agora**, **Timesheets** e **Custos**, mais o **Settings** |

Regras de acesso:
- **Valores em dinheiro** (custos, salário nos timesheets) exigem a permissão "Ver custos e valores em dinheiro". O trabalhador e o encarregado veem horas, nunca dinheiro.
- **Aprovar, devolver, ajustar e exportar** exigem "Aprovar e ajustar timesheets". Sem ela, os timesheets ficam só para consulta.
- O mapa do dia (localização) é visto por quem acompanha o ponto; na versão real, também pelo próprio trabalhador.
- Login de demonstração: Diego (trabalhador), Carlos (encarregado) e Ana (administradora).

## 3. Mapa das telas

### Campo (encarregado)
| Tela | Rota | Para quê |
| --- | --- | --- |
| **Meu ponto** (trabalhador) | `#/crew/meu` | Relógio, estado do dia, botões grandes só com o que cabe agora (bater entrada, começar intervalo, ir para outra obra, bater saída), as batidas de hoje e as horas da semana |
| **Ponto da equipe** | `#/crew/equipe` | Lista da equipe com o estado de cada pessoa. O encarregado seleciona uma pessoa ou todas e usa os botões **Entrada · Intervalo · Volta · Trocar obra · Chegou · Saída**. Cada batida mostra a distância até a obra e se está dentro da cerca |
| **Horas da equipe** | `#/crew/horas` | Horas da semana por pessoa e dia, com alertas (sem saída, fora da obra, sem intervalo) |

### Escritório (admin)
| Tela | Rota | Para quê |
| --- | --- | --- |
| **Agora** | `#/crew/agora` | Quem está trabalhando em cada obra, em intervalo ou em deslocamento, e as batidas fora da obra para conferir |
| **Timesheets** | `#/crew/timesheets/<segunda>` | Semana de todos: horas por dia, total, extra, custo e situação. Também aprovar ou devolver em lote e exportar CSV |
| **Semana do funcionário** | `#/crew/semana/<id>/<segunda>` | Dia a dia de uma pessoa, com ajuste (nova batida com motivo) e acesso ao mapa do dia |
| **Dia do funcionário** | `#/crew/dia/<id>/<data>` | Mapa do dia, percurso, registros de localização, reprodução e linha do tempo (seção 7) |
| **Custos · Obras** | `#/crew/custos` | Orçado × realizado × projeção de cada obra, com gráfico acumulado e detalhe por etapa (seção 8) |
| **Custos · Mês** | `#/crew/custos/mes/<AAAA-MM>` | Custo do mês por obra e etapa: salários, hora extra e encargos |
| **Custos · Semana** | `#/crew/custos/semana/<segunda>` | O mesmo, na semana |

O **cadastro de funcionários** (com o valor hora e o histórico), os **encargos** e as **regras de jornada** ficam no **KORbuild Settings** ([`settings.md`](settings.md)), porque valem para todos os módulos. O Crew só lê de lá.

No celular, as telas do módulo aparecem em abas embaixo. No computador, ficam no menu lateral.

---

## 4. Conceitos e dados

| Conceito | O que é | Campos principais |
| --- | --- | --- |
| **Funcionário** | Pessoa que trabalha nas obras | nome, função, equipe, admissão, **valores** (histórico do valor hora) |
| **Valor hora** | Quanto a pessoa ganha por hora, **a partir de uma data** | desde, valor (US$), motivo, quem registrou, quando |
| **Equipe** | Grupo com um encarregado e uma obra base | nome, encarregado, obra base |
| **Obra** | Local de trabalho (vem da plataforma, compartilhada com o Daily) | nome, endereço, início, prazo, **cerca** (centro + raio de 150 m) |
| **Etapa** (cost code) | Serviço em que a hora foi gasta | Fundação, Estrutura, Alvenaria, Instalações… |
| **Batida** | Um registro de ponto. **Nunca é editada nem apagada** | tipo, hora, obra, etapa, GPS + precisão, dentro/fora da cerca, quem registrou, foto, ajuste (motivo, quem) |
| **Jornada** | O dia de uma pessoa, montado a partir das batidas, em segmentos: **trabalho** (obra + etapa), **intervalo** e **deslocamento** | trabalho, deslocamento, intervalo, pago, alertas |
| **Timesheet** (semana) | Segunda a domingo de uma pessoa | total, regular (até 40 h), extra, salário, situação (aberta, pendente, aprovado, devolvido) |
| **Registro de localização** | Ponto de GPS gravado durante a jornada (seção 7) | hora, posição, precisão, gatilho (batida, app aberto, periódico) |
| **Encargos** (labor burden) | % sobre a folha que a empresa paga além do salário | FICA, seguro-desemprego, workers' comp, benefícios |
| **Orçamento de mão de obra** | Quanto a obra pode gastar com mão de obra | valor total, valor por etapa, avanço físico (%) |
| **Histórico consolidado** | Horas de semanas já fechadas, guardadas resumidas por dia, pessoa, obra e etapa | data, pessoa, obra, etapa, minutos |

Tipos de batida: `entrada · intervalo-inicio · intervalo-fim · troca (sai rumo a outra obra) · chegada · etapa · saida`.

---

## 5. Regras de negócio

| # | Regra |
| --- | --- |
| **RN-01** | **Batida é imutável.** Correção é uma batida nova marcada como *ajuste*, com quem fez, quando e o motivo. A original continua visível. |
| **RN-02** | **Toda hora pertence a uma obra e a uma etapa.** É o que permite o custo por obra. |
| **RN-03** | **Sem arredondamento.** Paga-se o minuto. A "regra dos 7 minutos" não é usada. |
| **RN-04** | **Hora extra pela regra de jornada vigente (Settings).** Padrão da empresa: New Hampshire / FLSA federal, acima de **40 h na semana** (segunda a domingo) paga **1,5×**. Se a regra tiver hora extra diária (ex.: acima de 8 h → 1,5×; acima de 12 h → 2×), a hora que já virou extra no dia não conta de novo na semanal. A regra vale por semana inteira, a partir da segunda-feira. |
| **RN-05** | **Regular rate ponderada:** se o valor hora mudou no meio da semana, o adicional de hora extra (0,5×) é calculado sobre a média ponderada da semana (salário base ÷ horas). |
| **RN-06** | **Deslocamento entre obras durante a jornada é hora paga** (29 CFR 785.38). O trajeto casa → obra não é. |
| **RN-07** | **Intervalo não é pago.** O mínimo e depois de quantas horas vêm da regra de jornada (padrão de New Hampshire: 30 min depois de 5 h, RSA 275:30-a). Faltou, gera alerta. |
| **RN-08** | **Sem saída:** dia passado com a jornada aberta não conta horas até alguém ajustar. Gera alerta e aviso no sininho do encarregado. |
| **RN-09** | **Cerca sinaliza, não bloqueia.** Batida fora da cerca (150 m) é aceita, marcada "fora da obra" e vai para o escritório conferir. O GPS erra dentro de estrutura de concreto. |
| **RN-10** | **Ponto pela equipe:** o encarregado pode bater para várias pessoas de uma vez. A batida guarda quem registrou. |
| **RN-11** | **Aprovação semanal:** o escritório aprova ou devolve a semana (com motivo). Só semana aprovada vai para o CSV da folha. |
| **RN-12** | **Valor hora com vigência:** mudar o valor cria um registro "a partir de" com motivo. O passado nunca é reescrito: cada dia usa o valor vigente naquele dia. |
| **RN-13** | **Semana aprovada é fechada:** um novo valor hora não pode começar dentro de uma semana já aprovada, porque ela já foi para a folha. |
| **RN-13b** | **Autônomo (1099) e isento (exempt)** não recebem hora extra. Autônomo também não tem encargos. |
| **RN-14** | **Custo da obra** = horas × valor vigente no dia + adicional de hora extra **rateado entre as obras** pelas horas da semana + **encargos** sobre a folha. |
| **RN-15** | **Projeção:** com avanço físico informado, projeção = realizado ÷ avanço. Sem avanço, projeção = realizado + média das últimas 4 semanas completas × semanas que faltam até o prazo. |
| **RN-16** | **Situação da obra:** **No rumo** (projeção ≤ orçamento), **Atenção** (até 5% acima), **Estouro previsto** (mais de 5% acima). |
| **RN-17** | **Localização só com o ponto aberto.** Nada é gravado no intervalo, com o ponto fechado ou fora do expediente. O trabalhador é avisado. |

---

## 6. Fluxos principais

**Bater a entrada da equipe (campo).** O encarregado seleciona as pessoas e toca em **Entrada**. O app localiza o celular e mostra a distância até a obra ("dentro da cerca ✓" ou "fora da cerca"). Ele escolhe a etapa, pode tirar uma foto e confirma. Cada pessoa recebe uma batida.

**Trocar de obra.** O encarregado toca em **Trocar obra** e escolhe o destino. A batida é feita **onde ele está** (na obra de origem) e começa o *deslocamento*, que é hora paga. Na chegada, ele toca em **Chegou**: a batida é conferida contra a cerca da obra de destino.

**Intervalo e saída.** Os botões **Intervalo** e **Volta** cobrem o almoço, e **Saída** fecha o dia.

**Conferir batidas fora da obra (escritório).** Em **Agora**, a lista "para conferir" mostra as batidas fora da cerca, que o escritório marca como conferidas.

**Ajustar um dia.** Na semana do funcionário, o botão **Ajustar** cria uma batida nova (ex.: a saída esquecida) com hora e motivo obrigatórios.

**Aprovar e exportar.** Em **Timesheets**, o escritório seleciona as pessoas e aprova a semana (ou devolve com motivo). Depois exporta o **CSV** com uma linha por segmento (data, obra, etapa, início, fim, horas), pronto para QuickBooks, Gusto ou ADP.

**Alterar o valor hora.** Em **Settings › Funcionários › pessoa**, o escritório usa **Alterar valor hora** e informa:
- novo valor;
- **a partir de** (o padrão é a próxima segunda);
- **motivo** (obrigatório).

O sistema recusa uma data dentro de uma semana aprovada (RN-13). O histórico mostra a vigência, o valor, a variação em %, o motivo e quem registrou.

**Orçamento e avanço da obra.** Em **Custos › Obras**, o botão **Editar orçamento** define o orçamento total de mão de obra e o **avanço físico (%)** medido na obra. A projeção e a situação são recalculadas na hora.

**Encargos e regras de jornada.** Ficam em **Settings**, com **vigência**: cada mudança é uma nova versão "a partir de" (nunca no passado) e não muda o custo das semanas anteriores. A tela de Custos mostra os encargos em uso e leva até o Settings.

---

## 7. GPS, mapa do dia e registros de localização

### 7.1 Quando a localização é gravada (RN-17)
- **Batidas:** na entrada, na saída, na troca de obra e na chegada.
- **Abertura do app:** quando o app é aberto durante a jornada.
- **Periódico:** a cada **15 min** na obra e a cada **5 min** em deslocamento.
- **Nunca:** no intervalo, com o ponto fechado ou fora do expediente.

### 7.2 Tela do dia (`#/crew/dia/<id>/<data>`)
- **Resumo:** "Entrada 06:58 · Saída 17:07 · 46 registros · ≈ 37,8 km percorridos".
- **Mapa de ruas** (Leaflet + OpenStreetMap), com zoom, tela cheia e estes elementos:
  - pino verde **E** (entrada) e pino grafite **S** (saída);
  - obras numeradas na ordem da visita, com nome e endereço;
  - cerca da obra;
  - registros de localização em azul, ligados na ordem, com **setas no sentido do percurso**;
  - deslocamentos e saídas da cerca desenhados **pelas ruas** (OSRM);
  - batidas com horário;
  - pontos fora da cerca em vermelho.
- **Reproduzir (playback):** um marcador percorre o dia em ordem cronológica, com o relógio na tela. Dá para pausar.
- **Percurso do dia:** obra → deslocamento (km e minutos de carro) → obra, com o endereço de cada obra e o endereço aproximado das batidas fora da cerca (Nominatim).
- **Registros de localização:** a lista completa com número, hora, o que foi, onde, precisão do GPS e distância desde o anterior. Tocar num registro mostra o ponto no mapa.
- **Linha do tempo:** cada batida com cerca, precisão, quem registrou, foto e ajustes.

### 7.3 Situação do requisito
O rastreamento durante a jornada é o requisito **PONTO-GPS-01**, ainda **provisório**. A referência do QuickBooks Workforce e as perguntas em aberto estão em [`crew-analise.md` §5.5](crew-analise.md). Ele exige **app nativo**: um PWA não grava em segundo plano.

---

## 8. Custos: valor hora, encargos, orçamento e projeção

### 8.1 Valor hora e histórico
- Cada funcionário tem uma lista de valores com **vigência** ("a partir de"). O vigente é o último com data até hoje.
- Uma mudança futura aparece como "futuro" e passa a valer sozinha na data.
- **Custo carregado** = valor hora × (1 + encargos). É o que a hora realmente custa para a empresa.
- Exemplo (Lucas): US$ 35,00 desde a admissão e US$ 38,00 desde a licença de eletricista (+8,6%). As horas de cada dia usam o valor daquele dia.

### 8.2 Encargos sobre a folha (labor burden)
Valores padrão do protótipo, editáveis em **Settings › Encargos** (nova versão com data de início e motivo):

| Parte | % | O que é |
| --- | --- | --- |
| FICA | 7,65 | Social Security + Medicare (parte do empregador) |
| FUTA | 0,60 | Desemprego federal (na prática, só até US$ 7.000 por pessoa/ano) |
| SUTA | 2,80 | Desemprego estadual (taxa da empresa; conferir com o contador) |
| Workers' comp | 14,00 | Seguro de acidente de trabalho. Na construção é alto e varia por função |
| Benefícios | 7,00 | Saúde, férias, feriados |
| **Total** | **32,05** | |

### 8.3 Cálculo, com exemplo
Uma pessoa com valor hora de US$ 38 trabalhou 42 h na semana:

| Item | Conta | Valor |
| --- | --- | --- |
| Salário base | 42 h × US$ 38 | US$ 1.596,00 |
| Adicional de hora extra | 2 h × 0,5 × US$ 38 | US$ 38,00 |
| **Folha (bruto)** | | **US$ 1.634,00** |
| Encargos | 32,05% × 1.634 | US$ 523,70 |
| **Custo para a obra** | | **US$ 2.157,70** |

Se o valor mudou no meio da semana (seg–qua a US$ 38, qui–sex a US$ 41; 24 h + 18 h):
- base = 24 × 38 + 18 × 41 = US$ 1.650;
- regular rate = 1.650 ÷ 42 = US$ 39,29;
- adicional = 2 × 0,5 × 39,29 = US$ 39,29 (RN-05).

Quando a pessoa trabalhou em mais de uma obra, a hora extra é **rateada pelas horas** de cada obra naquela semana.

### 8.4 Visões de custo
- **Obras:** a visão principal para o dono da obra. Para cada obra mostra:
  - orçamento, realizado (% do orçamento), projeção ao final e sobra ou estouro projetado;
  - barras de **prazo decorrido × orçamento consumido × avanço físico**;
  - gráfico do **custo acumulado** (realizado), do **planejado** (orçamento distribuído no prazo) e da **projeção** até o fim, com dica ao passar o mouse;
  - tabelas "orçado × realizado por etapa" e "semana a semana".
- **Mês e Semana:** custo por obra e etapa, separado em salários, hora extra e encargos. Servem para fechamento e conferência.

### 8.5 Projeção e antecedência (RN-15, RN-16)
Exemplo do protótipo (Edifício Atlântico, 07/10/2026):

| | Valor |
| --- | --- |
| Orçamento de mão de obra | US$ 1.088.900 |
| Realizado | US$ 372.033 (34% do orçamento) |
| Prazo decorrido | 33% |
| Avanço físico | 31% |
| **Projeção** | 372.033 ÷ 0,31 = **US$ 1.200.105** |
| **Estouro previsto** | **US$ 111.205 (10,2%)** |

A obra gastou 34% do orçamento e fez 31% do serviço. Com um terço do prazo, o sistema já mostra que vai faltar dinheiro, a tempo de agir (renegociar, rever a equipe, cortar hora extra).

> **Limite importante:** o Crew enxerga a **mão de obra própria**. Lucro ou prejuízo da obra depende também de **material, subempreiteiros, equipamentos e da receita (contrato e medições)**. Ver a seção 14.

---

## 9. Notificações (sininho)

Sem SMS e sem e-mail: só o sininho e os alertas do sistema (ver [`alertas.md`](alertas.md)).

| Para | Quando | Mensagem |
| --- | --- | --- |
| Escritório | Semana anterior com timesheets pendentes | "N timesheets da semana passada aguardando aprovação" |
| Escritório | Batida fora da cerca nas últimas 48 h, não conferida | "Fulano: entrada fora da obra" |
| Encarregado | Pessoa da equipe ficou sem saída ontem | "Fulano ficou sem saída ontem: avise o escritório" |
| Encarregado | 8h de dia útil e ninguém da equipe bateu a entrada | "Sua equipe ainda não bateu a entrada hoje" |

---

## 10. Ligação com o Daily

- O **RDO do Daily** preenche a **equipe do dia** com a presença do Crew: quem bateu ponto naquela obra, por função, e quem faltou.
- **Próximo passo:** o **avanço físico** usado na projeção de custo deve vir do RDO (avanço por etapa) e das medições, em vez de ser digitado no Crew.

---

## 11. Protótipo × produção (o que é simulado)

| Item | Protótipo | Produção |
| --- | --- | --- |
| Dados | localStorage do navegador, com dados de exemplo (VERSAO_DADOS) | Banco multi-empresa (tenant) com auditoria |
| GPS na batida | GPS do navegador; se não houver, a posição da obra | GPS do app, com precisão e checagens contra GPS falso |
| Registros de localização | **Simulados** a partir das batidas | GPS do app nativo em segundo plano, com aviso e consentimento |
| Rotas e endereços | OSRM e Nominatim públicos (gratuitos, com limite de uso) | Provedor pago (Google, Mapbox ou HERE) |
| Histórico de horas | Semanas antigas geradas como histórico consolidado | Timesheets reais aprovados |
| Encargos | Um % para a empresa toda | Por estado e por função (workers' comp por classe), com vigência |
| Orçamento | Digitado; etapas geradas | Importado do orçamento da obra (Measure) e versionado |
| CSV da folha | Arquivo genérico | Integrações (QuickBooks, Gusto, ADP) e folha certificada (WH-347) |

---

## 12. Requisitos e situação

| Código | Requisito | Situação |
| --- | --- | --- |
| CREW-01 | Ponto pela equipe com GPS, cerca e foto | Protótipo · MVP |
| CREW-02 | Troca de obra com deslocamento pago | Protótipo · MVP |
| CREW-03 | Intervalo e alertas de jornada | Protótipo · MVP |
| CREW-04 | Ajuste por nova batida com motivo (auditoria) | Protótipo · MVP |
| CREW-05 | Timesheet semanal com hora extra FLSA, aprovação e CSV | Protótipo · MVP |
| CREW-06 | Painel "Agora" e batidas fora da obra para conferir | Protótipo · MVP |
| CREW-07 | Custo por obra e etapa (semana e mês) | Protótipo · MVP |
| CREW-08 | **Valor hora com histórico e vigência** | Protótipo · MVP |
| CREW-09 | **Encargos sobre a folha (custo carregado)** | Protótipo · MVP |
| CREW-10 | **Orçamento de mão de obra por obra e etapa, orçado × realizado** | Protótipo · MVP |
| CREW-11 | **Projeção ao final da obra e situação (no rumo, atenção, estouro)** | Protótipo · MVP |
| CREW-12 | Equipe do RDO vinda do ponto | Protótipo · MVP |
| PONTO-GPS-01 | Registros de localização durante a jornada, mapa e reprodução | Protótipo · **em estudo** (ver crew-analise §5.5) |
| CREW-13 | Cerca que lembra de bater o ponto (nunca bate sozinha) | Fase 2 |
| CREW-14 | Avanço físico vindo do Daily e das medições | Fase 2 |
| CREW-15 | Integração com a folha e folha certificada | Fase 2 |
| CREW-16 | Custo total da obra (material, subempreiteiros, equipamentos) e margem | Em estudo |

---

## 13. Glossário PT → EN (para a tradução final)

| Português (protótipo) | Inglês (produto) |
| --- | --- |
| Ponto / bater o ponto | Time clock / clock in, clock out |
| Batida | Punch / time entry |
| Entrada / Saída | Clock in / Clock out |
| Intervalo | Break (meal break) |
| Trocar obra / Chegou | Switch job / Arrived |
| Encarregado | Foreman / crew lead |
| Ponto pela equipe | Crew clock |
| Etapa | Cost code / phase |
| Cerca da obra | Geofence |
| Registros de localização | GPS breadcrumbs / location points |
| Reproduzir | Playback |
| Timesheet / semana | Timesheet / pay week |
| Hora extra | Overtime (OT) |
| Valor hora | Hourly rate / pay rate |
| Vigência ("a partir de") | Effective date |
| Encargos sobre a folha | Labor burden |
| Custo carregado | Burdened labor cost |
| Orçamento de mão de obra | Labor budget |
| Avanço físico | Percent complete |
| Projeção ao final | Estimate at completion (EAC) / forecast |
| Estouro previsto | Projected overrun |

---

## 14. Perguntas em aberto e próximos passos

1. **Lucro ou prejuízo da obra.** Hoje o Crew mostra se a **mão de obra** vai caber no orçamento. Para lucro ou prejuízo faltam:
   - a **receita** (valor do contrato e medições faturadas);
   - os outros custos: **material, subempreiteiros e equipamentos**.

   Isso pode ficar numa visão "Resultado da obra" da plataforma, alimentada pelo Crew (mão de obra), pelo Measure (quantidades e orçamento) e por integração com a contabilidade (QuickBooks).
2. **Avanço físico:** vem do RDO (por etapa), de medição ou dos dois? Quem informa e com que frequência?
3. **Encargos por função:** (os encargos já são da empresa, com vigência, no Settings) o workers' comp varia muito por classe (eletricista × servente). Vale ter encargos por função?
4. **Prevailing wage (Davis-Bacon):** em obra pública o valor hora depende da obra e da função. Para isso será preciso valor hora **por obra** além do valor da pessoa.
5. **Rateio da hora extra:** proporcional às horas (atual) ou para a obra que causou a extra? Configurável por empresa?
6. **Alertas de custo no sininho:** avisar quando uma obra mudar para "Atenção" ou "Estouro previsto"?
7. **Quem vê o quê:** o encarregado deve ver o orçamento de horas da sua obra (sem valores em dinheiro)?
