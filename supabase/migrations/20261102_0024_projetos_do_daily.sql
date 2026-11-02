-- KORbuild · migração 0024: o Daily lê o essencial dos projetos liberados para obra (achado do fluxo F03, 02/11).
-- Na 1ª versão o projeto liberado é a obra: o Daily precisa do projeto (que obra é, se está liberada, as tarefas do cronograma e o % feito).
-- Mas a leitura de public.projetos exige permissão de Measure (policy projetos_tudo), que o Encarregado não tem: ele via "Seus projetos" vazio
-- e o diário sem o campo "Tarefa do cronograma". Esta função devolve, só para quem tem permissão do Daily, o mínimo de cada projeto liberado da
-- empresa: nunca proposta, cotação, preços, concorrência nem contratante. Não muda tabela nem policy; não apaga nem altera dado.

begin;

create or replace function public.projetos_do_daily() returns table (id uuid, nome text, obra_id uuid, cidade text, estado text, liberado_em timestamptz, liberado_por text, cronograma jsonb)
language sql stable security definer set search_path to 'public' as $f$
  select p.id, p.nome, p.obra_id, p.cidade, p.estado, p.liberado_em, p.liberado_por,
         jsonb_build_object('tarefas', coalesce((
           select jsonb_agg(jsonb_build_object('id', x.t ->> 'id', 'nome', x.t ->> 'nome', 'quem', x.t ->> 'quem', 'inicio', x.t ->> 'inicio',
                                               'dias', x.t -> 'dias', 'pct', coalesce(x.t -> 'pct', '0'::jsonb)) order by x.ord)
             from jsonb_array_elements(case when jsonb_typeof(p.cronograma -> 'tarefas') = 'array' then p.cronograma -> 'tarefas' else '[]'::jsonb end) with ordinality as x(t, ord)
         ), '[]'::jsonb))
    from public.projetos p
   where p.empresa_id = public.minha_empresa()
     and p.liberado_em is not null and p.obra_id is not null
     and (public.tenho_permissao('daily.preencher') or public.tenho_permissao('daily.acompanhar') or public.tenho_permissao('daily.aprovar'))
$f$;
revoke all on function public.projetos_do_daily() from public, anon;
grant execute on function public.projetos_do_daily() to authenticated;

commit;
