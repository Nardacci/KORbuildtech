# Situação do protótipo

O que é simulado no protótipo hoje, e o que vem depois.

## Simulado hoje

| Item | No protótipo | No produto |
|---|---|---|
| Onde ficam os dados | Só no navegador de cada aparelho. | Um banco de dados na nuvem, separado por empresa, com trilha de auditoria. |
| GPS na batida | O GPS do navegador; sem ele, a localização da obra. | O GPS do app das lojas, com a precisão e checagem contra GPS falso. |
| Localização durante a jornada (trajeto) | **Simulada** a partir das batidas (o mapa diz *Trilha simulada*). | O GPS do app das lojas em segundo plano, com aviso e consentimento. Um app web não consegue registrar em segundo plano. |
| Mapas de ruas, rotas e endereços | Serviços públicos gratuitos (OpenStreetMap, OSRM, Nominatim), com limites de uso; sem internet, um desenho simples. | Um fornecedor pago (Google, Mapbox ou HERE). |
| Semanas passadas | Geradas como histórico resumido. | Os timesheets aprovados de verdade. |
| Encargos | Um % para a empresa toda, com vigência. | Por estado e por função (classe do workers' comp). |
| Orçamento de mão de obra | Digitado; etapas geradas. | Importado do orçamento da obra (Measure), com versões. |
| Folha | Um arquivo CSV genérico. | Integrações (QuickBooks, Gusto, ADP) e certified payroll (WH-347). |

## O que vem depois

| Item | Observações |
|---|---|
| Lembrete de entrada pela cerca | Lembra o trabalhador quando ele chega na obra; nunca bate a entrada sozinho. |
| Avanço físico vindo do Daily e do Measure | No lugar de digitar em Custos. |
| Integrações com a folha e certified payroll | Fase 2. |
| Custo completo da obra (materiais, subempreiteiros, equipamentos) e margem | Em estudo: o Crew vê só a mão de obra própria. |
