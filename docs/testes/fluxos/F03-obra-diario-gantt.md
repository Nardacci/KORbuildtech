# F03 · Obra: diário do campo, aprovação e o % feito no Gantt

**Objetivo:** provar o ciclo do Daily na conta real: o encarregado preenche o diário do projeto liberado apontando a tarefa do cronograma, o administrador aprova, o % feito vai para o Gantt, o Início e o sininho mostram o andamento e o atraso.

**Roda em:** conta real contra o banco local, em português; o encarregado no celular (390 × 844, com GPS) e o administrador no computador. O protótipo tem a suíte própria (`daily-primeira-versao`).
**Comando:** `node tests/fluxo-03-obra-diario-gantt.test.mjs --relatorio`

**Pré-condições (feitas pelo teste, `tests/_fluxo-dados.mjs`, apagadas no fim):** a empresa dos fluxos com Fábio Fluxo (Administrador) e Eduardo Encarregado (perfil Encarregado: ponto e diário); projeto **"Reforma Mitchell"** já liberado para obra, com a obra criada pelo banco, começando hoje (o início da obra é uma data própria, `inicio_obra`, e não a da primeira tarefa) e três tarefas no cronograma: **"Demolição e remoção"** (começou há 10 dias, 3 dias, 0% feito: passou do fim, está atrasada), **"Instalação de drywall"** (começa hoje, 5 dias, 20% feito) e **"Pintura"** (daqui a 6 dias, 4 dias, prestadora, 0%).

**Dados fixos:** atividade "Instalação de drywall na garagem", tarefa "Instalação de drywall" com 60% feito.

| # | Quem | Onde | O que faz | Esperado |
|---|---|---|---|---|
| 1 | Eduardo (encarregado, celular) | Daily › Hoje | Abrir o Daily | Entra direto no "Hoje" e "Reforma Mitchell" aparece em "Seus projetos"; sem botão de nova obra |
| 2 | Eduardo (encarregado, celular) | Daily › Hoje › Reforma Mitchell | Abrir o projeto | "Etapa atual: Instalação de drywall" (a Demolição passou do fim e a Pintura ainda não começou); botão "Nova RDO" e nenhum RDO atrasado de dias anteriores à liberação |
| 3 | Eduardo (encarregado, celular) | Nova RDO › Clima, Equipe e Atividades | Marcar o clima da manhã e da tarde, uma função na equipe e escrever a atividade "Instalação de drywall na garagem" | As seções ficam marcadas como prontas |
| 4 | Eduardo (encarregado, celular) | Atividade › Tarefa do cronograma | Escolher "Instalação de drywall" e informar 60% | A lista oferece as 3 tarefas com o % de hoje; ao escolher aparece "% feito da tarefa (hoje: 20%)" |
| 5 | Eduardo (encarregado, celular) | Enviar para aprovação | Enviar sem fotos | No banco: diário enviado, número 1, com a tarefa e o 60% guardados na atividade |
| 6 | Fábio (admin) | Daily › Painel | Abrir o painel | "Aguardando aprovação" com "RDO nº 1 · Reforma Mitchell"; o sininho avisa que o RDO aguarda aprovação |
| 7 | Fábio (admin) | Daily › Painel › Revisar | Abrir o diário | O relatório mostra "Cronograma: Instalação de drywall → 60%" e os botões "Aprovar e lacrar" e "Pedir ajustes" |
| 8 | Fábio (admin) | Aprovar e lacrar | Confirmar | Aviso de que o cronograma recebeu o andamento de 1 etapa. No banco: aprovado com código XXXX-XXXX-XXXX; a tarefa passa a 60% com o avanço guardado (antes 20, depois 60, RDO 1, por Fábio Fluxo) |
| 9 | Fábio (admin) | Takeoff › Gantt | Abrir o Gantt do projeto | "Instalação de drywall" em 60%; "Demolição e remoção" em 0% e atrasada; a legenda fica no rodapé do gráfico |
| 10 | Fábio (admin) | Projeto › Cronograma e Visão geral | Abrir | A tabela mostra 60 de % feito na tarefa; "Voltar para análise" não aparece mais, porque o projeto já tem diário |
| 11 | Fábio (admin) | Início | Abrir | "Andamento dos projetos" mostra "Reforma Mitchell" atrasada. (O aviso "Tarefa atrasada" no sininho só existe no protótipo; na conta real o sininho traz só avisos do servidor. Pendência de decisão.) |
| 12 | Eduardo (encarregado, celular) | Daily › Reforma Mitchell | Abrir o projeto de novo e o RDO de hoje | O diário aprovado aparece lacrado, com o código, sem botão de aprovar; nenhum erro de JavaScript em todo o fluxo |

**Desfaz:** a empresa dos fluxos e os logins `fluxo.*@example.com` são apagados no fim (`--manter` guarda os dados).

## Decisões tomadas a partir deste fluxo

1. **RDO atrasado antes da liberação (03/11):** o início da obra deixou de ser a data da primeira tarefa. Agora é uma data própria (`projetos.inicio_obra`, migração `0025`), que o administrador escolhe ao liberar (padrão: hoje) e pode mudar depois; o diário é cobrado a partir dela.
2. **Sininho na conta real (03/11):** "Tarefa atrasada" fica só no Início, em "Andamento dos projetos". O sininho da conta real continua com os avisos do servidor.
3. **Encarregado sem projetos (02/11):** corrigido pela migração `0024` (`projetos_do_daily`), já aplicada no banco novo.
