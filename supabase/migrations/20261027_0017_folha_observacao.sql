-- KORbuild — migração 0017: observação de cada folha (planta) do projeto (aprovada pelo dono: "pode aplicar 0017").
-- As políticas de acesso (RLS por empresa) já cobrem a coluna nova.

begin;

alter table public.folhas
  add column if not exists observacao text not null default '' check (char_length(observacao) <= 500);

commit;
