-- KORbuild — 0015: o Measure Takeoff também para a construtora (1ª versão).
-- Só troca a função tenho_measure(): antes exigia atuação prestadora/ambas (HS-09); agora vale para toda empresa com a permissão measure.medir.
-- Nenhuma tabela, política ou dado muda: as políticas continuam presas à própria empresa (empresa_id = minha_empresa()), então a construtora
-- só enxerga e grava o que é dela. Concorrências e convites não dependem desta função.
-- Para voltar atrás: recriar a função com a condição "atuacao in ('prestadora', 'ambas')" (veja 0008).
begin;
create or replace function public.tenho_measure() returns boolean
language sql stable security definer set search_path to 'public' as $f$
  select public.tenho_permissao('measure.medir')
$f$;
commit;
