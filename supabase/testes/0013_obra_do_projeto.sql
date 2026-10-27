-- KORbuild · teste da migração 0020 (supabase/pendentes/20261028_0020_obra_do_projeto.sql): o projeto ganho é a obra.
-- Tudo dentro de uma transação que termina em ROLLBACK. Se chegar ao fim, imprime 'obra do projeto: todas as verificações passaram'.

begin;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-4000-8000-0000000013a1', 'kb-teste13-ana@example.com', '{"nome":"Ana Treze"}', 'authenticated', 'authenticated');

create function pg_temp.como(p_id uuid, p_email text) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', p_id, 'email', p_email, 'role', 'authenticated')::text, true),
         set_config('request.jwt.claim.sub', p_id::text, true)
$$;
grant execute on function pg_temp.como(uuid, text) to authenticated;

select pg_temp.como('00000000-0000-4000-8000-0000000013a1', 'kb-teste13-ana@example.com');
select public.criar_empresa('{"nome":"Prestadora Treze","atuacao":"prestadora"}');
insert into public.contatos (nome, papeis, email) values ('Cliente Treze', array['cliente'], 'c13@example.com');

do $$
declare v_ct uuid := (select id from public.contatos where nome = 'Cliente Treze'); v_pj uuid; v_pj2 uuid; o public.obras; v_emp uuid := public.minha_empresa();
begin
  -- em orçamento: sem obra
  insert into public.projetos (nome, contratante_id, cidade, estado, tipo, situacao, cronograma, execucao)
  values ('Reforma Treze', v_ct, 'Concord', 'NH', 'reforma', 'orcamento',
          '{"tarefas":[{"id":"t1","nome":"Demolição","inicio":"2026-11-02","dias":3},{"id":"t2","nome":"Pintura","inicio":"2026-11-10","dias":5}]}',
          '{"lat":43.2081,"lon":-71.5376,"raio":120,"diasTrabalho":[1,2,3,4,5,6]}')
  returning id into v_pj;
  if (select obra_id from public.projetos where id = v_pj) is not null then raise exception 'FALHOU: projeto em orçamento ganhou obra'; end if;

  -- ganha: a obra nasce do projeto
  update public.projetos set situacao = 'ganha' where id = v_pj;
  select * into o from public.obras where projeto_id = v_pj;
  if o.id is null then raise exception 'FALHOU: obra automática não foi criada'; end if;
  if (select obra_id from public.projetos where id = v_pj) <> o.id then raise exception 'FALHOU: projetos.obra_id não aponta para a obra'; end if;
  if o.nome <> 'Reforma Treze' or o.contratante_id <> v_ct or o.municipio <> 'Concord' or o.estado <> 'NH' then raise exception 'FALHOU: dados da obra (%)', o.nome; end if;
  if o.inicio <> date '2026-11-02' or o.prazo <> date '2026-11-14' then raise exception 'FALHOU: datas da obra (% → %)', o.inicio, o.prazo; end if;
  if o.lat <> 43.2081 or o.lon <> -71.5376 or o.raio <> 120 or o.dias_trabalho <> '{1,2,3,4,5,6}'::smallint[] then raise exception 'FALHOU: local/dias da obra'; end if;
  if o.responsavel_id is not null then raise exception 'FALHOU: responsável'; end if;
  if o.vinculo_empresa_id is not null then raise exception 'FALHOU: vínculo sem concorrência'; end if;

  -- o cadastro do projeto manda na obra
  update public.projetos set nome = 'Reforma Treze · casa', endereco = '22 Pleasant St', execucao = '{}' where id = v_pj;
  select * into o from public.obras where projeto_id = v_pj;
  if o.nome <> 'Reforma Treze · casa' or o.endereco <> '22 Pleasant St' or o.lat is not null or o.dias_trabalho <> '{1,2,3,4,5}'::smallint[] then raise exception 'FALHOU: obra não acompanhou o projeto (% / % / %)', o.nome, o.endereco, o.lat; end if;

  -- obra sem coordenadas pode existir; segundo projeto com o mesmo nome ganha "(1)"
  insert into public.projetos (nome, contratante_id, cidade, estado, tipo, situacao) values ('Reforma Treze · casa', v_ct, 'Concord', 'NH', 'reforma', 'ganha') returning id into v_pj2;
  select * into o from public.obras where projeto_id = v_pj2;
  if o.id is null or o.nome <> 'Reforma Treze · casa (1)' or o.lat is not null then raise exception 'FALHOU: segundo projeto (%)', o.nome; end if;
  if o.inicio <> current_date or o.prazo <> current_date + 89 then raise exception 'FALHOU: datas padrão'; end if;

  -- o aparelho manda obra_id vazio sem saber da obra automática: ela continua ligada, sem duplicar
  update public.projetos set obra_id = null, endereco = '23 Pleasant St' where id = v_pj;
  if (select obra_id from public.projetos where id = v_pj) is null or (select count(*) from public.obras where projeto_id = v_pj) <> 1 then raise exception 'FALHOU: obra_id vazio perdeu ou duplicou a obra'; end if;
  -- mudar a situação de novo não cria outra obra
  update public.projetos set situacao = 'enviada' where id = v_pj; update public.projetos set situacao = 'ganha' where id = v_pj;
  if (select count(*) from public.obras where empresa_id = v_emp) <> 2 then raise exception 'FALHOU: obra duplicada'; end if;

  update public.projetos set situacao = 'orcamento' where id = v_pj2;
  -- obra à mão continua possível, agora sem coordenadas e sem responsável
  insert into public.obras (nome, contratante_id, municipio, estado, inicio, prazo) values ('Manual Treze', v_ct, 'Bow', 'NH', current_date, current_date + 10);
end $$;

reset role;
-- apagar a obra do segundo projeto (como o banco, sem RLS) só limpa projetos.obra_id; em orçamento, a obra não renasce
do $$
declare v_pj2 uuid := (select p.id from public.projetos p join public.obras o on o.id = p.obra_id where o.nome = 'Reforma Treze · casa (1)');
begin
  if v_pj2 is null then raise exception 'FALHOU: segundo projeto não achado'; end if;
  delete from public.obras where projeto_id = v_pj2;
  if (select obra_id from public.projetos where id = v_pj2) is not null or (select empresa_id from public.projetos where id = v_pj2) is null then raise exception 'FALHOU: apagar a obra não limpou só obra_id'; end if;
  if exists (select 1 from public.obras where projeto_id = v_pj2) then raise exception 'FALHOU: a obra renasceu em orçamento'; end if;
end $$;
select 'obra do projeto: todas as verificações passaram' as resultado;
rollback;
