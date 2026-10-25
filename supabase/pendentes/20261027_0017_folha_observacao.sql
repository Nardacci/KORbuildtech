-- KORbuild — migração 0017 (PROPOSTA, NÃO APLICADA): observação de cada folha (planta) do projeto.
-- Só aplicar depois que o dono digitar "pode aplicar". Depois de aplicada: PERSISTE_OBS_FOLHA = true em js/measure-oficial.js
-- e mover este arquivo para supabase/migrations/. As políticas de acesso (RLS por empresa) já cobrem a coluna nova.

begin;

alter table public.folhas
  add column if not exists observacao text not null default '' check (char_length(observacao) <= 500);

commit;
