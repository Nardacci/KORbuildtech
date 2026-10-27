-- KORbuild — migração 0018: item ativo/inativo (autorizada pelo dono em 27/10). Item nunca é apagado; fica inativo.
-- Depois de aplicada no banco real: PERSISTE_ATIVO_ITEM = true em js/measure-oficial.js (feito).
-- As políticas de acesso (RLS por empresa) já cobrem a coluna nova.

begin;

alter table public.itens
  add column if not exists ativo boolean not null default true;

commit;
