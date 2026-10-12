-- KORbuild · estrutura do banco Supabase gbdmtgephszxhaprpiss em 2026-10-12 (sem dados)
-- Gerado por tools/supabase-estrutura.mjs a partir dos catálogos do Postgres. Schemas do Supabase (auth, storage…) ficam de fora.


-- Extensões
create extension if not exists "pg_cron";
create extension if not exists "pg_net";
create extension if not exists "pg_stat_statements";
create extension if not exists "pgcrypto";
create extension if not exists "plpgsql";
create extension if not exists "supabase_vault";
create extension if not exists "uuid-ossp";

-- Tipos (enum)

-- Sequências

-- Tabelas
create table "public"."assinaturas" (
  "empresa_id" uuid not null,
  "plano" text default 'essencial'::text not null,
  "status" text default 'gratis'::text not null,
  "gratis_desde" timestamp with time zone default now() not null,
  "gratis_ate" timestamp with time zone default (now() + '3 mons'::interval) not null,
  "limite_vagas_ativas" integer default 3 not null,
  "limite_convites_mes" integer default 30 not null,
  "atualizado_em" timestamp with time zone default now() not null,
  "mp_preapproval_id" text,
  "mp_status" text,
  "proximo_pagamento" timestamp with time zone,
  "valor_cobrado" numeric(10,2),
  "cotacao_usada" numeric(12,6),
  "cotacao_data" date
);
create table "public"."auditoria" (
  "id" bigint generated ALWAYS as identity not null,
  "quem" uuid,
  "tabela" text not null,
  "registro" uuid not null,
  "acao" text not null,
  "antes" jsonb,
  "depois" jsonb,
  "criado_em" timestamp with time zone default now() not null
);
create table "public"."avaliacoes" (
  "id" uuid default gen_random_uuid() not null,
  "contratacao_id" uuid not null,
  "autor_tipo" text not null,
  "respostas" jsonb not null,
  "nota" smallint not null,
  "comentario" text,
  "resposta" text,
  "removida" boolean default false not null,
  "criado_em" timestamp with time zone default now() not null
);
create table "public"."candidaturas" (
  "id" uuid default gen_random_uuid() not null,
  "vaga_id" uuid not null,
  "profissional_id" uuid not null,
  "status" text default 'novo'::text not null,
  "mensagem" text,
  "respostas_triagem" jsonb default '{}'::jsonb not null,
  "pretensao_valor" numeric(12,2),
  "pretensao_moeda" text,
  "pretensao_periodo" text,
  "curriculo_path" text,
  "criado_em" timestamp with time zone default now() not null,
  "status_em" timestamp with time zone default now() not null,
  "lembrete_em" timestamp with time zone
);
create table "public"."contatos" (
  "user_id" uuid not null,
  "canal" text default 'whatsapp'::text not null,
  "telefone" text,
  "email" text
);
create table "public"."contratacoes" (
  "id" uuid default gen_random_uuid() not null,
  "empresa_id" uuid not null,
  "profissional_id" uuid not null,
  "vaga_id" uuid,
  "candidatura_id" uuid,
  "registrada_por" text not null,
  "funcao" text not null,
  "tipo" text,
  "moeda" text,
  "valor" numeric(12,2),
  "periodo" text,
  "data_inicio" date,
  "jornada" text,
  "status" text default 'aguardando'::text not null,
  "contestacao_texto" text,
  "resposta_texto" text,
  "recusa_contestada" boolean default false not null,
  "confirmada_em" timestamp with time zone,
  "encerrada_em" date,
  "avaliar_ate" timestamp with time zone,
  "criado_em" timestamp with time zone default now() not null,
  "lembrete_avaliacao_em" timestamp with time zone
);
create table "public"."conversas" (
  "id" uuid default gen_random_uuid() not null,
  "empresa_id" uuid not null,
  "profissional_id" uuid not null,
  "vaga_id" uuid,
  "compartilhou_empresa" boolean default false not null,
  "compartilhou_profissional" boolean default false not null,
  "lido_empresa_em" timestamp with time zone,
  "lido_profissional_em" timestamp with time zone,
  "ultima_mensagem_em" timestamp with time zone,
  "ultima_mensagem_de" text,
  "deu_certo_empresa" text,
  "deu_certo_profissional" text,
  "criado_em" timestamp with time zone default now() not null
);
create table "public"."convites" (
  "id" uuid default gen_random_uuid() not null,
  "empresa_id" uuid not null,
  "profissional_id" uuid not null,
  "vaga_id" uuid,
  "mensagem" text,
  "status" text default 'enviado'::text not null,
  "criado_em" timestamp with time zone default now() not null
);
create table "public"."cotacoes" (
  "par" text not null,
  "taxa" numeric(12,6) not null,
  "data" date not null,
  "fonte" text default 'BCB_PTAX'::text not null,
  "buscado_em" timestamp with time zone default now() not null
);
create table "public"."denuncias" (
  "id" uuid default gen_random_uuid() not null,
  "autor" uuid default auth.uid() not null,
  "alvo_tipo" text not null,
  "alvo_id" uuid not null,
  "motivo" text not null,
  "detalhe" text,
  "status" text default 'em_analise'::text not null,
  "criado_em" timestamp with time zone default now() not null
);
create table "public"."empresa_locais" (
  "id" uuid default gen_random_uuid() not null,
  "empresa_id" uuid not null,
  "cidade" text not null,
  "estado" text,
  "pais" text not null,
  "lat" numeric(8,5),
  "lng" numeric(8,5)
);
create table "public"."empresas" (
  "id" uuid default gen_random_uuid() not null,
  "dono" uuid not null,
  "nome" text not null,
  "setor" text,
  "porte" text,
  "site" text,
  "descricao" text,
  "cidade" text,
  "estado" text,
  "pais" text,
  "lat" numeric(8,5),
  "lng" numeric(8,5),
  "verificada" boolean default false not null,
  "criado_em" timestamp with time zone default now() not null,
  "atualizado_em" timestamp with time zone default now() not null
);
create table "public"."experiencias" (
  "id" uuid default gen_random_uuid() not null,
  "profissional_id" uuid not null,
  "cargo" text not null,
  "empresa_nome" text not null,
  "inicio" date,
  "fim" date,
  "contratacao_id" uuid,
  "mostrar_empresa" boolean default true not null,
  "criado_em" timestamp with time zone default now() not null
);
create table "public"."mensagens" (
  "id" bigint generated ALWAYS as identity not null,
  "conversa_id" uuid not null,
  "autor" uuid default auth.uid() not null,
  "de" text not null,
  "texto" text not null,
  "criado_em" timestamp with time zone default now() not null
);
create table "public"."notificacao_prefs" (
  "user_id" uuid not null,
  "categoria" text not null,
  "push" boolean default true not null,
  "email" boolean default true not null
);
create table "public"."notificacoes" (
  "id" bigint generated ALWAYS as identity not null,
  "user_id" uuid not null,
  "categoria" text not null,
  "titulo" text not null,
  "texto" text,
  "link" text,
  "lida_em" timestamp with time zone,
  "email_em" timestamp with time zone,
  "criado_em" timestamp with time zone default now() not null
);
create table "public"."perfis" (
  "id" uuid not null,
  "tipo" text not null,
  "nome" text not null,
  "criado_em" timestamp with time zone default now() not null
);
create table "public"."planos" (
  "id" text not null,
  "nome" text not null,
  "preco" numeric(10,2),
  "moeda" text default 'USD'::text not null,
  "ativo" boolean default true not null
);
create table "public"."profissionais" (
  "id" uuid not null,
  "nome" text not null,
  "resumo" text,
  "sobre" text,
  "cidade" text,
  "estado" text,
  "pais" text,
  "lat" numeric(8,5),
  "lng" numeric(8,5),
  "disponibilidade" text,
  "distancia_max_km" integer default 25 not null,
  "aceita_mudar" boolean default false not null,
  "modelos" text[] default '{presencial}'::text[] not null,
  "competencias" text[] default '{}'::text[] not null,
  "idiomas" jsonb default '[]'::jsonb not null,
  "formacao" text[] default '{}'::text[] not null,
  "verificado" boolean default false not null,
  "visivel" boolean default true not null,
  "criado_em" timestamp with time zone default now() not null,
  "atualizado_em" timestamp with time zone default now() not null
);
create table "public"."salvos" (
  "empresa_id" uuid not null,
  "profissional_id" uuid not null,
  "criado_em" timestamp with time zone default now() not null
);
create table "public"."seguindo" (
  "profissional_id" uuid not null,
  "empresa_id" uuid not null,
  "criado_em" timestamp with time zone default now() not null
);
create table "public"."vagas" (
  "id" uuid default gen_random_uuid() not null,
  "empresa_id" uuid not null,
  "titulo" text not null,
  "descricao" text,
  "status" text default 'rascunho'::text not null,
  "modelo" text default 'presencial'::text not null,
  "tipo" text,
  "moeda" text,
  "salario_min" numeric(12,2),
  "salario_max" numeric(12,2),
  "periodo" text,
  "posicoes" integer default 1 not null,
  "cidade" text,
  "estado" text,
  "pais" text,
  "lat" numeric(8,5),
  "lng" numeric(8,5),
  "raio_valor" integer,
  "raio_unidade" text,
  "fuso" smallint,
  "experiencia" text,
  "requisitos" jsonb default '[]'::jsonb not null,
  "competencias" text[] default '{}'::text[] not null,
  "idiomas" jsonb default '[]'::jsonb not null,
  "triagem" jsonb default '[]'::jsonb not null,
  "publicada_em" timestamp with time zone,
  "expira_em" timestamp with time zone,
  "encerrada_em" timestamp with time zone,
  "destaque_ate" timestamp with time zone,
  "criado_em" timestamp with time zone default now() not null,
  "atualizado_em" timestamp with time zone default now() not null
);

-- Chaves e restrições (primárias e únicas antes das estrangeiras)
alter table "public"."assinaturas" add constraint "assinaturas_pkey" PRIMARY KEY (empresa_id);
alter table "public"."assinaturas" add constraint "assinaturas_plano_check" CHECK ((plano = 'essencial'::text));
alter table "public"."assinaturas" add constraint "assinaturas_status_check" CHECK ((status = ANY (ARRAY['gratis'::text, 'ativa'::text, 'encerrada'::text])));
alter table "public"."assinaturas" add constraint "assinaturas_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE;
alter table "public"."auditoria" add constraint "auditoria_pkey" PRIMARY KEY (id);
alter table "public"."avaliacoes" add constraint "avaliacoes_pkey" PRIMARY KEY (id);
alter table "public"."avaliacoes" add constraint "avaliacoes_contratacao_id_autor_tipo_key" UNIQUE (contratacao_id, autor_tipo);
alter table "public"."avaliacoes" add constraint "avaliacoes_autor_tipo_check" CHECK ((autor_tipo = ANY (ARRAY['empresa'::text, 'profissional'::text])));
alter table "public"."avaliacoes" add constraint "avaliacoes_comentario_check" CHECK ((char_length(comentario) <= 300));
alter table "public"."avaliacoes" add constraint "avaliacoes_nota_check" CHECK (((nota >= 1) AND (nota <= 5)));
alter table "public"."avaliacoes" add constraint "avaliacoes_resposta_check" CHECK ((char_length(resposta) <= 300));
alter table "public"."avaliacoes" add constraint "avaliacoes_contratacao_id_fkey" FOREIGN KEY (contratacao_id) REFERENCES contratacoes(id) ON DELETE CASCADE;
alter table "public"."candidaturas" add constraint "candidaturas_pkey" PRIMARY KEY (id);
alter table "public"."candidaturas" add constraint "candidaturas_vaga_id_profissional_id_key" UNIQUE (vaga_id, profissional_id);
alter table "public"."candidaturas" add constraint "candidaturas_mensagem_check" CHECK ((char_length(mensagem) <= 1000));
alter table "public"."candidaturas" add constraint "candidaturas_pretensao_moeda_check" CHECK ((pretensao_moeda = ANY (ARRAY['BRL'::text, 'USD'::text, 'EUR'::text, 'GBP'::text])));
alter table "public"."candidaturas" add constraint "candidaturas_pretensao_periodo_check" CHECK ((pretensao_periodo = ANY (ARRAY['hora'::text, 'mes'::text, 'ano'::text])));
alter table "public"."candidaturas" add constraint "candidaturas_pretensao_valor_check" CHECK ((pretensao_valor >= (0)::numeric));
alter table "public"."candidaturas" add constraint "candidaturas_status_check" CHECK ((status = ANY (ARRAY['novo'::text, 'conversa'::text, 'nao'::text, 'contratado'::text, 'retirada'::text, 'encerrada'::text])));
alter table "public"."candidaturas" add constraint "candidaturas_profissional_id_fkey" FOREIGN KEY (profissional_id) REFERENCES profissionais(id) ON DELETE CASCADE;
alter table "public"."candidaturas" add constraint "candidaturas_vaga_id_fkey" FOREIGN KEY (vaga_id) REFERENCES vagas(id) ON DELETE CASCADE;
alter table "public"."contatos" add constraint "contatos_pkey" PRIMARY KEY (user_id);
alter table "public"."contatos" add constraint "contatos_canal_check" CHECK ((canal = ANY (ARRAY['whatsapp'::text, 'sms'::text, 'email'::text])));
alter table "public"."contatos" add constraint "contatos_email_check" CHECK ((email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'::text));
alter table "public"."contatos" add constraint "contatos_telefone_check" CHECK ((telefone ~ '^\+?[0-9 ()-]{8,20}$'::text));
alter table "public"."contatos" add constraint "contatos_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table "public"."contratacoes" add constraint "contratacoes_pkey" PRIMARY KEY (id);
alter table "public"."contratacoes" add constraint "contratacoes_contestacao_texto_check" CHECK ((char_length(contestacao_texto) <= 500));
alter table "public"."contratacoes" add constraint "contratacoes_funcao_check" CHECK (((char_length(funcao) >= 2) AND (char_length(funcao) <= 120)));
alter table "public"."contratacoes" add constraint "contratacoes_jornada_check" CHECK ((char_length(jornada) <= 120));
alter table "public"."contratacoes" add constraint "contratacoes_moeda_check" CHECK ((moeda = ANY (ARRAY['BRL'::text, 'USD'::text, 'EUR'::text, 'GBP'::text])));
alter table "public"."contratacoes" add constraint "contratacoes_periodo_check" CHECK ((periodo = ANY (ARRAY['hora'::text, 'mes'::text, 'ano'::text])));
alter table "public"."contratacoes" add constraint "contratacoes_registrada_por_check" CHECK ((registrada_por = ANY (ARRAY['empresa'::text, 'profissional'::text])));
alter table "public"."contratacoes" add constraint "contratacoes_resposta_texto_check" CHECK ((char_length(resposta_texto) <= 500));
alter table "public"."contratacoes" add constraint "contratacoes_status_check" CHECK ((status = ANY (ARRAY['aguardando'::text, 'confirmado'::text, 'contestado'::text, 'recusado'::text])));
alter table "public"."contratacoes" add constraint "contratacoes_tipo_check" CHECK ((tipo = ANY (ARRAY['integral'::text, 'meio_periodo'::text, 'temporario'::text, 'freelancer'::text])));
alter table "public"."contratacoes" add constraint "contratacoes_valor_check" CHECK ((valor >= (0)::numeric));
alter table "public"."contratacoes" add constraint "contratacoes_candidatura_id_fkey" FOREIGN KEY (candidatura_id) REFERENCES candidaturas(id) ON DELETE SET NULL;
alter table "public"."contratacoes" add constraint "contratacoes_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE;
alter table "public"."contratacoes" add constraint "contratacoes_profissional_id_fkey" FOREIGN KEY (profissional_id) REFERENCES profissionais(id) ON DELETE CASCADE;
alter table "public"."contratacoes" add constraint "contratacoes_vaga_id_fkey" FOREIGN KEY (vaga_id) REFERENCES vagas(id) ON DELETE SET NULL;
alter table "public"."conversas" add constraint "conversas_pkey" PRIMARY KEY (id);
alter table "public"."conversas" add constraint "conversas_empresa_id_profissional_id_key" UNIQUE (empresa_id, profissional_id);
alter table "public"."conversas" add constraint "conversas_deu_certo_empresa_check" CHECK ((deu_certo_empresa = ANY (ARRAY['sim'::text, 'nao'::text])));
alter table "public"."conversas" add constraint "conversas_deu_certo_profissional_check" CHECK ((deu_certo_profissional = ANY (ARRAY['sim'::text, 'nao'::text])));
alter table "public"."conversas" add constraint "conversas_ultima_mensagem_de_check" CHECK ((ultima_mensagem_de = ANY (ARRAY['empresa'::text, 'profissional'::text])));
alter table "public"."conversas" add constraint "conversas_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE;
alter table "public"."conversas" add constraint "conversas_profissional_id_fkey" FOREIGN KEY (profissional_id) REFERENCES profissionais(id) ON DELETE CASCADE;
alter table "public"."conversas" add constraint "conversas_vaga_id_fkey" FOREIGN KEY (vaga_id) REFERENCES vagas(id) ON DELETE SET NULL;
alter table "public"."convites" add constraint "convites_pkey" PRIMARY KEY (id);
alter table "public"."convites" add constraint "convites_mensagem_check" CHECK ((char_length(mensagem) <= 500));
alter table "public"."convites" add constraint "convites_status_check" CHECK ((status = ANY (ARRAY['enviado'::text, 'aceito'::text, 'recusado'::text])));
alter table "public"."convites" add constraint "convites_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE;
alter table "public"."convites" add constraint "convites_profissional_id_fkey" FOREIGN KEY (profissional_id) REFERENCES profissionais(id) ON DELETE CASCADE;
alter table "public"."convites" add constraint "convites_vaga_id_fkey" FOREIGN KEY (vaga_id) REFERENCES vagas(id) ON DELETE SET NULL;
alter table "public"."cotacoes" add constraint "cotacoes_pkey" PRIMARY KEY (par, data);
alter table "public"."cotacoes" add constraint "cotacoes_taxa_check" CHECK ((taxa > (0)::numeric));
alter table "public"."denuncias" add constraint "denuncias_pkey" PRIMARY KEY (id);
alter table "public"."denuncias" add constraint "denuncias_alvo_tipo_check" CHECK ((alvo_tipo = ANY (ARRAY['vaga'::text, 'empresa'::text, 'profissional'::text, 'conversa'::text, 'avaliacao'::text])));
alter table "public"."denuncias" add constraint "denuncias_detalhe_check" CHECK ((char_length(detalhe) <= 500));
alter table "public"."denuncias" add constraint "denuncias_motivo_check" CHECK (((char_length(motivo) >= 2) AND (char_length(motivo) <= 80)));
alter table "public"."denuncias" add constraint "denuncias_status_check" CHECK ((status = ANY (ARRAY['em_analise'::text, 'procedente'::text, 'improcedente'::text])));
alter table "public"."denuncias" add constraint "denuncias_autor_fkey" FOREIGN KEY (autor) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table "public"."empresa_locais" add constraint "empresa_locais_pkey" PRIMARY KEY (id);
alter table "public"."empresa_locais" add constraint "empresa_locais_lat_check" CHECK (((lat >= ('-90'::integer)::numeric) AND (lat <= (90)::numeric)));
alter table "public"."empresa_locais" add constraint "empresa_locais_lng_check" CHECK (((lng >= ('-180'::integer)::numeric) AND (lng <= (180)::numeric)));
alter table "public"."empresa_locais" add constraint "empresa_locais_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE;
alter table "public"."empresas" add constraint "empresas_pkey" PRIMARY KEY (id);
alter table "public"."empresas" add constraint "empresas_dono_key" UNIQUE (dono);
alter table "public"."empresas" add constraint "empresas_descricao_check" CHECK ((char_length(descricao) <= 1000));
alter table "public"."empresas" add constraint "empresas_lat_check" CHECK (((lat >= ('-90'::integer)::numeric) AND (lat <= (90)::numeric)));
alter table "public"."empresas" add constraint "empresas_lng_check" CHECK (((lng >= ('-180'::integer)::numeric) AND (lng <= (180)::numeric)));
alter table "public"."empresas" add constraint "empresas_nome_check" CHECK (((char_length(nome) >= 2) AND (char_length(nome) <= 120)));
alter table "public"."empresas" add constraint "empresas_porte_check" CHECK ((porte = ANY (ARRAY['1 a 9 pessoas'::text, '10 a 49 pessoas'::text, '50 a 249 pessoas'::text, '250 pessoas ou mais'::text])));
alter table "public"."empresas" add constraint "empresas_dono_fkey" FOREIGN KEY (dono) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table "public"."experiencias" add constraint "experiencias_pkey" PRIMARY KEY (id);
alter table "public"."experiencias" add constraint "experiencias_cargo_check" CHECK (((char_length(cargo) >= 2) AND (char_length(cargo) <= 120)));
alter table "public"."experiencias" add constraint "experiencias_check" CHECK (((fim IS NULL) OR (inicio IS NULL) OR (fim >= inicio)));
alter table "public"."experiencias" add constraint "experiencias_empresa_nome_check" CHECK (((char_length(empresa_nome) >= 2) AND (char_length(empresa_nome) <= 120)));
alter table "public"."experiencias" add constraint "experiencias_contratacao_fk" FOREIGN KEY (contratacao_id) REFERENCES contratacoes(id) ON DELETE CASCADE;
alter table "public"."experiencias" add constraint "experiencias_profissional_id_fkey" FOREIGN KEY (profissional_id) REFERENCES profissionais(id) ON DELETE CASCADE;
alter table "public"."mensagens" add constraint "mensagens_pkey" PRIMARY KEY (id);
alter table "public"."mensagens" add constraint "mensagens_de_check" CHECK ((de = ANY (ARRAY['empresa'::text, 'profissional'::text])));
alter table "public"."mensagens" add constraint "mensagens_texto_check" CHECK (((char_length(btrim(texto)) >= 1) AND (char_length(btrim(texto)) <= 2000)));
alter table "public"."mensagens" add constraint "mensagens_autor_fkey" FOREIGN KEY (autor) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table "public"."mensagens" add constraint "mensagens_conversa_id_fkey" FOREIGN KEY (conversa_id) REFERENCES conversas(id) ON DELETE CASCADE;
alter table "public"."notificacao_prefs" add constraint "notificacao_prefs_pkey" PRIMARY KEY (user_id, categoria);
alter table "public"."notificacao_prefs" add constraint "notificacao_prefs_categoria_check" CHECK ((categoria = ANY (ARRAY['mensagens'::text, 'candidaturas'::text, 'vagas'::text, 'contratacao'::text, 'avaliacoes'::text, 'convites'::text, 'plano'::text])));
alter table "public"."notificacao_prefs" add constraint "notificacao_prefs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table "public"."notificacoes" add constraint "notificacoes_pkey" PRIMARY KEY (id);
alter table "public"."notificacoes" add constraint "notificacoes_categoria_check" CHECK ((categoria = ANY (ARRAY['mensagens'::text, 'candidaturas'::text, 'vagas'::text, 'contratacao'::text, 'avaliacoes'::text, 'convites'::text, 'plano'::text])));
alter table "public"."notificacoes" add constraint "notificacoes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table "public"."perfis" add constraint "perfis_pkey" PRIMARY KEY (id);
alter table "public"."perfis" add constraint "perfis_nome_check" CHECK (((char_length(nome) >= 2) AND (char_length(nome) <= 120)));
alter table "public"."perfis" add constraint "perfis_tipo_check" CHECK ((tipo = ANY (ARRAY['empresa'::text, 'profissional'::text])));
alter table "public"."perfis" add constraint "perfis_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table "public"."planos" add constraint "planos_pkey" PRIMARY KEY (id);
alter table "public"."planos" add constraint "planos_moeda_check" CHECK ((moeda = ANY (ARRAY['USD'::text, 'BRL'::text, 'ARS'::text, 'MXN'::text, 'CLP'::text, 'COP'::text, 'PEN'::text, 'UYU'::text])));
alter table "public"."planos" add constraint "planos_preco_check" CHECK ((preco > (0)::numeric));
alter table "public"."profissionais" add constraint "profissionais_pkey" PRIMARY KEY (id);
alter table "public"."profissionais" add constraint "profissionais_competencias_check" CHECK ((COALESCE(array_length(competencias, 1), 0) <= 12));
alter table "public"."profissionais" add constraint "profissionais_distancia_max_km_check" CHECK (((distancia_max_km >= 1) AND (distancia_max_km <= 500)));
alter table "public"."profissionais" add constraint "profissionais_lat_check" CHECK (((lat >= ('-90'::integer)::numeric) AND (lat <= (90)::numeric)));
alter table "public"."profissionais" add constraint "profissionais_lng_check" CHECK (((lng >= ('-180'::integer)::numeric) AND (lng <= (180)::numeric)));
alter table "public"."profissionais" add constraint "profissionais_modelos_check" CHECK ((modelos <@ ARRAY['presencial'::text, 'hibrido'::text, 'remoto'::text]));
alter table "public"."profissionais" add constraint "profissionais_nome_check" CHECK (((char_length(nome) >= 2) AND (char_length(nome) <= 120)));
alter table "public"."profissionais" add constraint "profissionais_resumo_check" CHECK ((char_length(resumo) <= 160));
alter table "public"."profissionais" add constraint "profissionais_sobre_check" CHECK ((char_length(sobre) <= 1000));
alter table "public"."profissionais" add constraint "profissionais_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table "public"."salvos" add constraint "salvos_pkey" PRIMARY KEY (empresa_id, profissional_id);
alter table "public"."salvos" add constraint "salvos_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE;
alter table "public"."salvos" add constraint "salvos_profissional_id_fkey" FOREIGN KEY (profissional_id) REFERENCES profissionais(id) ON DELETE CASCADE;
alter table "public"."seguindo" add constraint "seguindo_pkey" PRIMARY KEY (profissional_id, empresa_id);
alter table "public"."seguindo" add constraint "seguindo_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE;
alter table "public"."seguindo" add constraint "seguindo_profissional_id_fkey" FOREIGN KEY (profissional_id) REFERENCES profissionais(id) ON DELETE CASCADE;
alter table "public"."vagas" add constraint "vagas_pkey" PRIMARY KEY (id);
alter table "public"."vagas" add constraint "vaga_local_para_publicar" CHECK (((status = 'rascunho'::text) OR (modelo = 'remoto'::text) OR ((cidade IS NOT NULL) AND (pais IS NOT NULL) AND (lat IS NOT NULL) AND (lng IS NOT NULL) AND (raio_valor IS NOT NULL) AND (raio_unidade IS NOT NULL))));
alter table "public"."vagas" add constraint "vaga_salario_faixa" CHECK (((salario_max IS NULL) OR (salario_min IS NULL) OR (salario_max >= salario_min)));
alter table "public"."vagas" add constraint "vagas_competencias_check" CHECK ((COALESCE(array_length(competencias, 1), 0) <= 12));
alter table "public"."vagas" add constraint "vagas_descricao_check" CHECK ((char_length(descricao) <= 4000));
alter table "public"."vagas" add constraint "vagas_fuso_check" CHECK (((fuso >= '-12'::integer) AND (fuso <= 14)));
alter table "public"."vagas" add constraint "vagas_lat_check" CHECK (((lat >= ('-90'::integer)::numeric) AND (lat <= (90)::numeric)));
alter table "public"."vagas" add constraint "vagas_lng_check" CHECK (((lng >= ('-180'::integer)::numeric) AND (lng <= (180)::numeric)));
alter table "public"."vagas" add constraint "vagas_modelo_check" CHECK ((modelo = ANY (ARRAY['presencial'::text, 'hibrido'::text, 'remoto'::text])));
alter table "public"."vagas" add constraint "vagas_moeda_check" CHECK ((moeda = ANY (ARRAY['BRL'::text, 'USD'::text, 'EUR'::text, 'GBP'::text])));
alter table "public"."vagas" add constraint "vagas_periodo_check" CHECK ((periodo = ANY (ARRAY['hora'::text, 'mes'::text, 'ano'::text])));
alter table "public"."vagas" add constraint "vagas_posicoes_check" CHECK (((posicoes >= 1) AND (posicoes <= 100)));
alter table "public"."vagas" add constraint "vagas_raio_unidade_check" CHECK ((raio_unidade = ANY (ARRAY['km'::text, 'mi'::text])));
alter table "public"."vagas" add constraint "vagas_raio_valor_check" CHECK (((raio_valor >= 1) AND (raio_valor <= 500)));
alter table "public"."vagas" add constraint "vagas_salario_max_check" CHECK ((salario_max >= (0)::numeric));
alter table "public"."vagas" add constraint "vagas_salario_min_check" CHECK ((salario_min >= (0)::numeric));
alter table "public"."vagas" add constraint "vagas_status_check" CHECK ((status = ANY (ARRAY['rascunho'::text, 'aberta'::text, 'pausada'::text, 'preenchida'::text, 'cancelada'::text, 'expirada'::text])));
alter table "public"."vagas" add constraint "vagas_tipo_check" CHECK ((tipo = ANY (ARRAY['integral'::text, 'meio_periodo'::text, 'temporario'::text, 'freelancer'::text])));
alter table "public"."vagas" add constraint "vagas_titulo_check" CHECK (((char_length(titulo) >= 3) AND (char_length(titulo) <= 120)));
alter table "public"."vagas" add constraint "vagas_triagem_check" CHECK (((jsonb_typeof(triagem) = 'array'::text) AND (jsonb_array_length(triagem) <= 3)));
alter table "public"."vagas" add constraint "vagas_empresa_id_fkey" FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE;

-- Índices
CREATE INDEX candidaturas_profissional_idx ON public.candidaturas USING btree (profissional_id);
CREATE INDEX contratacoes_empresa_idx ON public.contratacoes USING btree (empresa_id);
CREATE INDEX contratacoes_profissional_idx ON public.contratacoes USING btree (profissional_id);
CREATE INDEX convites_profissional_idx ON public.convites USING btree (profissional_id);
CREATE UNIQUE INDEX experiencias_contratacao_unica ON public.experiencias USING btree (contratacao_id) WHERE (contratacao_id IS NOT NULL);
CREATE INDEX mensagens_conversa_idx ON public.mensagens USING btree (conversa_id, criado_em);
CREATE INDEX notificacoes_user_idx ON public.notificacoes USING btree (user_id, criado_em DESC);
CREATE INDEX vagas_abertas_idx ON public.vagas USING btree (status, publicada_em DESC) WHERE (status = 'aberta'::text);
CREATE INDEX vagas_empresa_idx ON public.vagas USING btree (empresa_id);

-- Views
create or replace view "public"."reputacao_empresas" as
SELECT e.id AS empresa_id,
    count(DISTINCT k.id) FILTER (WHERE (k.status = 'confirmado'::text)) AS contratacoes,
    count(a.id) AS avaliacoes,
    round(avg(a.nota), 1) AS nota,
    round(((100.0 * (count(a.id) FILTER (WHERE ((a.respostas ->> 'pagamento'::text) = 'Sim'::text)))::numeric) / (NULLIF(count(a.id), 0))::numeric)) AS pagou_conforme_pct,
    round(((100.0 * (count(a.id) FILTER (WHERE ((a.respostas ->> 'anuncio'::text) = 'Sim'::text)))::numeric) / (NULLIF(count(a.id), 0))::numeric)) AS correspondia_pct,
    round(((100.0 * (count(a.id) FILTER (WHERE ((a.respostas ->> 'novamente'::text) = 'Sim'::text)))::numeric) / (NULLIF(count(a.id), 0))::numeric)) AS trabalhariam_de_novo_pct,
    (count(a.id) < 3) AS em_construcao
   FROM ((empresas e
     LEFT JOIN contratacoes k ON ((k.empresa_id = e.id)))
     LEFT JOIN avaliacoes a ON (((a.contratacao_id = k.id) AND (a.autor_tipo = 'profissional'::text) AND (NOT a.removida) AND ((( SELECT count(*) AS count
           FROM avaliacoes x
          WHERE (x.contratacao_id = k.id)) = 2) OR (k.avaliar_ate < now())))))
  GROUP BY e.id;
create or replace view "public"."reputacao_profissionais" as
SELECT p.id AS profissional_id,
    count(DISTINCT k.id) FILTER (WHERE (k.status = 'confirmado'::text)) AS trabalhos,
    count(a.id) AS avaliacoes,
    round(avg(a.nota), 1) AS nota,
    round(((100.0 * (count(a.id) FILTER (WHERE ((a.respostas ->> 'novamente'::text) = 'Sim'::text)))::numeric) / (NULLIF(count(a.id), 0))::numeric)) AS contratariam_de_novo_pct,
    (count(a.id) < 3) AS em_construcao
   FROM ((profissionais p
     LEFT JOIN contratacoes k ON ((k.profissional_id = p.id)))
     LEFT JOIN avaliacoes a ON (((a.contratacao_id = k.id) AND (a.autor_tipo = 'empresa'::text) AND (NOT a.removida) AND ((( SELECT count(*) AS count
           FROM avaliacoes x
          WHERE (x.contratacao_id = k.id)) = 2) OR (k.avaliar_ate < now())))))
  GROUP BY p.id;

-- Funções
CREATE OR REPLACE FUNCTION public.auditar()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.auditoria (quem, tabela, registro, acao, antes, depois)
  values (auth.uid(), tg_table_name, coalesce(new.id, old.id), lower(tg_op),
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return null;
end $function$;

CREATE OR REPLACE FUNCTION public.avaliacao_publicada(p_contratacao uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select (select count(*) from public.avaliacoes where contratacao_id = p_contratacao) = 2
      or coalesce((select avaliar_ate < now() from public.contratacoes where id = p_contratacao), false)
$function$;

CREATE OR REPLACE FUNCTION public.avisos_pendentes_email(p_limite integer DEFAULT 50, p_espera_min integer DEFAULT 3)
 RETURNS TABLE(user_id uuid, email text, nome text, avisos jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select n.user_id, u.email::text, coalesce(pf.nome, split_part(u.email, '@', 1))::text,
         jsonb_agg(jsonb_build_object('id', n.id, 'categoria', n.categoria, 'titulo', n.titulo, 'texto', n.texto, 'link', n.link, 'criado_em', n.criado_em)
                   order by n.criado_em desc)
  from public.notificacoes n
  join auth.users u on u.id = n.user_id
  left join public.perfis pf on pf.id = n.user_id
  where n.email_em is null and n.lida_em is null
    and n.criado_em < now() - make_interval(mins => p_espera_min)
    and u.email is not null
    and not exists (select 1 from public.notificacao_prefs np where np.user_id = n.user_id and np.categoria = n.categoria and not np.email)
  group by n.user_id, u.email, pf.nome
  limit p_limite
$function$;

CREATE OR REPLACE FUNCTION public.candidatou_a_mim(p_profissional uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.candidaturas c join public.vagas v on v.id = c.vaga_id
                 join public.empresas e on e.id = v.empresa_id
                 where c.profissional_id = p_profissional and e.dono = auth.uid())
$function$;

CREATE OR REPLACE FUNCTION public.contato_da_conversa(p_conversa uuid)
 RETURNS TABLE(canal text, telefone text, email text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  c public.conversas;
  lado text;
  alvo uuid;
begin
  select * into c from public.conversas where id = p_conversa;
  lado := public.meu_lado(c.empresa_id, c.profissional_id);
  if lado is null then raise exception 'Você não participa desta conversa.'; end if;
  if not (c.compartilhou_empresa and c.compartilhou_profissional) then
    raise exception 'O contato é liberado quando os dois compartilham.';
  end if;
  alvo := case lado when 'empresa' then c.profissional_id else (select dono from public.empresas where id = c.empresa_id) end;
  return query select ct.canal, ct.telefone, ct.email from public.contatos ct where ct.user_id = alvo;
end $function$;

CREATE OR REPLACE FUNCTION public.conversou_comigo(p_profissional uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.conversas c join public.empresas e on e.id = c.empresa_id
                 where c.profissional_id = p_profissional and e.dono = auth.uid())
$function$;

CREATE OR REPLACE FUNCTION public.criar_conta()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_tipo text := new.raw_user_meta_data ->> 'tipo';
  v_nome text := coalesce(nullif(btrim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1));
begin
  if v_tipo not in ('empresa', 'profissional') then
    return new;  -- conta sem tipo (ex.: criada no painel): o app pede o tipo depois
  end if;
  insert into public.perfis (id, tipo, nome) values (new.id, v_tipo, v_nome);
  if v_tipo = 'empresa' then
    insert into public.empresas (dono, nome) values (new.id, v_nome);
  else
    insert into public.profissionais (id, nome) values (new.id, v_nome);
  end if;
  insert into public.contatos (user_id, email) values (new.id, new.email);
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.efeitos_contratacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.status = 'confirmado' and old.status is distinct from 'confirmado' then
    perform public.ligar_sistema(true);
    if new.candidatura_id is not null then
      update public.candidaturas set status = 'contratado' where id = new.candidatura_id;
    end if;
    insert into public.experiencias (profissional_id, cargo, empresa_nome, inicio, contratacao_id)
      select new.profissional_id, new.funcao, e.nome, new.data_inicio, new.id
      from public.empresas e where e.id = new.empresa_id
      on conflict do nothing;
    perform public.ligar_sistema(false);
  end if;
  if new.encerrada_em is not null and old.encerrada_em is null then
    perform public.ligar_sistema(true);
    update public.experiencias set fim = new.encerrada_em where contratacao_id = new.id;
    perform public.ligar_sistema(false);
  end if;
  return null;
end $function$;

CREATE OR REPLACE FUNCTION public.eh_dono_empresa(p_empresa uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.empresas where id = p_empresa and dono = auth.uid())
$function$;

CREATE OR REPLACE FUNCTION public.eh_dono_vaga(p_vaga uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.vagas v join public.empresas e on e.id = v.empresa_id
                 where v.id = p_vaga and e.dono = auth.uid())
$function$;

CREATE OR REPLACE FUNCTION public.eh_sistema()
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select coalesce(current_setting('kor.sistema', true), '') = 'on' or auth.uid() is null
$function$;

CREATE OR REPLACE FUNCTION public.encerrar_candidaturas()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.status in ('preenchida', 'cancelada', 'expirada') and old.status is distinct from new.status then
    perform public.ligar_sistema(true);
    update public.candidaturas set status = 'encerrada', status_em = now()
      where vaga_id = new.id and status in ('novo', 'conversa');
    perform public.ligar_sistema(false);
  end if;
  return null;
end $function$;

CREATE OR REPLACE FUNCTION public.guarda_empresa()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if not public.eh_sistema() and (new.verificada is distinct from old.verificada or new.dono is distinct from old.dono) then
    raise exception 'Só a moderação altera a verificação da empresa.';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.guarda_experiencia()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if public.eh_sistema() then return coalesce(new, old); end if;
  if tg_op = 'INSERT' and new.contratacao_id is not null then
    raise exception 'Experiência verificada só nasce de uma contratação confirmada.';
  end if;
  if tg_op = 'UPDATE' and old.contratacao_id is not null and (
       new.cargo, new.empresa_nome, new.inicio, new.fim, new.contratacao_id, new.profissional_id)
       is distinct from (old.cargo, old.empresa_nome, old.inicio, old.fim, old.contratacao_id, old.profissional_id) then
    raise exception 'Experiência verificada não pode ser editada; só dá para ocultar o nome da empresa.';
  end if;
  if tg_op = 'UPDATE' and old.contratacao_id is null and new.contratacao_id is not null then
    raise exception 'Experiência declarada não vira verificada à mão.';
  end if;
  if tg_op = 'DELETE' and old.contratacao_id is not null then
    raise exception 'Experiência verificada não pode ser apagada; só dá para ocultar o nome da empresa.';
  end if;
  return coalesce(new, old);
end $function$;

CREATE OR REPLACE FUNCTION public.guarda_notificacao()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if not public.eh_sistema() and (new.user_id, new.categoria, new.titulo, new.texto, new.link, new.email_em, new.criado_em)
     is distinct from (old.user_id, old.categoria, old.titulo, old.texto, old.link, old.email_em, old.criado_em) then
    raise exception 'Só dá para marcar o aviso como lido.';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.guarda_profissional()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if not public.eh_sistema() and new.verificado is distinct from old.verificado then
    raise exception 'Só a moderação altera a verificação do perfil.';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.lembretes_diarios()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  antes text := coalesce(current_setting('kor.sistema', true), '');
  r record;
  n_cand integer := 0; n_aval integer := 0; n_plano integer := 0;
  dias integer;
begin
  perform set_config('kor.sistema', 'on', true);

  -- 1. Resposta garantida (seção 7.1): candidatos "novos" há mais de 7 dias.
  for r in
    select v.id as vaga_id, v.titulo, e.dono, count(*) as n
    from public.candidaturas c join public.vagas v on v.id = c.vaga_id join public.empresas e on e.id = v.empresa_id
    where c.status = 'novo' and c.lembrete_em is null and c.criado_em < now() - interval '7 days'
    group by v.id, v.titulo, e.dono
  loop
    perform public.notificar(r.dono, 'candidaturas',
      r.n || case when r.n = 1 then ' candidato esperando' else ' candidatos esperando' end || ' resposta há mais de 7 dias',
      'Vaga ' || r.titulo || '. Chame para conversa ou marque como não selecionado: a resposta garantida conta na sua reputação.',
      'candidatos.html?vaga=' || r.vaga_id, true);
  end loop;
  for r in
    select c.id, c.profissional_id, v.titulo, e.nome as empresa
    from public.candidaturas c join public.vagas v on v.id = c.vaga_id join public.empresas e on e.id = v.empresa_id
    where c.status = 'novo' and c.lembrete_em is null and c.criado_em < now() - interval '7 days'
  loop
    perform public.notificar(r.profissional_id, 'candidaturas', 'Candidatura sem resposta',
      r.empresa || ' ainda não respondeu sobre ' || r.titulo || '. A empresa recebeu um lembrete.', 'candidaturas.html');
    update public.candidaturas set lembrete_em = now() where id = r.id;
    n_cand := n_cand + 1;
  end loop;

  -- 2. Avaliação perto do prazo (faltam 2 dias ou menos) para quem ainda não avaliou.
  for r in
    select k.*, e.dono, e.nome as empresa, p.nome as profissional
    from public.contratacoes k join public.empresas e on e.id = k.empresa_id join public.profissionais p on p.id = k.profissional_id
    where k.status = 'confirmado' and k.lembrete_avaliacao_em is null
      and k.avaliar_ate > now() and k.avaliar_ate <= now() + interval '2 days'
  loop
    if not exists (select 1 from public.avaliacoes where contratacao_id = r.id and autor_tipo = 'empresa') then
      perform public.notificar(r.dono, 'avaliacoes', 'Últimos dias para avaliar ' || r.profissional,
        'A avaliação fecha em ' || to_char(r.avaliar_ate - interval '1 second', 'DD/MM') || '.', 'avaliar.html?id=' || r.id);
    end if;
    if not exists (select 1 from public.avaliacoes where contratacao_id = r.id and autor_tipo = 'profissional') then
      perform public.notificar(r.profissional_id, 'avaliacoes', 'Últimos dias para avaliar ' || r.empresa,
        'A avaliação fecha em ' || to_char(r.avaliar_ate - interval '1 second', 'DD/MM') || '.', 'avaliar.html?id=' || r.id);
    end if;
    update public.contratacoes set lembrete_avaliacao_em = now() where id = r.id;
    n_aval := n_aval + 1;
  end loop;

  -- 3. Período grátis: aviso com 7 dias, 1 dia e no dia em que termina.
  for r in
    select a.*, e.dono from public.assinaturas a join public.empresas e on e.id = a.empresa_id where a.status = 'gratis'
  loop
    dias := (r.gratis_ate::date - current_date);
    if dias in (7, 1) then
      perform public.notificar(r.dono, 'plano', 'Faltam ' || dias || case when dias = 1 then ' dia' else ' dias' end || ' do período grátis',
        'Escolha o plano Essencial para continuar publicando vagas. Suas vagas não são apagadas.', 'plano.html', true);
      n_plano := n_plano + 1;
    elsif dias = 0 then
      perform public.notificar(r.dono, 'plano', 'O período grátis termina hoje',
        'Assine o Essencial para continuar publicando e reativando vagas.', 'plano.html', true);
      n_plano := n_plano + 1;
    end if;
  end loop;

  perform set_config('kor.sistema', antes, true);
  return jsonb_build_object('candidaturas', n_cand, 'avaliacoes', n_aval, 'plano', n_plano);
end $function$;

CREATE OR REPLACE FUNCTION public.ligar_sistema(ligado boolean)
 RETURNS void
 LANGUAGE sql
AS $function$
  select set_config('kor.sistema', case when ligado then 'on' else 'off' end, true)
$function$;

CREATE OR REPLACE FUNCTION public.marcar_avisos_enviados(p_ids bigint[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  antes text := coalesce(current_setting('kor.sistema', true), '');
  n integer;
begin
  perform set_config('kor.sistema', 'on', true);
  update public.notificacoes set email_em = now() where id = any(p_ids) and email_em is null;
  get diagnostics n = row_count;
  perform set_config('kor.sistema', antes, true);
  return n;
end $function$;

CREATE OR REPLACE FUNCTION public.meu_lado(p_empresa uuid, p_profissional uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when exists (select 1 from public.empresas where id = p_empresa and dono = auth.uid()) then 'empresa'
    when p_profissional = auth.uid() then 'profissional'
  end
$function$;

CREATE OR REPLACE FUNCTION public.minha_empresa()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select id from public.empresas where dono = auth.uid()
$function$;

CREATE OR REPLACE FUNCTION public.notif_avaliacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  k public.contratacoes; e public.empresas; p public.profissionais; n integer;
begin
  select * into k from public.contratacoes where id = new.contratacao_id;
  select * into e from public.empresas where id = k.empresa_id;
  select * into p from public.profissionais where id = k.profissional_id;
  select count(*) into n from public.avaliacoes where contratacao_id = k.id;
  if n >= 2 then
    perform public.notificar(e.dono, 'avaliacoes', 'Avaliações publicadas', 'As avaliações de ' || k.funcao || ' com ' || p.nome || ' foram publicadas.', 'perfil.html#minha-reputacao');
    perform public.notificar(p.id, 'avaliacoes', 'Avaliações publicadas', 'As avaliações de ' || k.funcao || ' com ' || e.nome || ' foram publicadas.', 'perfil.html#minha-reputacao');
  elsif new.autor_tipo = 'empresa' then
    perform public.notificar(p.id, 'avaliacoes', e.nome || ' já avaliou', 'Envie a sua até ' || to_char(k.avaliar_ate - interval '1 second', 'DD/MM') || '. As duas são publicadas juntas.', 'avaliar.html?id=' || k.id);
  else
    perform public.notificar(e.dono, 'avaliacoes', p.nome || ' já avaliou', 'Envie a sua até ' || to_char(k.avaliar_ate - interval '1 second', 'DD/MM') || '. As duas são publicadas juntas.', 'avaliar.html?id=' || k.id);
  end if;
  return null;
end $function$;

CREATE OR REPLACE FUNCTION public.notif_candidatura()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v public.vagas; e public.empresas; p public.profissionais;
begin
  select * into v from public.vagas where id = new.vaga_id;
  select * into e from public.empresas where id = v.empresa_id;
  select * into p from public.profissionais where id = new.profissional_id;
  if tg_op = 'INSERT' then
    perform public.notificar(e.dono, 'candidaturas', 'Nova candidatura: ' || v.titulo, p.nome || ' se candidatou. Responda em até 7 dias.', 'candidatos.html?vaga=' || v.id);
  elsif new.status is distinct from old.status then
    if new.status = 'conversa' then
      perform public.notificar(p.id, 'candidaturas', e.nome || ' quer conversar com você', 'Vaga ' || v.titulo || '. Veja a mensagem e responda.', 'candidaturas.html');
    elsif new.status = 'nao' then
      perform public.notificar(p.id, 'candidaturas', 'Retorno da candidatura', 'Desta vez ' || e.nome || ' seguiu com outro perfil para ' || v.titulo || '. Seu perfil continua visível para as próximas vagas.', 'candidaturas.html?aba=encerradas');
    elsif new.status = 'encerrada' then
      perform public.notificar(p.id, 'candidaturas', 'Vaga encerrada', v.titulo || ' foi encerrada por ' || e.nome || '.', 'candidaturas.html?aba=encerradas');
    elsif new.status = 'retirada' then
      perform public.notificar(e.dono, 'candidaturas', 'Candidatura retirada', p.nome || ' retirou a candidatura para ' || v.titulo || '.', 'candidatos.html?vaga=' || v.id);
    end if;
  end if;
  return null;
end $function$;

CREATE OR REPLACE FUNCTION public.notif_contratacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  e public.empresas; p public.profissionais;
  u_reg uuid; u_outro uuid; n_reg text; n_outro text;
begin
  select * into e from public.empresas where id = new.empresa_id;
  select * into p from public.profissionais where id = new.profissional_id;
  if new.registrada_por = 'empresa' then u_reg := e.dono; n_reg := e.nome; u_outro := p.id; n_outro := p.nome;
  else u_reg := p.id; n_reg := p.nome; u_outro := e.dono; n_outro := e.nome; end if;

  if tg_op = 'INSERT' then
    perform public.notificar(u_outro, 'contratacao', 'Confirme a contratação', n_reg || ' registrou a contratação: ' || new.funcao || '. Confira o combinado.', 'contratacoes.html');
    return null;
  end if;
  if new.status is distinct from old.status then
    if new.status = 'confirmado' then
      perform public.notificar(u_reg, 'contratacao', 'Contratação confirmada', n_outro || ' confirmou: ' || new.funcao || '. O vínculo entrou no histórico verificado.', 'contratacoes.html');
    elsif new.status = 'contestado' then
      perform public.notificar(u_reg, 'contratacao', 'Combinado contestado', n_outro || ': ' || coalesce(new.contestacao_texto, ''), 'contratacoes.html');
    elsif new.status = 'recusado' then
      perform public.notificar(u_reg, 'contratacao', 'Contratação recusada', n_outro || ' disse que a contratação não aconteceu. Se aconteceu, conteste.', 'contratacoes.html');
    elsif new.status = 'aguardando' and old.status = 'contestado' then
      perform public.notificar(u_outro, 'contratacao', 'Combinado revisto', n_reg || ' respondeu à sua contestação. Confira e confirme.', 'contratacoes.html');
    end if;
  end if;
  if new.encerrada_em is not null and old.encerrada_em is null then
    perform public.notificar(e.dono, 'avaliacoes', 'Avalie ' || p.nome, 'O vínculo terminou. A avaliação fica aberta até ' || to_char(new.avaliar_ate - interval '1 second', 'DD/MM') || '.', 'avaliar.html?id=' || new.id);
    perform public.notificar(p.id, 'avaliacoes', 'Avalie ' || e.nome, 'O vínculo terminou. A avaliação fica aberta até ' || to_char(new.avaliar_ate - interval '1 second', 'DD/MM') || '.', 'avaliar.html?id=' || new.id);
  end if;
  return null;
end $function$;

CREATE OR REPLACE FUNCTION public.notif_mensagem()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  c public.conversas; e public.empresas; p public.profissionais;
begin
  select * into c from public.conversas where id = new.conversa_id;
  select * into e from public.empresas where id = c.empresa_id;
  select * into p from public.profissionais where id = c.profissional_id;
  if new.de = 'empresa' then
    perform public.notificar(c.profissional_id, 'mensagens', 'Nova mensagem de ' || e.nome, new.texto, 'conversa.html?id=' || c.id, true);
  else
    perform public.notificar(e.dono, 'mensagens', 'Nova mensagem de ' || p.nome, new.texto, 'conversa.html?id=' || c.id, true);
  end if;
  return null;
end $function$;

CREATE OR REPLACE FUNCTION public.notificar(p_user uuid, p_categoria text, p_titulo text, p_texto text, p_link text, p_agrupar boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  antes text := coalesce(current_setting('kor.sistema', true), '');  -- devolve como estava (pode rodar dentro de outra ação do sistema)
begin
  if p_user is null then return; end if;
  if exists (select 1 from public.notificacao_prefs where user_id = p_user and categoria = p_categoria and not push) then return; end if;
  perform set_config('kor.sistema', 'on', true);
  if p_agrupar then
    update public.notificacoes set titulo = p_titulo, texto = left(p_texto, 200), criado_em = now(), email_em = null
      where user_id = p_user and link = p_link and lida_em is null;
  end if;
  if not p_agrupar or not found then
    insert into public.notificacoes (user_id, categoria, titulo, texto, link) values (p_user, p_categoria, p_titulo, left(p_texto, 200), p_link);
  end if;
  perform set_config('kor.sistema', antes, true);
end $function$;

CREATE OR REPLACE FUNCTION public.regras_avaliacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  k public.contratacoes;
  lado text;
begin
  select * into k from public.contratacoes where id = coalesce(new.contratacao_id, old.contratacao_id);
  if public.eh_sistema() then return new; end if;
  lado := public.meu_lado(k.empresa_id, k.profissional_id);
  if tg_op = 'INSERT' then
    if lado is null or lado <> new.autor_tipo then raise exception 'Você só avalia em seu próprio nome.'; end if;
    if k.status <> 'confirmado' then raise exception 'Só existe avaliação de vínculo confirmado pelos dois lados.'; end if;
    if k.avaliar_ate is null or now() > k.avaliar_ate then raise exception 'A avaliação não está aberta para este vínculo.'; end if;
    new.resposta := null;
    new.removida := false;
    new.criado_em := now();
    return new;
  end if;
  if (new.contratacao_id, new.autor_tipo, new.respostas, new.nota, new.comentario, new.removida, new.criado_em)
     is distinct from (old.contratacao_id, old.autor_tipo, old.respostas, old.nota, old.comentario, old.removida, old.criado_em) then
    raise exception 'A avaliação enviada não pode ser alterada.';
  end if;
  if new.resposta is distinct from old.resposta and (lado is null or lado = old.autor_tipo) then
    raise exception 'Só quem foi avaliado pode responder.';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.regras_candidatura()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'INSERT' then
    if not public.eh_sistema() then
      if not exists (select 1 from public.vagas where id = new.vaga_id and status = 'aberta') then
        raise exception 'Esta vaga não está recebendo candidaturas.';
      end if;
      new.status := 'novo';
      new.criado_em := now();
      new.status_em := now();
    end if;
    return new;
  end if;

  if (new.vaga_id, new.profissional_id, new.criado_em) is distinct from (old.vaga_id, old.profissional_id, old.criado_em) then
    raise exception 'Vaga, profissional e data da candidatura não mudam.';
  end if;
  if new.status is distinct from old.status then
    new.status_em := now();
    if not public.eh_sistema() then
      if auth.uid() = old.profissional_id then
        if not (new.status = 'retirada' and old.status in ('novo', 'conversa')) then
          raise exception 'Você só pode retirar uma candidatura em andamento.';
        end if;
      elsif public.eh_dono_vaga(old.vaga_id) then
        if new.status not in ('novo', 'conversa', 'nao') or old.status in ('contratado', 'retirada', 'encerrada') then
          raise exception 'Mudança de status não permitida.';
        end if;
      else
        raise exception 'Sem permissão.';
      end if;
    end if;
  end if;
  -- O conteúdo enviado é do profissional; a empresa só muda o status.
  if not public.eh_sistema() and auth.uid() <> old.profissional_id and
     (new.mensagem, new.respostas_triagem, new.pretensao_valor, new.pretensao_moeda, new.pretensao_periodo, new.curriculo_path)
     is distinct from
     (old.mensagem, old.respostas_triagem, old.pretensao_valor, old.pretensao_moeda, old.pretensao_periodo, old.curriculo_path) then
    raise exception 'A empresa não altera o conteúdo da candidatura.';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.regras_contratacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  lado text;
  outro text;
begin
  if tg_op = 'INSERT' then
    if not public.eh_sistema() then
      lado := public.meu_lado(new.empresa_id, new.profissional_id);
      if lado is null or lado <> new.registrada_por then
        raise exception 'Você só registra contratações em seu próprio nome.';
      end if;
      if exists (select 1 from public.contratacoes where empresa_id = new.empresa_id and profissional_id = new.profissional_id
                 and status in ('aguardando', 'contestado')) then
        raise exception 'Já existe uma contratação aguardando resposta entre vocês.';
      end if;
      -- Só vira vínculo verificado o que começou na plataforma: candidatura, convite ou conversa.
      if not exists (select 1 from public.conversas where empresa_id = new.empresa_id and profissional_id = new.profissional_id)
         and not exists (select 1 from public.convites where empresa_id = new.empresa_id and profissional_id = new.profissional_id)
         and not exists (select 1 from public.candidaturas c join public.vagas v on v.id = c.vaga_id
                         where v.empresa_id = new.empresa_id and c.profissional_id = new.profissional_id) then
        raise exception 'Registre a contratação de alguém com quem você conversou ou que se candidatou pela plataforma.';
      end if;
      new.status := 'aguardando';
      new.confirmada_em := null;
      new.encerrada_em := null;
      new.avaliar_ate := null;
      new.recusa_contestada := false;
    end if;
    return new;
  end if;

  if public.eh_sistema() then return new; end if;
  lado := public.meu_lado(old.empresa_id, old.profissional_id);
  outro := case old.registrada_por when 'empresa' then 'profissional' else 'empresa' end;
  if lado is null then raise exception 'Sem permissão.'; end if;
  if (new.empresa_id, new.profissional_id, new.registrada_por, new.criado_em, new.vaga_id, new.candidatura_id)
     is distinct from (old.empresa_id, old.profissional_id, old.registrada_por, old.criado_em, old.vaga_id, old.candidatura_id) then
    raise exception 'Estes campos da contratação não mudam.';
  end if;
  if new.confirmada_em is distinct from old.confirmada_em or new.avaliar_ate is distinct from old.avaliar_ate then
    raise exception 'Datas de confirmação e de avaliação são do sistema.';
  end if;

  if new.status is distinct from old.status then
    if old.status = 'aguardando' and lado = outro and new.status in ('confirmado', 'contestado', 'recusado') then
      if new.status = 'contestado' and coalesce(btrim(new.contestacao_texto), '') = '' then
        raise exception 'Conte o que está diferente do combinado.';
      end if;
      if new.status = 'confirmado' then new.confirmada_em := now(); end if;
    elsif old.status = 'contestado' and lado = old.registrada_por and new.status = 'aguardando' then
      null;  -- corrigiu o combinado ou respondeu mantendo: volta para o outro lado confirmar
    else
      raise exception 'Mudança de status não permitida.';
    end if;
  end if;

  if (new.funcao, new.tipo, new.moeda, new.valor, new.periodo, new.data_inicio, new.jornada)
     is distinct from (old.funcao, old.tipo, old.moeda, old.valor, old.periodo, old.data_inicio, old.jornada)
     and not (old.status = 'contestado' and lado = old.registrada_por) then
    raise exception 'O combinado só muda quando foi contestado, e por quem o registrou.';
  end if;
  if new.contestacao_texto is distinct from old.contestacao_texto and not (lado = outro and new.status = 'contestado') then
    raise exception 'Só quem confirma pode contestar o combinado.';
  end if;
  if new.resposta_texto is distinct from old.resposta_texto and not (lado = old.registrada_por and old.status = 'contestado') then
    raise exception 'Só quem registrou responde à contestação.';
  end if;
  if new.recusa_contestada is distinct from old.recusa_contestada and
     not (old.status = 'recusado' and lado = old.registrada_por and new.recusa_contestada) then
    raise exception 'Só quem registrou pode contestar a recusa.';
  end if;
  if new.encerrada_em is distinct from old.encerrada_em then
    if old.status <> 'confirmado' or old.encerrada_em is not null then
      raise exception 'Só um vínculo confirmado e ainda ativo pode ser encerrado.';
    end if;
    if new.encerrada_em > current_date or new.encerrada_em < old.data_inicio then
      raise exception 'A data de fim precisa ser entre o início do vínculo e hoje.';
    end if;
    new.avaliar_ate := (new.encerrada_em + 7)::timestamptz + interval '1 day';  -- prazo de 7 dias, até o fim do dia
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.regras_conversa()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  lado text;
begin
  if public.eh_sistema() then return new; end if;
  lado := public.meu_lado(old.empresa_id, old.profissional_id);
  if (new.empresa_id, new.profissional_id, new.criado_em, new.ultima_mensagem_em, new.ultima_mensagem_de)
     is distinct from (old.empresa_id, old.profissional_id, old.criado_em, old.ultima_mensagem_em, old.ultima_mensagem_de) then
    raise exception 'Estes campos da conversa não mudam.';
  end if;
  if (old.compartilhou_empresa and not new.compartilhou_empresa) or (old.compartilhou_profissional and not new.compartilhou_profissional) then
    raise exception 'Contato compartilhado não pode ser retirado da conversa.';
  end if;
  if lado = 'empresa' and (new.compartilhou_profissional, new.lido_profissional_em, new.deu_certo_profissional)
     is distinct from (old.compartilhou_profissional, old.lido_profissional_em, old.deu_certo_profissional) then
    raise exception 'A empresa só altera as próprias marcas da conversa.';
  end if;
  if lado = 'profissional' and (new.compartilhou_empresa, new.lido_empresa_em, new.deu_certo_empresa, new.vaga_id)
     is distinct from (old.compartilhou_empresa, old.lido_empresa_em, old.deu_certo_empresa, old.vaga_id) then
    raise exception 'O profissional só altera as próprias marcas da conversa.';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.regras_convite()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  limite integer;
  usados integer;
begin
  if tg_op = 'INSERT' then
    select coalesce((select limite_convites_mes from public.assinaturas where empresa_id = new.empresa_id), 30) into limite;
    select count(*) into usados from public.convites
      where empresa_id = new.empresa_id and criado_em >= date_trunc('month', now());
    if usados >= limite then
      raise exception 'Você usou os % convites diretos deste mês.', limite;
    end if;
    new.status := 'enviado';
    new.criado_em := now();
    return new;
  end if;
  if not public.eh_sistema() then
    if auth.uid() <> old.profissional_id or new.status not in ('aceito', 'recusado') or
       (new.empresa_id, new.profissional_id, new.vaga_id, new.mensagem, new.criado_em)
       is distinct from (old.empresa_id, old.profissional_id, old.vaga_id, old.mensagem, old.criado_em) then
      raise exception 'Só quem recebeu o convite pode aceitá-lo ou recusá-lo.';
    end if;
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.regras_mensagem()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  c public.conversas;
begin
  select * into c from public.conversas where id = new.conversa_id;
  if not public.eh_sistema() then
    new.autor := auth.uid();
    new.de := public.meu_lado(c.empresa_id, c.profissional_id);
    if new.de is null then raise exception 'Você não participa desta conversa.'; end if;
    new.criado_em := now();
  end if;
  perform public.ligar_sistema(true);
  update public.conversas set
    ultima_mensagem_em = new.criado_em,
    ultima_mensagem_de = new.de,
    lido_empresa_em = case when new.de = 'empresa' then new.criado_em else lido_empresa_em end,
    lido_profissional_em = case when new.de = 'profissional' then new.criado_em else lido_profissional_em end
  where id = new.conversa_id;
  perform public.ligar_sistema(false);
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.regras_vaga()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  a public.assinaturas;
  ativas integer;
begin
  if new.status = 'aberta' and (tg_op = 'INSERT' or old.status is distinct from 'aberta') then
    -- Primeira vaga publicada: começa o período grátis (3 meses).
    insert into public.assinaturas (empresa_id) values (new.empresa_id) on conflict do nothing;
    select * into a from public.assinaturas where empresa_id = new.empresa_id;
    if a.status = 'encerrada' or (a.status = 'gratis' and a.gratis_ate < now()) then
      raise exception 'O período grátis terminou. Escolha um plano para publicar ou reativar vagas.';
    end if;
    select count(*) into ativas from public.vagas
      where empresa_id = new.empresa_id and status = 'aberta' and id <> new.id;
    if ativas >= a.limite_vagas_ativas then
      raise exception 'Seu plano permite % vagas ativas. Pause ou encerre uma vaga para publicar outra.', a.limite_vagas_ativas;
    end if;
    new.publicada_em := coalesce(new.publicada_em, now());
  end if;
  if tg_op = 'UPDATE' then
    if new.empresa_id is distinct from old.empresa_id then
      raise exception 'A vaga não pode mudar de empresa.';
    end if;
    if old.status in ('preenchida', 'cancelada', 'expirada') and new.status is distinct from old.status then
      raise exception 'Vaga encerrada não volta a abrir. Publique uma nova vaga.';
    end if;
    if new.status in ('preenchida', 'cancelada', 'expirada') and old.status is distinct from new.status then
      new.encerrada_em := now();
    end if;
    if not public.eh_sistema() and new.destaque_ate is distinct from old.destaque_ate then
      raise exception 'O destaque é ativado pelo pagamento.';
    end if;
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.tocar_atualizado_em()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.atualizado_em := now();
  return new;
end $function$;

-- Triggers
CREATE TRIGGER ao_criar_usuario AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION criar_conta();
CREATE TRIGGER cron_job_cache_invalidate AFTER INSERT OR DELETE OR UPDATE OR TRUNCATE ON cron.job FOR EACH STATEMENT EXECUTE FUNCTION cron.job_cache_invalidate();
CREATE TRIGGER avaliacoes_auditoria AFTER INSERT OR DELETE OR UPDATE ON public.avaliacoes FOR EACH ROW EXECUTE FUNCTION auditar();
CREATE TRIGGER avaliacoes_notificar AFTER INSERT ON public.avaliacoes FOR EACH ROW EXECUTE FUNCTION notif_avaliacao();
CREATE TRIGGER avaliacoes_regras BEFORE INSERT OR UPDATE ON public.avaliacoes FOR EACH ROW EXECUTE FUNCTION regras_avaliacao();
CREATE TRIGGER candidaturas_notificar AFTER INSERT OR UPDATE ON public.candidaturas FOR EACH ROW EXECUTE FUNCTION notif_candidatura();
CREATE TRIGGER candidaturas_regras BEFORE INSERT OR UPDATE ON public.candidaturas FOR EACH ROW EXECUTE FUNCTION regras_candidatura();
CREATE TRIGGER contratacoes_auditoria AFTER INSERT OR DELETE OR UPDATE ON public.contratacoes FOR EACH ROW EXECUTE FUNCTION auditar();
CREATE TRIGGER contratacoes_efeitos AFTER UPDATE ON public.contratacoes FOR EACH ROW EXECUTE FUNCTION efeitos_contratacao();
CREATE TRIGGER contratacoes_notificar AFTER INSERT OR UPDATE ON public.contratacoes FOR EACH ROW EXECUTE FUNCTION notif_contratacao();
CREATE TRIGGER contratacoes_regras BEFORE INSERT OR UPDATE ON public.contratacoes FOR EACH ROW EXECUTE FUNCTION regras_contratacao();
CREATE TRIGGER conversas_regras BEFORE UPDATE ON public.conversas FOR EACH ROW EXECUTE FUNCTION regras_conversa();
CREATE TRIGGER convites_regras BEFORE INSERT OR UPDATE ON public.convites FOR EACH ROW EXECUTE FUNCTION regras_convite();
CREATE TRIGGER empresas_atualizado BEFORE UPDATE ON public.empresas FOR EACH ROW EXECUTE FUNCTION tocar_atualizado_em();
CREATE TRIGGER empresas_guarda BEFORE UPDATE ON public.empresas FOR EACH ROW EXECUTE FUNCTION guarda_empresa();
CREATE TRIGGER experiencias_guarda BEFORE INSERT OR DELETE OR UPDATE ON public.experiencias FOR EACH ROW EXECUTE FUNCTION guarda_experiencia();
CREATE TRIGGER mensagens_notificar AFTER INSERT ON public.mensagens FOR EACH ROW EXECUTE FUNCTION notif_mensagem();
CREATE TRIGGER mensagens_regras BEFORE INSERT ON public.mensagens FOR EACH ROW EXECUTE FUNCTION regras_mensagem();
CREATE TRIGGER notificacoes_guarda BEFORE UPDATE ON public.notificacoes FOR EACH ROW EXECUTE FUNCTION guarda_notificacao();
CREATE TRIGGER profissionais_atualizado BEFORE UPDATE ON public.profissionais FOR EACH ROW EXECUTE FUNCTION tocar_atualizado_em();
CREATE TRIGGER profissionais_guarda BEFORE UPDATE ON public.profissionais FOR EACH ROW EXECUTE FUNCTION guarda_profissional();
CREATE TRIGGER vagas_atualizado BEFORE UPDATE ON public.vagas FOR EACH ROW EXECUTE FUNCTION tocar_atualizado_em();
CREATE TRIGGER vagas_encerrar AFTER UPDATE ON public.vagas FOR EACH ROW EXECUTE FUNCTION encerrar_candidaturas();
CREATE TRIGGER vagas_regras BEFORE INSERT OR UPDATE ON public.vagas FOR EACH ROW EXECUTE FUNCTION regras_vaga();
CREATE TRIGGER tr_check_filters BEFORE INSERT OR UPDATE ON realtime.subscription FOR EACH ROW EXECUTE FUNCTION realtime.subscription_check_filters();
CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();
CREATE TRIGGER protect_bucket_control_insert BEFORE INSERT ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.protect_bucket_control_columns('service_role');
CREATE TRIGGER protect_bucket_control_update BEFORE UPDATE OF lifecycle_configuration, lifecycle_configuration_generation ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.protect_bucket_control_columns();
CREATE TRIGGER protect_bucket_control_update_role AFTER UPDATE OF lifecycle_configuration, lifecycle_configuration_generation ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_lifecycle_service_role('service_role');
CREATE TRIGGER protect_buckets_delete BEFORE DELETE ON storage.buckets FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();
CREATE TRIGGER protect_objects_delete BEFORE DELETE ON storage.objects FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();
CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();

-- Segurança por linha (RLS) e políticas
alter table "public"."assinaturas" enable row level security;
alter table "public"."auditoria" enable row level security;
alter table "public"."avaliacoes" enable row level security;
alter table "public"."candidaturas" enable row level security;
alter table "public"."contatos" enable row level security;
alter table "public"."contratacoes" enable row level security;
alter table "public"."conversas" enable row level security;
alter table "public"."convites" enable row level security;
alter table "public"."cotacoes" enable row level security;
alter table "public"."denuncias" enable row level security;
alter table "public"."empresa_locais" enable row level security;
alter table "public"."empresas" enable row level security;
alter table "public"."experiencias" enable row level security;
alter table "public"."mensagens" enable row level security;
alter table "public"."notificacao_prefs" enable row level security;
alter table "public"."notificacoes" enable row level security;
alter table "public"."perfis" enable row level security;
alter table "public"."planos" enable row level security;
alter table "public"."profissionais" enable row level security;
alter table "public"."salvos" enable row level security;
alter table "public"."seguindo" enable row level security;
alter table "public"."vagas" enable row level security;
create policy "cron_job_policy" on "cron"."job" as permissive for all to public using ((username = CURRENT_USER));
create policy "cron_job_run_details_policy" on "cron"."job_run_details" as permissive for all to public using ((username = CURRENT_USER));
create policy "assinaturas_ler" on "public"."assinaturas" as permissive for select to authenticated using (eh_dono_empresa(empresa_id));
create policy "avaliacoes_enviar" on "public"."avaliacoes" as permissive for insert to authenticated with check ((EXISTS ( SELECT 1
   FROM contratacoes k
  WHERE (k.id = avaliacoes.contratacao_id))));
create policy "avaliacoes_ler" on "public"."avaliacoes" as permissive for select to anon, authenticated using ((((NOT removida) AND avaliacao_publicada(contratacao_id)) OR (EXISTS ( SELECT 1
   FROM contratacoes k
  WHERE ((k.id = avaliacoes.contratacao_id) AND (meu_lado(k.empresa_id, k.profissional_id) = avaliacoes.autor_tipo))))));
create policy "avaliacoes_responder" on "public"."avaliacoes" as permissive for update to authenticated using ((avaliacao_publicada(contratacao_id) AND (EXISTS ( SELECT 1
   FROM contratacoes k
  WHERE (k.id = avaliacoes.contratacao_id))))) with check ((EXISTS ( SELECT 1
   FROM contratacoes k
  WHERE (k.id = avaliacoes.contratacao_id))));
create policy "candidaturas_editar" on "public"."candidaturas" as permissive for update to authenticated using (((profissional_id = auth.uid()) OR eh_dono_vaga(vaga_id))) with check (((profissional_id = auth.uid()) OR eh_dono_vaga(vaga_id)));
create policy "candidaturas_inserir" on "public"."candidaturas" as permissive for insert to authenticated with check ((profissional_id = auth.uid()));
create policy "candidaturas_ler" on "public"."candidaturas" as permissive for select to authenticated using (((profissional_id = auth.uid()) OR eh_dono_vaga(vaga_id)));
create policy "contatos_dono" on "public"."contatos" as permissive for all to authenticated using ((user_id = auth.uid())) with check ((user_id = auth.uid()));
create policy "contratacoes_editar" on "public"."contratacoes" as permissive for update to authenticated using (((profissional_id = auth.uid()) OR eh_dono_empresa(empresa_id))) with check (((profissional_id = auth.uid()) OR eh_dono_empresa(empresa_id)));
create policy "contratacoes_ler" on "public"."contratacoes" as permissive for select to authenticated using (((profissional_id = auth.uid()) OR eh_dono_empresa(empresa_id)));
create policy "contratacoes_registrar" on "public"."contratacoes" as permissive for insert to authenticated with check (((profissional_id = auth.uid()) OR eh_dono_empresa(empresa_id)));
create policy "conversas_criar" on "public"."conversas" as permissive for insert to authenticated with check (((profissional_id = auth.uid()) OR (eh_dono_empresa(empresa_id) AND (EXISTS ( SELECT 1
   FROM profissionais p
  WHERE ((p.id = conversas.profissional_id) AND (p.visivel OR candidatou_a_mim(p.id))))))));
create policy "conversas_editar" on "public"."conversas" as permissive for update to authenticated using (((profissional_id = auth.uid()) OR eh_dono_empresa(empresa_id))) with check (((profissional_id = auth.uid()) OR eh_dono_empresa(empresa_id)));
create policy "conversas_ler" on "public"."conversas" as permissive for select to authenticated using (((profissional_id = auth.uid()) OR eh_dono_empresa(empresa_id)));
create policy "convites_inserir" on "public"."convites" as permissive for insert to authenticated with check (eh_dono_empresa(empresa_id));
create policy "convites_ler" on "public"."convites" as permissive for select to authenticated using (((profissional_id = auth.uid()) OR eh_dono_empresa(empresa_id)));
create policy "convites_responder" on "public"."convites" as permissive for update to authenticated using ((profissional_id = auth.uid())) with check ((profissional_id = auth.uid()));
create policy "cotacoes_ler" on "public"."cotacoes" as permissive for select to anon, authenticated using (true);
create policy "denuncias_enviar" on "public"."denuncias" as permissive for insert to authenticated with check ((autor = auth.uid()));
create policy "denuncias_ler" on "public"."denuncias" as permissive for select to authenticated using ((autor = auth.uid()));
create policy "empresa_locais_gerir" on "public"."empresa_locais" as permissive for all to authenticated using (eh_dono_empresa(empresa_id)) with check (eh_dono_empresa(empresa_id));
create policy "empresa_locais_ler" on "public"."empresa_locais" as permissive for select to anon, authenticated using (true);
create policy "empresas_editar" on "public"."empresas" as permissive for update to authenticated using ((dono = auth.uid())) with check ((dono = auth.uid()));
create policy "empresas_ler" on "public"."empresas" as permissive for select to anon, authenticated using (true);
create policy "experiencias_apagar" on "public"."experiencias" as permissive for delete to authenticated using ((profissional_id = auth.uid()));
create policy "experiencias_editar" on "public"."experiencias" as permissive for update to authenticated using ((profissional_id = auth.uid())) with check ((profissional_id = auth.uid()));
create policy "experiencias_inserir" on "public"."experiencias" as permissive for insert to authenticated with check ((profissional_id = auth.uid()));
create policy "experiencias_ler" on "public"."experiencias" as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM profissionais p
  WHERE (p.id = experiencias.profissional_id))));
create policy "mensagens_enviar" on "public"."mensagens" as permissive for insert to authenticated with check ((EXISTS ( SELECT 1
   FROM conversas c
  WHERE (c.id = mensagens.conversa_id))));
create policy "mensagens_ler" on "public"."mensagens" as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM conversas c
  WHERE (c.id = mensagens.conversa_id))));
create policy "notificacao_prefs_dono" on "public"."notificacao_prefs" as permissive for all to authenticated using ((user_id = auth.uid())) with check ((user_id = auth.uid()));
create policy "notificacoes_apagar" on "public"."notificacoes" as permissive for delete to authenticated using ((user_id = auth.uid()));
create policy "notificacoes_ler" on "public"."notificacoes" as permissive for select to authenticated using ((user_id = auth.uid()));
create policy "notificacoes_marcar" on "public"."notificacoes" as permissive for update to authenticated using ((user_id = auth.uid())) with check ((user_id = auth.uid()));
create policy "perfis_ler" on "public"."perfis" as permissive for select to authenticated using ((id = auth.uid()));
create policy "planos_ler" on "public"."planos" as permissive for select to anon, authenticated using (ativo);
create policy "profissionais_editar" on "public"."profissionais" as permissive for update to authenticated using ((id = auth.uid())) with check ((id = auth.uid()));
create policy "profissionais_ler" on "public"."profissionais" as permissive for select to authenticated using ((visivel OR (id = auth.uid()) OR candidatou_a_mim(id) OR conversou_comigo(id)));
create policy "salvos_dono" on "public"."salvos" as permissive for all to authenticated using (eh_dono_empresa(empresa_id)) with check (eh_dono_empresa(empresa_id));
create policy "seguindo_dono" on "public"."seguindo" as permissive for all to authenticated using ((profissional_id = auth.uid())) with check ((profissional_id = auth.uid()));
create policy "vagas_apagar_rascunho" on "public"."vagas" as permissive for delete to authenticated using ((eh_dono_empresa(empresa_id) AND (status = 'rascunho'::text)));
create policy "vagas_editar" on "public"."vagas" as permissive for update to authenticated using (eh_dono_empresa(empresa_id)) with check (eh_dono_empresa(empresa_id));
create policy "vagas_inserir" on "public"."vagas" as permissive for insert to authenticated with check (eh_dono_empresa(empresa_id));
create policy "vagas_ler" on "public"."vagas" as permissive for select to anon, authenticated using (((status = 'aberta'::text) OR eh_dono_empresa(empresa_id) OR (EXISTS ( SELECT 1
   FROM candidaturas c
  WHERE ((c.vaga_id = vagas.id) AND (c.profissional_id = auth.uid()))))));
create policy "curriculos_dono" on "storage"."objects" as permissive for all to authenticated using (((bucket_id = 'curriculos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text))) with check (((bucket_id = 'curriculos'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "curriculos_empresa" on "storage"."objects" as permissive for select to authenticated using (((bucket_id = 'curriculos'::text) AND (EXISTS ( SELECT 1
   FROM candidaturas c
  WHERE ((c.curriculo_path = objects.name) AND eh_dono_vaga(c.vaga_id))))));

-- Buckets do Storage (só a configuração; os arquivos não entram)
insert into storage.buckets (id, name, public) values ('curriculos', 'curriculos', false) on conflict (id) do nothing;
