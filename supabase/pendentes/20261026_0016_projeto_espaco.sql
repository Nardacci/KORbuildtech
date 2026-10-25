-- KORbuild — migração 0016 (PROPOSTA, NÃO APLICADA): o projeto como espaço de trabalho + observação dos anexos da licitação.
-- Revisar antes. Só aplicar depois que o dono digitar "pode aplicar". Depois de aplicada: PERSISTE_ESPACO = true em js/measure-oficial.js
-- e mover este arquivo para supabase/migrations/.
--
-- 1. projetos.entrega e projetos.cronograma: o "quem faz cada etapa" e o cronograma preliminar do projeto (jsonb, mesma forma do protótipo):
--      entrega    = { padrao, etapas: [{ id, etapa, quem, takeoff }] }
--      cronograma = { tarefas: [{ id, nome, quem, inicio, dias }], marcos: [{ id, nome, data, nota }] }
-- 2. concorrencia_desenhos.observacao: a observação de cada anexo da licitação.
-- As políticas de acesso existentes (RLS por empresa) já cobrem as colunas novas: não se muda nenhuma política.

begin;

alter table public.projetos
  add column if not exists entrega jsonb not null default '{}'::jsonb,
  add column if not exists cronograma jsonb not null default '{}'::jsonb;

alter table public.projetos
  drop constraint if exists projetos_espaco_objetos,
  add constraint projetos_espaco_objetos check (jsonb_typeof(entrega) = 'object' and jsonb_typeof(cronograma) = 'object');

alter table public.concorrencia_desenhos
  add column if not exists observacao text not null default '' check (char_length(observacao) <= 500);

commit;

-- Ainda falta (próxima revisão): expor `observacao` nas funções visao_do_convite() e no espelho de leitura, e a tabela de anexos da proposta.
