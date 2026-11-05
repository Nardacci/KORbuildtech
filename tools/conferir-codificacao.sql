-- KORbuild — procura texto com acento quebrado ("jÃ¡" em vez de "já") nas funções do banco e em alguns cadastros.
-- Causa típica: migração aplicada com o psql do Windows SEM `$env:PGCLIENTENCODING = "UTF8"` (ele lê o arquivo em WIN1252 e grava os acentos já quebrados).
-- Só lê. Uso:  $env:PGCLIENTENCODING = "UTF8"; psql $env:KOR_DESTINO_URL -f tools\conferir-codificacao.sql
-- Nenhuma linha = tudo certo. O padrão é a letra "Ã" seguida de um símbolo de 0xA1 a 0xBF (assinatura de UTF-8 lido como Latin-1); "AÇÃO" e "NÃO" em maiúsculas não contam.
\encoding UTF8
select 'função' as onde, p.proname::text as nome
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.prosrc ~ (chr(195) || '[' || chr(161) || '-' || chr(191) || ']')
union all
select 'perfil de acesso', pa.nome || ' · ' || pa.descricao
  from public.perfis_acesso pa where (pa.nome || pa.descricao) ~ (chr(195) || '[' || chr(161) || '-' || chr(191) || ']')
union all
select 'função de trabalho', f.nome from public.funcoes f where f.nome ~ (chr(195) || '[' || chr(161) || '-' || chr(191) || ']')
order by 1, 2;
