# Situação do protótipo

O que é simulado no protótipo hoje, e o que vem depois.

## Simulado hoje

| Item | No protótipo | No produto |
|---|---|---|
| Onde ficam os dados | No navegador. | Um banco de dados na nuvem, separado por empresa, com a auditoria no servidor. |
| Novos usuários | Criados na tela Usuários; nenhum e-mail é enviado e não há senhas de verdade. | Um convite por e-mail; a pessoa cria a senha (ou entra pelo provedor de identidade da empresa). |
| Mapa no cadastro da obra | Mapas públicos gratuitos (OpenStreetMap), com limite de uso. | Um provedor de mapas pago e busca de endereço. |
| Encargos | Um % para a empresa toda, com vigência. | Por estado e por ofício (classe do workers' comp). |
| Logo | Guardado no navegador. | O armazenamento na nuvem da empresa. |

## Ainda fixo no código

Estes valores são iguais para todas as empresas hoje e vão passar para o Settings:

| Valor | Hoje | Vai para |
|---|---|---|
| Prazo e lembretes do diário | Prazo às 18h, lembrete às 16h, alerta ao escritório às 8h do dia seguinte, 3 dias para trás | Settings › Diário de obra (e por obra) |
| Raio padrão da cerca | 150 m | Settings › Ponto e GPS (e por obra) |
| Intervalo da localização durante o dia | 15 min (5 min em deslocamento) | Settings › Ponto e GPS |
| Alertas de custo | Atenção até 5% acima; previsão pelas últimas 4 semanas | Settings › Custos e previsão |
| Listas do diário | Ofícios, equipamentos, tipos de ocorrência | Settings › Listas (as mesmas do Crew) |

## O que vem depois

| Item | Observações |
|---|---|
| Permissões por obra | Um encarregado vê só as obras dele; um gestor de obras só a região dele. |
| Regras de jornada por obra | Prevailing wage (Davis-Bacon), obras em outro estado. |
| Convites por e-mail | Para usuários, e para prestadoras convidadas por uma construtora. |
| Integração com a folha | QuickBooks, Gusto, ADP. |
| Preferências de notificação | Por usuário. |
