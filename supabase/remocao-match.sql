-- KORbuild · remoção do sistema antigo (Match) do projeto gbdmtgephszxhaprpiss
-- Executado em 2026-10-12. Backup: supabase/backup/estrutura-2026-10-12.sql (commit e9a6da3).
-- Tudo numa transação e sem CASCADE: se algo ainda depender do que sai, o comando falha e nada é apagado.
begin;

-- 1. Cadastro: criar_conta() deixa de tocar em empresas/profissionais (Match).
--    Mantém perfis + contatos. Não mexe em auth.users nem no trigger ao_criar_usuario.
create or replace function public.criar_conta() returns trigger
language plpgsql security definer set search_path to 'public' as $f$
declare
  v_tipo text := new.raw_user_meta_data ->> 'tipo';
  v_nome text := coalesce(nullif(btrim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1));
begin
  if v_tipo not in ('empresa', 'profissional') then
    return new;
  end if;
  insert into public.perfis (id, tipo, nome) values (new.id, v_tipo, v_nome);
  insert into public.contatos (user_id, email) values (new.id, new.email);
  return new;
end $f$;

-- 2. Jobs do pg_cron do Match (o 2, kor-enviar-avisos, é de notificações e fica)
select cron.unschedule('kor-lembretes-diarios');
select cron.unschedule('kor-cotacao-dolar');

-- 3. Políticas do Storage do bucket curriculos (citam tabelas do Match)
drop policy "curriculos_dono"    on storage.objects;
drop policy "curriculos_empresa" on storage.objects;

-- 4. Função que lê tabelas do Match
drop function public.lembretes_diarios();

-- 5. Views, depois tabelas (triggers e políticas das tabelas saem junto)
drop view public.reputacao_empresas, public.reputacao_profissionais;
drop table public.avaliacoes, public.candidaturas, public.convites, public.contratacoes,
           public.experiencias, public.mensagens, public.conversas, public.salvos, public.seguindo,
           public.denuncias, public.vagas, public.empresa_locais, public.empresas, public.profissionais,
           public.assinaturas, public.planos, public.cotacoes;

-- 6. Funções do Match (já sem triggers que as chamem)
drop function public.regras_vaga(), public.regras_candidatura(), public.regras_contratacao(),
  public.regras_avaliacao(), public.regras_conversa(), public.regras_convite(), public.regras_mensagem(),
  public.notif_avaliacao(), public.notif_candidatura(), public.notif_contratacao(), public.notif_mensagem(),
  public.efeitos_contratacao(), public.encerrar_candidaturas(), public.avaliacao_publicada(uuid),
  public.candidatou_a_mim(uuid), public.conversou_comigo(uuid), public.contato_da_conversa(uuid),
  public.meu_lado(uuid, uuid), public.eh_dono_vaga(uuid), public.eh_dono_empresa(uuid), public.minha_empresa(),
  public.guarda_empresa(), public.guarda_experiencia(), public.guarda_profissional();

commit;

-- FORA do SQL: o bucket curriculos (0 arquivos) não pode ser apagado por SQL (trigger protect_buckets_delete);
-- apagar pelo painel (Storage) ou DELETE /storage/v1/bucket/curriculos.
