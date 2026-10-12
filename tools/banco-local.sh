#!/bin/bash
# KORbuild — testa as migrações num Postgres local que imita o Supabase, sem tocar no banco de verdade.
# Sobe (se preciso) um Postgres 16 em /home/pgl/kb (usuário de sistema "pgl"), recria o banco "kb" e roda, em ordem:
# o simulado do Supabase (papéis, auth.uid(), permissões padrão do public), a estrutura de supabase/backup/,
# os ajustes e as migrações de supabase/migrations/ e os testes de supabase/testes/. Para no primeiro erro.
# Uso (na raiz do projeto, como root): tools/banco-local.sh
set -u
R=$(cd "$(dirname "$0")/.." && pwd)
B=/usr/lib/postgresql/16/bin; P=/home/pgl/kb; PORTA=5499
id pgl >/dev/null 2>&1 || useradd -m pgl
if ! psql -h $P -p $PORTA -U postgres -Atc 'select 1' >/dev/null 2>&1; then
  su pgl -c "mkdir -p $P && ([ -d $P/data ] || $B/initdb -D $P/data -U postgres --auth=trust >/dev/null) && $B/pg_ctl -D $P/data -o '-p $PORTA -k $P' -l $P/log start >/dev/null"
  sleep 2
fi
psql -h $P -p $PORTA -U postgres -q -c "drop database if exists kb" -c "create database kb" >/dev/null 2>&1
TMP=$(mktemp -d)
sed -e 's/^create role \(\w*\) \(.*\);/do $$ begin create role \1 \2; exception when duplicate_object then null; end $$;/' \
    -e 's/alter database postgres/alter database kb/' "$R/supabase/local/supabase-simulado.sql" > "$TMP/simulado.sql"
grep -v -E 'pg_cron|pg_net|supabase_vault|pg_stat_statements|extension if not exists "(pgcrypto|uuid-ossp|plpgsql)"' \
  "$(ls "$R"/supabase/backup/estrutura-*.sql | tail -1)" > "$TMP/estrutura.sql"
Q="psql -h $P -p $PORTA -U postgres -d kb -q -v ON_ERROR_STOP=1"
$Q -f "$TMP/simulado.sql" >/dev/null || exit 1
psql -h $P -p $PORTA -U postgres -d kb -q -f "$TMP/estrutura.sql" >/dev/null 2>&1   # cron/storage não existem aqui: ignorados
cd "$R"
for f in supabase/ajuste-criar-conta.sql supabase/migrations/*.sql supabase/testes/*.sql; do
  out=$($Q -f "$f" 2>&1); rc=$?
  if [ $rc -ne 0 ]; then echo "FALHOU  $f"; echo "$out" | tail -8; rm -rf "$TMP"; exit 1; fi
  echo "ok      $f $(echo "$out" | grep -o 'fatia .*passaram')"
done
rm -rf "$TMP"
