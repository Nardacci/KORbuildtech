# Daily na 1ª versão: o projeto ganho é a obra (decisão do dono, 27/10)

Depois do login, três módulos: **Daily**, **Takeoff** e **Settings**. O Settings é módulo próprio (cabeçalho "KORbuild / Settings"), fora do Takeoff. O Crew continua fora da 1ª versão.

## Como funciona
- **Só existe projeto.** Todo projeto na situação **Ganha** (ganho numa concorrência ou cadastrado pela empresa para o próprio controle) aparece no Daily: diário do dia, histórico, painel do escritório, aprovações, PDF e link do cliente — as telas de sempre do Daily, com "projeto" no lugar de "obra" no que a pessoa vê (menu *Projetos*, "Seus projetos", "Projetos em execução", "Abrir o projeto").
- **Por baixo, a obra nasce sozinha, 1 para 1.** Quando o projeto fica Ganha, o app (protótipo: `garantirObraDoProjeto`, em `js/obras.js`) e o banco (gatilho `projetos_obra`, migração **0020**) criam a obra a partir do projeto: nome, partes, endereço, datas do cronograma (sem cronograma: hoje → +89 dias), local no mapa e dias de trabalho. Depois, o cadastro do projeto manda na obra. Ninguém cadastra obra; no Daily da 1ª versão só aparecem obras que nasceram de projetos.
- **Ganho numa concorrência:** a obra já nasce ligada à obra da contratante (vínculo CO-14), então o diário segue para a construtora aprovar como antes. A função `criar_obra_da_concorrencia` passou a só completar a obra que já existe.
- **Cronograma:** ao confirmar o cronograma do projeto ganho, as tarefas viram as etapas da obra (protótipo; no app com banco o cronograma da obra é do servidor).
- **Execução no cadastro do projeto** (Novo projeto e Editar projeto): local no mapa (latitude, longitude, raio da cerca) e dias de trabalho, todos opcionais, guardados em `p.execucao` (coluna `projetos.execucao`). Sem local, o clima do diário é marcado à mão; a cerca fica para quando o Crew entrar.
- **O diário alimenta o Gantt (migração 0021).** Na atividade do RDO, o campo **Tarefa do cronograma** lista as tarefas do cronograma do projeto (Takeoff › Schedule) que ainda não chegaram a 100%, com o **% feito** de hoje. Quando o escritório aprova o diário, o % entra na tarefa (`tarefa.pct`) e fica no histórico (`tarefa.avancos`: data, antes, pct, nº do RDO, quem aprovou). É o mesmo % que a aba Schedule, o Gantt e o bloco "Andamento dos projetos" do Início mostram. No protótipo é `aplicarRdoNoProjeto` (`js/obras.js`); no banco é a função `aprovar_rdo` (migração 0021), que continua registrando as etapas de obra do módulo antigo quando existirem. Uma tarefa que não existe mais é ignorada.
- **Etapa atual e avisos:** na página do projeto no Daily, "Etapa atual" são as tarefas do projeto em andamento hoje; o sininho avisa "Tarefa atrasada" com atalho para o Gantt.
- **Permissões:** por enquanto nada muda; quem tem as permissões do Daily no perfil vê o módulo (o Administrador tem todas).

## Banco (migração 0020, em `supabase/migrations/`, aplicada pela sessão local)
`projetos.execucao` jsonb; `obras.lat/lon` opcionais; responsável pelo diário opcional; FK projetos→obras `on delete set null (obra_id)`; gatilho `projetos_obra` (cria e mantém a obra do projeto); `criar_obra_da_concorrencia` idempotente. Teste `supabase/testes/0013_obra_do_projeto.sql`. No app: `PERSISTE_EXECUCAO` em `js/measure-oficial.js` vira true junto com a migração.
Até a migração entrar na conta real: o projeto ganho não vira obra no banco (o Daily fica vazio) e a seção Execução não é gravada.

## Banco (migração 0021, em `supabase/migrations/`)
`aprovar_rdo` reescrita: além das etapas de obra (0007), cada atividade com `tarefaId` e `tarefaPct` atualiza `projetos.cronograma -> tarefas[].pct` do projeto que virou a obra (mesma empresa do diário) e acrescenta o avanço em `avancos`. Retorna `etapas` = total de etapas + tarefas atualizadas. Teste `supabase/testes/0014_rdo_tarefa_do_projeto.sql`. Não depende de nada no app: até ela entrar, o % informado no diário fica só no relatório.

## Testes
`tests/primeira-versao.test.mjs` (Daily aberto, Crew fora), `tests/daily-primeira-versao.test.mjs` (protótipo: projeto → Ganha → Daily → RDO aponta a tarefa → aprovação → % feito no Gantt), `tests/inicio-primeira-versao.test.mjs` (conta real: gatilho e Daily), `tests/projeto-espaco.test.mjs` e `tests/concorrencias.test.mjs` (obra automática).
