-- KORbuild — confere se o banco tem o que as migrações 0016 a 0025 criam. SÓ LÊ: não altera nada.
-- Uso (PowerShell, com o endereço do banco na variável):  psql $env:KOR_DESTINO_URL -f tools\conferir-esquema.sql
-- Mostra só o que FALTA, com a migração que cria. Nenhuma linha = o banco tem tudo isto.
-- Motivo (03/11): a 0018 (itens.ativo) estava "autorizada" e o app já a usava, mas nunca chegou ao banco: toda gravação de item pela tela falhava.
-- Quando uma migração nova criar coluna, tabela, função ou gatilho, acrescente aqui.

with colunas(migracao, tabela, coluna) as (values
  ('0016', 'projetos', 'entrega'), ('0016', 'projetos', 'cronograma'),
  ('0017', 'folhas', 'observacao'),
  ('0018', 'itens', 'ativo'),
  ('0020', 'projetos', 'execucao'), ('0020', 'obras', 'projeto_id'),
  ('0022', 'projetos', 'liberado_em'), ('0022', 'projetos', 'liberado_por'),
  ('0023', 'itens', 'funcao_id'),
  ('0025', 'projetos', 'inicio_obra')),
funcoes(migracao, funcao) as (values
  ('0019', 'fechar_concorrencia'),
  ('0020', 'obra_do_projeto'), ('0020', 'nome_livre_de_obra'),
  ('0021', 'aprovar_rdo'),
  ('0023', 'semear_funcoes'), ('0023', 'semear_funcoes_da_empresa'),
  ('0024', 'projetos_do_daily')),
tabelas(migracao, tabela) as (values ('0023', 'funcoes'), ('0023', 'funcao_valores')),
gatilhos(migracao, gatilho, tabela) as (values ('0020', 'projetos_obra', 'projetos'), ('0023', 'empresas_semear_funcoes', 'empresas'))
select migracao, 'coluna ' || tabela || '.' || coluna as falta
  from colunas c where not exists (select 1 from information_schema.columns i where i.table_schema = 'public' and i.table_name = c.tabela and i.column_name = c.coluna)
union all
select migracao, 'função ' || funcao
  from funcoes f where not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = f.funcao)
union all
select migracao, 'tabela ' || tabela
  from tabelas t where not exists (select 1 from information_schema.tables i where i.table_schema = 'public' and i.table_name = t.tabela)
union all
select migracao, 'gatilho ' || gatilho || ' em ' || tabela
  from gatilhos g where not exists (select 1 from pg_trigger t join pg_class k on k.oid = t.tgrelid join pg_namespace n on n.oid = k.relnamespace where not t.tgisinternal and n.nspname = 'public' and k.relname = g.tabela and t.tgname = g.gatilho)
union all
select '0019', 'função fechar_concorrencia ainda exige a obra (a 0019 não foi aplicada)'
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'fechar_concorrencia' and p.prosrc like '%Crie a obra a partir do projeto%'
order by 1, 2;
