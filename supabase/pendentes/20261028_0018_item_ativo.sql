-- KORbuild — migração 0018 (PROPOSTA, NÃO APLICADA): item ativo/inativo. Item nunca é apagado; fica inativo.
-- Só aplicar depois que o dono digitar "pode aplicar". Depois de aplicada: PERSISTE_ATIVO_ITEM = true em js/measure-oficial.js
-- e mover este arquivo para supabase/migrations/. As políticas de acesso (RLS por empresa) já cobrem a coluna nova.

begin;

alter table public.itens
  add column if not exists ativo boolean not null default true;

commit;
