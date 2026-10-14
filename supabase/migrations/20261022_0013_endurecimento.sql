-- KORbuild · migração 13 — endurecimento de segurança (achados do teste supabase/testes/0011_seguranca.sql).
-- 1) O administrador de uma empresa conseguia mudar o PRÓPRIO plano, os módulos e a atuação (a coluna estava liberada na tabela empresas):
--    plano, módulos e atuação passam a ser da plataforma (funções admin_* e criar_empresa, que rodam com privilégio próprio).
-- 2) anon (quem não entrou) tinha privilégios em 8 tabelas do app; a RLS barrava, mas o privilégio nem deveria existir.
-- 3) authenticated tinha TRUNCATE, REFERENCES e TRIGGER nas tabelas (TRUNCATE passa por cima da RLS; o app nunca usa).
-- 4) Funções do sistema ao alcance de anon (ligar_sistema() liga o "modo sistema" que pula as travas dos registros; auditar e os gatilhos).
-- Nada do que o app faz hoje muda: as telas só gravam as colunas de perfil da empresa e chamam funções com privilégio próprio.

-- ---------- 1. Colunas da empresa que só a plataforma muda ----------
revoke update on public.empresas from authenticated;
grant update (nome, razao_social, sigla, ein, endereco, cidade, estado, zip, telefone, email, site,
              licencas, seguros, termos_proposta, especialidades, logo_path, configuracao)
  on public.empresas to authenticated;

-- ---------- 2 e 3. Tabelas ----------
revoke all on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke truncate, references, trigger on tables from authenticated;
alter default privileges in schema public revoke all on sequences from anon;

-- ---------- 4. Funções ----------
-- Gatilhos e o "modo sistema" não são chamados por ninguém de fora (os gatilhos disparam sem checar EXECUTE).
do $$ declare f record; begin
  for f in select p.oid::regprocedure as assinatura, p.proname, p.prorettype = 'trigger'::regtype as gatilho,
                  has_function_privilege('authenticated', p.oid, 'execute') as auth_tinha
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.prokind = 'f' loop
    begin
      if f.gatilho or f.proname in ('ligar_sistema') then
        execute format('revoke all on function %s from public, anon, authenticated', f.assinatura);
      elsif f.proname <> 'diario_por_codigo' then
        -- o resto continua com quem já executava (as políticas da RLS chamam estas funções), mas anon não executa;
        -- as funções só da função de borda (service_role) continuam fechadas para authenticated
        execute format('revoke all on function %s from public, anon', f.assinatura);
        if f.auth_tinha then execute format('grant execute on function %s to authenticated', f.assinatura); end if;
        execute format('grant execute on function %s to service_role', f.assinatura);
      end if;
    exception when others then
      raise notice 'não consegui ajustar %: % (o teste supabase/testes/0011_seguranca.sql mostra se sobrou algo aberto)', f.assinatura, sqlerrm;
    end;
  end loop;
end $$;
-- função nova nasce fechada para anon e para o público; quem precisa recebe grant na própria migração
alter default privileges in schema public revoke execute on functions from public, anon;
-- o link público do diário aprovado é a única função aberta (devolve só diário aprovado, com o lacre conferido)
grant execute on function public.diario_por_codigo(text) to anon, authenticated, service_role;

-- ---------- 5. Storage ----------
-- O bucket "curriculos" é do projeto anterior: nenhuma política de acesso (ninguém de fora lê nem grava), mas sem limite de tamanho nem de tipo.
update storage.buckets set file_size_limit = 5242880,
       allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
 where id = 'curriculos' and (file_size_limit is null or allowed_mime_types is null);
