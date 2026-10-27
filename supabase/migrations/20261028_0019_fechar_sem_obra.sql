-- KORbuild — migração 0019 (autorizada pelo dono em 27/10): fechar a concorrência de um projeto ganho sem obra cadastrada.
-- Na 1ª versão o projeto ganho é a obra (docs/obra-na-primeira-versao.md): a obra só nasce na versão completa.
-- Muda só a função fechar_concorrencia: deixa de exigir
-- projetos.obra_id; se houver obra, continua ligando; se não, concorrencias.obra_id fica nulo (a coluna já aceita nulo).

create or replace function public.fechar_concorrencia(p_id uuid, p_convite uuid, p_observacao text default '') returns jsonb
language plpgsql security definer set search_path to 'public' as $f$
declare c public.concorrencias := public.minha_concorrencia(p_id); v public.concorrencia_convites; p public.concorrencia_propostas; pj public.projetos; pai public.concorrencias; eu public.membros := public.meu_membro();
begin
  if c.situacao <> 'aberta' then raise exception 'Esta concorrência não está aberta.'; end if;
  select * into v from public.concorrencia_convites where id = p_convite and concorrencia_id = c.id;
  p := public.ultima_proposta(v.id);
  if v.id is null or p.id is null then raise exception 'Escolha uma prestadora que mandou proposta.'; end if;
  if c.origem_tipo = 'projeto' then
    select * into pj from public.projetos where id = c.projeto_id;
    if pj.id is null or pj.situacao <> 'ganha' then raise exception 'Esta concorrência saiu de um projeto em orçamento: só fecha depois que o projeto for ganho.'; end if;
    -- 0019: a obra é opcional (1ª versão: o projeto ganho é a obra)
    if pj.obra_id is not null then
      update public.concorrencias set obra_id = pj.obra_id where id = c.id;
      c.obra_id := pj.obra_id;
    end if;
  end if;
  if c.pai_id is not null then select * into pai from public.concorrencias where id = c.pai_id; end if;
  if pai.quarteirizacao = 'com-aprovacao' and not coalesce(c.aprovacao ->> 'situacao' = 'aprovada' and (c.aprovacao ->> 'conviteId')::uuid = v.id, false) then
    update public.concorrencias set aprovacao = jsonb_build_object('conviteId', v.id, 'nome', v.nome, 'situacao', 'pendente', 'pedidaEm', now(), 'observacao', btrim(coalesce(p_observacao, '')), 'pedidaPor', eu.id, 'pedidaPorNome', eu.nome) where id = c.id;
    perform public.registrar_na_concorrencia(c, 'aprovacao-pedida', v.nome);
    return jsonb_build_object('ok', true, 'pendente', true);
  end if;
  perform public.concluir_fechamento(c, v, p, p_observacao, auth.uid(), eu.nome);
  return jsonb_build_object('ok', true);
end $f$;
