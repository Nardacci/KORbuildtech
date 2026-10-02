# KORbuild Daily — RDO obrigatório e régua de alertas

O responsável pelo canteiro é obrigado a enviar o RDO de cada dia de trabalho. Este documento descreve como o produto cobra isso sem virar ruído.

## Decisões

| Tema | Decisão |
| --- | --- |
| Prazo diário | **18h** do próprio dia |
| Lembrete | **16h** (2h antes do prazo) |
| Canais | **Sininho** (central de notificações do app) e **notificação do sistema** no celular. Sem SMS e sem e-mail por enquanto: dispensam cadastro e permissão de terceiros |
| Escalada para o escritório | **Na manhã seguinte, às 8h** |
| Dias cobrados | Os dias de trabalho do calendário da obra (padrão: segunda a sábado) |

## Régua

| Quando | Para quem | Canal | Mensagem |
| --- | --- | --- | --- |
| 16h | Responsável pela obra | Sininho + notificação no celular | "Falta o RDO de hoje do {obra}. Prazo: 18h." |
| 18h | Responsável pela obra | Sininho + notificação no celular | "O RDO de hoje do {obra} está atrasado. Toque para preencher." |
| Ao abrir o app | Responsável pela obra | Tela Hoje | Faixa vermelha com os RDOs atrasados e faixa âmbar com o que falta hoje (e quanto tempo falta) |
| 8h do dia seguinte | Escritório (administradores) | Sininho + painel | Lista das obras sem RDO no último dia de trabalho, com o responsável |

## Regras

1. **Responsável por obra.** Cada obra tem um responsável pelo RDO (usuário de campo). Os alertas vão para ele.
2. **Dia cumprido** = RDO enviado (mesmo que ainda guardado no aparelho, sem internet) ou dia registrado como **sem atividade**.
3. **Sem atividade.** Chuva, feriado, obra paralisada, falta de material, greve ou outro motivo. Fica registrado como o RDO do dia, vai para o escritório e para os alertas daquele dia. Vale como documento: justifica o dia sem produção.
4. **Calendário da obra.** Dias que não são de trabalho não geram alerta. Se houver serviço, o RDO pode ser feito assim mesmo.
5. **Atrasado continua aceito, mas marcado.** São cobrados os 3 últimos dias de trabalho. O RDO preenchido depois do prazo mostra no relatório e no PDF: "Enviado com atraso: {data e hora} · prazo era {data} às 18:00". O que vale é o **primeiro envio** (um reenvio por ajustes não conta como atraso).
6. **Contador.** A aba Hoje mostra o total de pendências: dias atrasados, obras sem RDO hoje e ajustes pedidos. No celular, o mesmo número aparece no ícone do app (onde o sistema permite).

## Canais: o que esperar

- **Sininho:** central de notificações dentro do app, na barra superior de todos os módulos, com contador de não lidas. Sem custo e sem cadastro.
- **Notificação do sistema (celular):** sem custo. Android: funciona com o app instalado ou aberto no navegador. iPhone: só com o app instalado na tela inicial (iOS 16.4+). Na versão final, o servidor envia mesmo com o app fechado.
- **SMS e e-mail: fora por enquanto.** SMS nos EUA exige o registro A2P 10DLC e consentimento (TCPA). Podem voltar depois, se as entrevistas mostrarem necessidade.

## No protótipo

| Item | Situação |
| --- | --- |
| Responsável, prazo e calendário da obra (visíveis para o administrador) | Funcionando; edição vem depois |
| Faixas de atraso e do prazo de hoje, contador nas abas e no ícone do app | Funcionando |
| Preencher RDO atrasado (inclusive copiando de um RDO anterior) e marca de atraso no relatório | Funcionando |
| "Sem atividade" com motivo | Funcionando |
| Escalada no painel do escritório e no sininho | Funcionando |
| Notificação real no celular ("Testar no celular") e lembretes às 16h/18h | Funcionam **com o app aberto** |
| Notificação com o app fechado | Precisa de servidor (versão final) |
