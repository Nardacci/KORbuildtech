# Situação do protótipo

O protótipo (a demonstração com dados de exemplo) mostra o produto funcionando. Ao lado dele, a **conta de verdade** já roda o ponto no banco de dados na nuvem e está em homologação. Esta página diz o que é real hoje e o que ainda é simulado na demonstração.

## Já funciona no banco de dados (conta de verdade)

| Item | Como funciona hoje |
|---|---|
| Ponto | O encarregado bate o ponto da equipe e o trabalhador bate o próprio ponto no celular, com ou sem internet: o celular guarda a batida e envia quando o sinal volta, **com a hora em que foi batida**. Batida nunca é editada nem apagada; o banco recusa. |
| Cerca | Conferida pelo banco em cada batida; fora da cerca a batida é aceita, marcada e listada para o escritório conferir. |
| Escritório | Conferir, ajustar (uma batida nova com o motivo), aprovar e devolver a semana, orçamento de mão de obra. Semana com dia sem saída não aprova; semana aprovada é fechada: sem batida atrasada, sem ajuste e sem valor hora novo dentro dela. |
| Localização durante a jornada | Depois que o trabalhador aceita o **aviso de localização** no app, o celular registra a posição enquanto o app está aberto e o ponto, aberto: ao abrir o app e a cada 15 minutos na obra (5 em deslocamento). Nunca no intervalo nem com o ponto fechado — o banco recusa. O mapa do dia mostra os registros reais e avisa dos trechos sem registro (app fechado). |
| Construtora | Vê nomes, funções e horas das pessoas das prestadoras nas obras dela — nunca salários, custos nem localização. |

## Simulado hoje (na demonstração)

| Item | No protótipo | No produto |
|---|---|---|
| Onde ficam os dados | Só no navegador de cada aparelho. | O banco de dados na nuvem, separado por empresa, com trilha de auditoria — **já funciona** na conta de verdade. |
| GPS na batida | O GPS do navegador; sem ele, a localização da obra. | O GPS do app das lojas, com a precisão e checagem contra GPS falso. |
| Localização durante a jornada (trajeto) | **Simulada** a partir das batidas (o mapa diz *Trilha simulada*). | **Já funciona** com o app aberto, depois do consentimento do trabalhador. Com o app fechado ou a tela bloqueada o navegador não grava: essa parte precisa do app das lojas, que vai usar o mesmo banco. |
| Mapas de ruas, rotas e endereços | Serviços públicos gratuitos (OpenStreetMap, OSRM, Nominatim), com limites de uso; sem internet, um desenho simples. | Um fornecedor pago (Google, Mapbox ou HERE). |
| Semanas passadas | Geradas como histórico resumido. | Os timesheets aprovados de verdade — **já funciona**. |
| Encargos | Um % para a empresa toda, com vigência. | Por estado e por função (classe do workers' comp). |
| Orçamento de mão de obra | Digitado; etapas geradas. | Importado do orçamento da obra (Measure), com versões. |
| Folha | Um arquivo CSV genérico. | Integrações (QuickBooks, Gusto, ADP) e certified payroll (WH-347). |

## O que vem depois

| Item | Observações |
|---|---|
| Foto da equipe na batida | A conta de verdade registra que houve foto; capturar e guardar a foto vem a seguir. |
| Lembrete de entrada pela cerca | Lembra o trabalhador quando ele chega na obra; nunca bate a entrada sozinho. |
| Avanço físico vindo do Daily e do Measure | No lugar de digitar em Custos. |
| Integrações com a folha e certified payroll | Fase 2. |
| Custo completo da obra (materiais, subempreiteiros, equipamentos) e margem | Em estudo: o Crew vê só a mão de obra própria. |
