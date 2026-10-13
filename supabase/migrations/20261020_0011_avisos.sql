-- KORbuild · fatia 8a do banco (docs/banco.md §15): os avisos que o servidor grava e a fila de e-mails.
-- O sininho de verdade e o e-mail passam a ter de onde ler. Os avisos nascem por GATILHOS nas tabelas das fatias 3 a 7
-- (diário enviado/aprovado, cronograma publicado, semana do ponto, concorrências e canal), sem reescrever nenhuma das
-- funções já testadas. Quem não tem login (o usuário convidado para a empresa; a prestadora convidada só pelo link) recebe
-- o e-mail pela fila_email, preenchida junto com o token (a função que gera o token é a única que o conhece).
--   · notificacoes ganha empresa_id (fatia 1), chave + dados (o texto é traduzido na tela e no e-mail), imediato;
--   · as categorias antigas eram do Match: troca da restrição (NOT VALID: as linhas antigas, se houver, não são tocadas);
--   · notificar() e notificar_empresa() só podem ser chamadas pelo servidor (gatilhos, jobs): ninguém avisa ninguém pelo app;
--   · avisos_pendentes_email() e marcar_avisos_enviados() só para a chave de serviço (a função de borda enviar-avisos);
--   · job diário kor-prazos (prazo de concorrência vencido, teste a vencer); kor-enviar-avisos passa a rodar a cada 5 minutos.
-- Só CRIA e troca restrições/funções; não apaga dado. Rodar e depois supabase/testes/0009_avisos.sql.

begin;

-- ---------- Categorias e colunas ----------

alter table public.notificacoes drop constraint notificacoes_categoria_check;
alter table public.notificacao_prefs drop constraint notificacao_prefs_categoria_check;
alter table public.notificacoes add constraint notificacoes_categoria_check check (categoria in ('daily', 'cronograma', 'concorrencia', 'crew', 'conta')) not valid;
alter table public.notificacao_prefs add constraint notificacao_prefs_categoria_check check (categoria in ('daily', 'cronograma', 'concorrencia', 'crew', 'conta')) not valid;

alter table public.notificacoes
  add column chave text,                                   -- o texto-modelo em português, com {campos} (a tela e o e-mail traduzem)
  add column dados jsonb not null default '{}'::jsonb,     -- os valores dos campos
  add column imediato boolean not null default false;      -- o e-mail sai sem esperar o agrupamento
create index if not exists notificacoes_empresa on public.notificacoes (empresa_id) where empresa_id is not null;

-- ---------- A fila de e-mails de quem não tem aviso (sem login) ----------

create table public.fila_email (
  id bigint generated always as identity primary key,
  empresa_id uuid references public.empresas (id) on delete cascade,
  para_email text not null check (para_email like '%_@_%'),
  para_nome text not null default '',
  idioma text not null default 'en' check (idioma in ('pt', 'en')),
  modelo text not null check (modelo in ('convite-usuario', 'convite-concorrencia', 'aviso-link')),
  dados jsonb not null default '{}'::jsonb,                -- o token do link só fica aqui até o envio (a função de borda o apaga)
  criado_em timestamptz not null default now(),
  enviado_em timestamptz, tentativas integer not null default 0, erro text
);
create index fila_email_pendentes on public.fila_email (criado_em) where enviado_em is null;
alter table public.fila_email enable row level security;   -- sem política: só a chave de serviço (e as funções do banco) mexem
revoke all on public.fila_email from anon, authenticated;
grant all on public.fila_email to service_role;

-- ---------- Funções de apoio ----------

create or replace function public.renderizar_aviso(p_chave text, p_dados jsonb) returns text
language plpgsql immutable as $f$
declare r text := coalesce(p_chave, ''); k text; v text;
begin
  for k, v in select key, value #>> '{}' from jsonb_each(coalesce(p_dados, '{}'::jsonb)) loop
    r := replace(r, '{' || k || '}', coalesce(v, ''));
  end loop;
  return r;
end $f$;

create or replace function public.idioma_do_usuario(p_user uuid) returns text
language sql stable security definer set search_path to 'public' as $f$
  select case when (select raw_user_meta_data ->> 'idioma' from auth.users where id = p_user) = 'pt' then 'pt' else 'en' end
$f$;

-- O aviso de um usuário (a ação que o gerou é do servidor). p_agrupar: o mesmo tipo de aviso, na mesma tela, ainda não lido, vira um só, atualizado.
-- p_email = false: só o sininho (a linha já nasce "enviada" por e-mail).
drop function public.notificar(uuid, text, text, text, text, boolean);
create function public.notificar(p_user uuid, p_empresa uuid, p_categoria text, p_chave text, p_dados jsonb, p_link text,
                                 p_texto text default null, p_agrupar boolean default false, p_imediato boolean default false, p_email boolean default true) returns void
language plpgsql security definer set search_path to 'public' as $f$
declare antes text := coalesce(current_setting('kor.sistema', true), ''); v_titulo text := public.renderizar_aviso(p_chave, p_dados);
begin
  if p_user is null then return; end if;
  if exists (select 1 from public.notificacao_prefs where user_id = p_user and categoria = p_categoria and not push) then return; end if;
  perform set_config('kor.sistema', 'on', true);
  if p_agrupar then
    update public.notificacoes set titulo = v_titulo, chave = p_chave, dados = coalesce(p_dados, '{}'::jsonb), texto = left(p_texto, 200), criado_em = now(),
           email_em = case when p_email then null else now() end
     where user_id = p_user and categoria = p_categoria and link = p_link and chave = p_chave and lida_em is null;   -- o mesmo tipo de aviso na mesma tela (não junta eventos diferentes)
  end if;
  if not p_agrupar or not found then
    insert into public.notificacoes (user_id, empresa_id, categoria, titulo, texto, link, chave, dados, imediato, email_em)
    values (p_user, p_empresa, p_categoria, v_titulo, left(p_texto, 200), p_link, p_chave, coalesce(p_dados, '{}'::jsonb), p_imediato, case when p_email then null else now() end);
  end if;
  perform set_config('kor.sistema', antes, true);
end $f$;

-- O aviso para todos da empresa que têm a permissão (menos quem fez a ação).
create or replace function public.notificar_empresa(p_empresa uuid, p_permissao text, p_categoria text, p_chave text, p_dados jsonb, p_link text,
                                                    p_texto text default null, p_agrupar boolean default false, p_imediato boolean default false, p_email boolean default true) returns void
language plpgsql security definer set search_path to 'public' as $f$
declare m record;
begin
  if p_empresa is null then return; end if;
  for m in select me.user_id from public.membros me join public.perfis_acesso pa on pa.id = me.perfil_id
            where me.empresa_id = p_empresa and me.ativo and p_permissao = any (pa.permissoes) and me.user_id is distinct from auth.uid() loop
    perform public.notificar(m.user_id, p_empresa, p_categoria, p_chave, p_dados, p_link, p_texto, p_agrupar, p_imediato, p_email);
  end loop;
end $f$;

create or replace function public.enfileirar_email(p_empresa uuid, p_email text, p_nome text, p_modelo text, p_dados jsonb) returns void
language plpgsql security definer set search_path to 'public' as $f$
begin
  if btrim(coalesce(p_email, '')) not like '%_@_%' then return; end if;   -- contato sem e-mail: o link continua sendo copiado à mão
  insert into public.fila_email (empresa_id, para_email, para_nome, idioma, modelo, dados)
  values (p_empresa, lower(btrim(p_email)), coalesce(p_nome, ''), public.idioma_do_usuario(auth.uid()), p_modelo, coalesce(p_dados, '{}'::jsonb));
end $f$;

-- ---------- O que a função de borda lê (só a chave de serviço) ----------

drop function public.avisos_pendentes_email(integer, integer);
create function public.avisos_pendentes_email(p_limite integer default 50, p_espera_min integer default 3)
returns table(user_id uuid, email text, nome text, idioma text, avisos jsonb)
language sql stable security definer set search_path to 'public' as $f$
  select n.user_id, u.email::text, coalesce(m.nome, split_part(u.email, '@', 1))::text,
         case when u.raw_user_meta_data ->> 'idioma' = 'pt' then 'pt' else 'en' end,
         jsonb_agg(jsonb_build_object('id', n.id, 'categoria', n.categoria, 'titulo', n.titulo, 'chave', n.chave, 'dados', n.dados, 'texto', n.texto, 'link', n.link, 'criado_em', n.criado_em)
                   order by n.criado_em desc)
  from public.notificacoes n
  join auth.users u on u.id = n.user_id
  left join public.membros m on m.user_id = n.user_id
  where n.email_em is null and n.lida_em is null
    and n.criado_em <= now() - make_interval(mins => case when n.imediato then 0 else p_espera_min end)
    and u.email is not null
    and not exists (select 1 from public.notificacao_prefs np where np.user_id = n.user_id and np.categoria = n.categoria and not np.email)
  group by n.user_id, u.email, m.nome, u.raw_user_meta_data ->> 'idioma'
  limit p_limite
$f$;

revoke all on function public.avisos_pendentes_email(integer, integer), public.marcar_avisos_enviados(bigint[]),
  public.notificar(uuid, uuid, text, text, jsonb, text, text, boolean, boolean, boolean),
  public.notificar_empresa(uuid, text, text, text, jsonb, text, text, boolean, boolean, boolean),
  public.enfileirar_email(uuid, text, text, text, jsonb), public.renderizar_aviso(text, jsonb), public.idioma_do_usuario(uuid) from public, anon, authenticated;
grant execute on function public.avisos_pendentes_email(integer, integer), public.marcar_avisos_enviados(bigint[]) to service_role;

-- ---------- Os e-mails de quem ainda não tem conta nascem junto com o token ----------

-- O convite para entrar na empresa (fatia 1): o token já sai também no e-mail.
create or replace function public.convidar_usuario(p_email text, p_nome text, p_perfil uuid) returns text
language plpgsql security definer set search_path to 'public', 'extensions' as $f$
declare v_token text := encode(gen_random_bytes(24), 'hex'); v_email text := lower(btrim(p_email));
begin
  if not public.tenho_permissao('settings.acesso') then raise exception 'Sem permissão para convidar.'; end if;
  if not exists (select 1 from public.perfis_acesso where id = p_perfil and empresa_id = public.minha_empresa()) then raise exception 'Perfil inválido.'; end if;
  if exists (select 1 from public.membros m join auth.users u on u.id = m.user_id where lower(u.email) = v_email) then
    raise exception 'Este e-mail já pertence a uma empresa no KORbuild.';
  end if;
  insert into public.convites_usuario (empresa_id, email, nome, perfil_id, token_hash, convidado_por)
  values (public.minha_empresa(), v_email, btrim(coalesce(p_nome, '')), p_perfil, encode(digest(v_token, 'sha256'), 'hex'), auth.uid());
  perform public.enfileirar_email(public.minha_empresa(), v_email, btrim(coalesce(p_nome, '')), 'convite-usuario',
    jsonb_build_object('token', v_token, 'empresa', (select nome from public.empresas where id = public.minha_empresa()),
                       'perfil', (select nome from public.perfis_acesso where id = p_perfil), 'por', coalesce((select nome from public.membros where user_id = auth.uid()), '')));
  return v_token;
end $f$;

-- O link do convite de concorrência (fatia 7): o e-mail com o link sai junto com o token (só o hash fica no convite).
create or replace function public.novo_token_do_convite(p_convite uuid) returns text
language plpgsql security definer set search_path to 'public', 'extensions' as $f$
declare v_token text := encode(gen_random_bytes(24), 'hex'); v public.concorrencia_convites; c public.concorrencias;
begin
  update public.concorrencia_convites set token_hash = encode(digest(v_token, 'sha256'), 'hex') where id = p_convite returning * into v;
  select * into c from public.concorrencias where id = v.concorrencia_id;
  perform public.enfileirar_email(c.empresa_id, v.email, v.nome, 'convite-concorrencia',
    jsonb_build_object('token', v_token, 'servico', c.servico, 'contratante', (select nome from public.empresas where id = c.empresa_id), 'prazo', c.prazo));
  return v_token;
end $f$;

-- ---------- Diário (fatia 3) ----------

create or replace function public.avisar_rdo() returns trigger
language plpgsql security definer set search_path to 'public' as $f$
declare o public.obras; v_autor uuid;
begin
  if tg_op = 'UPDATE' and new.status = old.status then return null; end if;
  if new.status not in ('enviado', 'ajustes', 'aprovado') then return null; end if;
  select * into o from public.obras where id = new.obra_id;
  if new.status = 'enviado' then
    -- quem aprova: a contratante da obra ligada, ou a própria empresa
    perform public.notificar_empresa(coalesce(o.vinculo_empresa_id, new.empresa_id), 'daily.aprovar', 'daily', 'RDO nº {numero} de {obra} aguardando aprovação',
      jsonb_build_object('numero', new.numero, 'obra', o.nome), '#/daily/painel/rdo/' || new.id, null, true);
    return null;
  end if;
  select user_id into v_autor from public.membros where id = new.autor_id;
  if v_autor is not distinct from auth.uid() then return null; end if;
  if new.status = 'ajustes' then
    perform public.notificar(v_autor, new.empresa_id, 'daily', 'O escritório pediu ajustes no RDO nº {numero}', jsonb_build_object('numero', new.numero),
      '#/daily/campo/rdo/' || new.id, new.motivo_ajuste, false, true);
  else
    perform public.notificar(v_autor, new.empresa_id, 'daily', 'RDO nº {numero} de {obra} aprovado', jsonb_build_object('numero', new.numero, 'obra', o.nome), '#/daily/campo/rdo/' || new.id);
  end if;
  return null;
end $f$;
create trigger rdos_avisar after insert or update of status on public.rdos for each row execute function public.avisar_rdo();

-- ---------- Cronograma publicado (fatia 5) ----------

create or replace function public.avisar_publicacao() returns trigger
language plpgsql security definer set search_path to 'public' as $f$
declare v_obra text; v_de text;
begin
  select nome into v_obra from public.obras where id = new.obra_id;
  select nome into v_de from public.empresas where id = new.de_empresa_id;
  perform public.notificar_empresa(new.para_empresa_id, 'daily.acompanhar', 'cronograma', 'Cronograma publicado por {empresa}: {obra} (versão {versao})',
    jsonb_build_object('empresa', v_de, 'obra', v_obra, 'versao', new.versao), '#/daily/obras/' || new.para_obra_id || '/cronograma', null, true);
  return null;
end $f$;
create trigger publicacoes_cronograma_avisar after insert on public.publicacoes_cronograma for each row execute function public.avisar_publicacao();

-- ---------- A semana do ponto (fatia 4): só o sininho ----------

create or replace function public.avisar_semana() returns trigger
language plpgsql security definer set search_path to 'public' as $f$
declare v_user uuid;
begin
  select user_id into v_user from public.membros where funcionario_id = new.funcionario_id and empresa_id = new.empresa_id and ativo limit 1;
  if v_user is null or v_user is not distinct from auth.uid() then return null; end if;
  if new.status = 'aprovado' then
    perform public.notificar(v_user, new.empresa_id, 'crew', 'Sua semana de {semana} foi aprovada', jsonb_build_object('semana', to_char(new.semana, 'MM/DD')), '#/crew', null, false, false, false);
  else
    perform public.notificar(v_user, new.empresa_id, 'crew', 'Sua semana de {semana} foi devolvida: {motivo}', jsonb_build_object('semana', to_char(new.semana, 'MM/DD'), 'motivo', new.motivo), '#/crew', null, false, false, false);
  end if;
  return null;
end $f$;
create trigger aprovacoes_semana_avisar after insert on public.aprovacoes_semana for each row execute function public.avisar_semana();

-- ---------- Concorrências (fatia 7) ----------

-- O que acontece na concorrência (o histórico é gravado por todas as funções): avisa as convidadas, com conta (sininho) ou pelo link (e-mail).
create or replace function public.avisar_concorrencia() returns trigger
language plpgsql security definer set search_path to 'public' as $f$
declare c public.concorrencias; pai public.concorrencias; v public.concorrencia_convites; v_contratante text; v_chave text; v_dados jsonb; v_evento text; v_link text;
begin
  select * into c from public.concorrencias where id = new.concorrencia_id;
  select nome into v_contratante from public.empresas where id = c.empresa_id;
  v_link := '#/measure/convite/' || c.id;
  if new.acao = 'aprovacao-pedida' then
    select * into pai from public.concorrencias where id = c.pai_id;
    perform public.notificar_empresa(pai.empresa_id, 'concorrencias.gerir', 'concorrencia', '{contratante} quer quarteirizar para {escolhida}: aprove ou recuse',
      jsonb_build_object('contratante', v_contratante, 'escolhida', c.aprovacao ->> 'nome'), '#/daily/concorrencias/' || pai.id, null, false, true);
    return null;
  elsif new.acao = 'aprovacao' then
    perform public.notificar_empresa(c.empresa_id, 'concorrencias.gerir', 'concorrencia',
      case when c.aprovacao ->> 'situacao' = 'aprovada' then 'Quarteirização aprovada: {empresa} · {servico}' else 'Quarteirização recusada: {empresa} · {servico}' end,
      jsonb_build_object('empresa', c.aprovacao ->> 'nome', 'servico', c.servico), '#/daily/concorrencias/' || c.id, null, false, true);
    return null;
  elsif new.acao not in ('enviada', 'prorrogada', 'adendo', 'cancelada', 'fechada') then
    return null;
  end if;
  for v in select * from public.concorrencia_convites where concorrencia_id = c.id loop
    v_chave := null;
    if new.acao = 'enviada' then v_chave := 'Convite para cotar: {servico} · {nome}'; v_evento := 'convite';
    elsif new.acao = 'prorrogada' and v.situacao not in ('nao-vai', 'cancelado') then v_chave := 'Prazo prorrogado: {servico}'; v_evento := 'prazo';
    elsif new.acao = 'adendo' and v.situacao not in ('nao-vai', 'cancelado') then v_chave := 'Aviso a todos: {servico}'; v_evento := 'adendo';
    elsif new.acao = 'cancelada' then v_chave := 'Concorrência cancelada: {servico}'; v_evento := 'cancelada';
    elsif new.acao = 'fechada' and v.situacao = 'vencedora' then v_chave := 'Você venceu: {servico} · {nome}'; v_evento := 'venceu';
    elsif new.acao = 'fechada' and v.situacao = 'nao-escolhida' then v_chave := 'Concorrência fechada com outra empresa: {servico}'; v_evento := 'fechada';
    end if;
    continue when v_chave is null;
    v_dados := jsonb_build_object('servico', c.servico, 'nome', v_contratante);
    if v.convidada_id is not null then
      perform public.notificar_empresa(v.convidada_id, 'concorrencias.responder', 'concorrencia', v_chave, v_dados, v_link, case when new.acao = 'adendo' then new.detalhe end, false, true);
    elsif v_evento <> 'convite' then   -- o convite pelo link já vai com o token (novo_token_do_convite); os outros avisos vão sem link
      perform public.enfileirar_email(c.empresa_id, v.email, v.nome, 'aviso-link',
        jsonb_build_object('evento', v_evento, 'servico', c.servico, 'contratante', v_contratante, 'texto', case when new.acao = 'adendo' then new.detalhe end, 'prazo', c.prazo));
    end if;
  end loop;
  return null;
end $f$;
create trigger concorrencia_historico_avisar after insert on public.concorrencia_historico for each row execute function public.avisar_concorrencia();

-- Quem é convidada depois do envio (convidar_mais) e quem responde "não vou".
create or replace function public.avisar_convite() returns trigger
language plpgsql security definer set search_path to 'public' as $f$
declare c public.concorrencias; v_contratante text;
begin
  select * into c from public.concorrencias where id = new.concorrencia_id;
  if tg_op = 'INSERT' then
    if c.situacao = 'aberta' and new.convidada_id is not null then
      select nome into v_contratante from public.empresas where id = c.empresa_id;
      perform public.notificar_empresa(new.convidada_id, 'concorrencias.responder', 'concorrencia', 'Convite para cotar: {servico} · {nome}',
        jsonb_build_object('servico', c.servico, 'nome', v_contratante), '#/measure/convite/' || c.id, null, false, true);
    end if;
  elsif new.situacao = 'nao-vai' and old.situacao is distinct from 'nao-vai' then
    perform public.notificar_empresa(c.empresa_id, 'concorrencias.gerir', 'concorrencia', '{nome} não vai participar · {servico}',
      jsonb_build_object('nome', new.nome, 'servico', c.servico), '#/daily/concorrencias/' || c.id);
  end if;
  return null;
end $f$;
create trigger concorrencia_convites_avisar after insert or update of situacao on public.concorrencia_convites for each row execute function public.avisar_convite();

create or replace function public.avisar_proposta() returns trigger
language plpgsql security definer set search_path to 'public' as $f$
declare v public.concorrencia_convites; c public.concorrencias;
begin
  select * into v from public.concorrencia_convites where id = new.convite_id;
  select * into c from public.concorrencias where id = v.concorrencia_id;
  perform public.notificar_empresa(c.empresa_id, 'concorrencias.gerir', 'concorrencia', 'Proposta de {nome} (rev. {rev}) · {servico}',
    jsonb_build_object('nome', v.nome, 'rev', new.rev, 'servico', c.servico), '#/daily/concorrencias/' || c.id || '/comparar', null, false, true);
  return null;
end $f$;
create trigger concorrencia_propostas_avisar after insert on public.concorrencia_propostas for each row execute function public.avisar_proposta();

-- O canal: a pergunta da convidada avisa a contratante; a resposta da contratante avisa quem perguntou (o aviso a todos é o adendo).
create or replace function public.avisar_mensagem() returns trigger
language plpgsql security definer set search_path to 'public' as $f$
declare v public.concorrencia_convites; c public.concorrencias; v_contratante text;
begin
  if new.convite_id is null or new.aviso then return null; end if;
  select * into v from public.concorrencia_convites where id = new.convite_id;
  select * into c from public.concorrencias where id = new.concorrencia_id;
  if new.de = 'convidada' then
    perform public.notificar_empresa(c.empresa_id, 'concorrencias.gerir', 'concorrencia', 'Mensagem de {nome} · {servico}',
      jsonb_build_object('nome', v.nome, 'servico', c.servico), '#/daily/concorrencias/' || c.id || '/perguntas', new.texto, true);
  else
    select nome into v_contratante from public.empresas where id = c.empresa_id;
    if v.convidada_id is not null then
      perform public.notificar_empresa(v.convidada_id, 'concorrencias.responder', 'concorrencia', 'Mensagem de {nome} · {servico}',
        jsonb_build_object('nome', v_contratante, 'servico', c.servico), '#/measure/convite/' || c.id, new.texto, true);
    else
      perform public.enfileirar_email(c.empresa_id, v.email, v.nome, 'aviso-link',
        jsonb_build_object('evento', 'mensagem', 'servico', c.servico, 'contratante', v_contratante, 'texto', left(new.texto, 300), 'prazo', c.prazo));
    end if;
  end if;
  return null;
end $f$;
create trigger concorrencia_mensagens_avisar after insert on public.concorrencia_mensagens for each row execute function public.avisar_mensagem();

-- ---------- O que o relógio avisa (job diário) ----------

create or replace function public.avisar_prazos() returns integer
language plpgsql security definer set search_path to 'public' as $f$
declare c record; e record; n integer := 0; v_dias integer; v_chave text; v_link text;
begin
  -- concorrência aberta com o prazo vencido: compare e feche (CO-09)
  for c in select * from public.concorrencias where situacao = 'aberta' and prazo <= now() loop
    v_link := '#/daily/concorrencias/' || c.id || '/comparar';
    if not exists (select 1 from public.notificacoes where categoria = 'concorrencia' and link = v_link and chave = 'Prazo vencido: compare e feche · {servico}' and criado_em >= c.prazo) then
      perform public.notificar_empresa(c.empresa_id, 'concorrencias.gerir', 'concorrencia', 'Prazo vencido: compare e feche · {servico}', jsonb_build_object('servico', c.servico), v_link, null, false, true);
      n := n + 1;
    end if;
  end loop;
  -- teste a vencer: 7 dias e 1 dia antes
  for e in select id, plano from public.empresas where plano ->> 'status' = 'teste' and plano ->> 'teste_ate' ~ '^\d{4}-\d{2}-\d{2}' loop
    v_dias := (left(e.plano ->> 'teste_ate', 10))::date - public.hoje_da_empresa(e.id);
    continue when v_dias not in (7, 1);
    v_chave := case when v_dias = 1 then 'O período de teste termina amanhã' else 'O período de teste termina em {dias} dias' end;
    if not exists (select 1 from public.notificacoes where empresa_id = e.id and categoria = 'conta' and chave = v_chave and criado_em > now() - interval '3 days') then
      perform public.notificar_empresa(e.id, 'settings.conta', 'conta', v_chave, jsonb_build_object('dias', v_dias), '#/conta/empresa', null, false, true);
      n := n + 1;
    end if;
  end loop;
  return n;
end $f$;
revoke all on function public.avisar_prazos() from public, anon, authenticated;
grant execute on function public.avisar_prazos() to service_role;

-- Os gatilhos são funções do servidor: ninguém as chama pelo app.
revoke all on function public.avisar_rdo(), public.avisar_publicacao(), public.avisar_semana(), public.avisar_concorrencia(), public.avisar_convite(),
  public.avisar_proposta(), public.avisar_mensagem() from public, anon, authenticated;

-- ---------- Os jobs (só onde o pg_cron existe: no Supabase) ----------

do $cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('kor-prazos', '0 12 * * *', 'select public.avisar_prazos()');   -- 12h UTC = 8h em Nova York (horário de verão)
    if exists (select 1 from cron.job where jobname = 'kor-enviar-avisos') then
      perform cron.alter_job((select jobid from cron.job where jobname = 'kor-enviar-avisos'), schedule := '*/5 * * * *');
    end if;
  end if;
end $cron$;

commit;
