-- KORbuild · migração 0021: o RDO aprovado leva o % feito às tarefas do cronograma do projeto (docs/daily-primeira-versao.md).
-- Na 1ª versão o cronograma é o do projeto (projetos.cronograma -> tarefas[{id, nome, inicio, dias, pct}]). Cada atividade do diário
-- pode apontar uma tarefa (tarefaId) com o % feito (tarefaPct); ao aprovar, o % entra na tarefa, com o histórico em "avancos".
-- As etapas da obra (cronoEtapaId, migração 0007) continuam valendo como antes. Não apaga nem altera dado existente.

begin;

create or replace function public.aprovar_rdo(p_id uuid) returns jsonb
language plpgsql security definer set search_path to 'public' as $f$
declare eu public.membros := public.meu_membro(); r public.rdos; v_hash text; a jsonb; e public.cronograma_etapas; n int := 0; v_pct int; v_tarefa text;
begin
  select * into r from public.rdos where id = p_id for update;
  if not found or eu.id is null or not public.aprovo_o_rdo(r) then raise exception 'Sem permissão para aprovar este diário.'; end if;
  if r.status = 'aprovado' then return jsonb_build_object('id', r.id, 'status', r.status, 'codigo', r.codigo); end if;
  if r.status <> 'enviado' then raise exception 'Só um diário enviado pode ser aprovado.'; end if;
  perform set_config('kb.rdo_funcao', '1', true);
  update public.rdos set aprovado_em = date_trunc('second', now()), aprovado_por = eu.nome,
         aprovado_por_empresa = (select nome from public.empresas where id = eu.empresa_id), versao = versao + 1
   where id = p_id returning * into r;
  v_hash := encode(extensions.digest(public.texto_do_lacre(r), 'sha256'), 'hex');
  update public.rdos set status = 'aprovado', hash_documento = v_hash,
         codigo = upper(substr(v_hash, 1, 4) || '-' || substr(v_hash, 5, 4) || '-' || substr(v_hash, 9, 4))
   where id = p_id returning * into r;
  perform public.registrar_no_rdo(r, 'Aprovou · código ' || r.codigo || case when eu.empresa_id <> r.empresa_id then ' (' || r.aprovado_por_empresa || ')' else '' end);
  -- cada atividade que aponta uma etapa do cronograma da obra (da empresa que fez o diário) vira um avanço, com quem aprovou
  for a in select x from jsonb_array_elements(coalesce(r.conteudo -> 'atividades', '[]'::jsonb)) x
            where coalesce(x ->> 'cronoEtapaId', '') ~ '^[0-9a-f-]{36}$' and coalesce(x ->> 'cronoPct', '') ~ '^\d+(\.\d+)?$' loop
    select * into e from public.cronograma_etapas where id = (a ->> 'cronoEtapaId')::uuid and obra_id = r.obra_id;
    if e.id is null then continue; end if;
    insert into public.etapa_avancos (empresa_id, etapa_id, data, antes, pct, fonte, rdo_id, rdo_numero, por, por_nome)
    values (e.empresa_id, e.id, r.data, e.pct, least(100, greatest(0, round((a ->> 'cronoPct')::numeric)))::int, 'rdo', r.id, r.numero, auth.uid(), eu.nome);
    n := n + 1;
  end loop;
  -- cada atividade que aponta uma tarefa do cronograma do projeto (o projeto que virou esta obra) leva o % feito ao Gantt
  for a in select x from jsonb_array_elements(coalesce(r.conteudo -> 'atividades', '[]'::jsonb)) x
            where coalesce(x ->> 'tarefaId', '') <> '' and coalesce(x ->> 'tarefaPct', '') ~ '^\d+(\.\d+)?$' loop
    v_tarefa := a ->> 'tarefaId';
    v_pct := least(100, greatest(0, round((a ->> 'tarefaPct')::numeric)))::int;
    update public.projetos p
       set cronograma = jsonb_set(p.cronograma, '{tarefas}', (
             select jsonb_agg(case when t ->> 'id' = v_tarefa
               then t || jsonb_build_object('pct', v_pct, 'avancos', coalesce(t -> 'avancos', '[]'::jsonb) ||
                      jsonb_build_object('data', r.data, 'antes', coalesce((t ->> 'pct')::int, 0), 'pct', v_pct, 'rdoNumero', r.numero, 'por', eu.nome))
               else t end order by ord)
             from jsonb_array_elements(p.cronograma -> 'tarefas') with ordinality as x(t, ord)))
     where p.obra_id = r.obra_id and p.empresa_id = r.empresa_id
       and jsonb_typeof(p.cronograma -> 'tarefas') = 'array'
       and exists (select 1 from jsonb_array_elements(p.cronograma -> 'tarefas') t where t ->> 'id' = v_tarefa);
    if found then n := n + 1; end if;
  end loop;
  return jsonb_build_object('id', r.id, 'status', r.status, 'codigo', r.codigo, 'hash', r.hash_documento, 'etapas', n);
end $f$;

commit;
