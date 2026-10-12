#!/bin/bash
# KORbuild — "Supabase local" para testar o app oficial sem rede (tests/_supabase-local.mjs, tests/daily-local.test.mjs).
# Recria o banco local com todas as migrações e testes (tools/banco-local.sh) e sobe o PostgREST na porta 3001,
# com o mesmo segredo de JWT dos testes. Baixa o PostgREST (binário único) na primeira vez.
set -e
R=$(cd "$(dirname "$0")/.." && pwd)
"$R/tools/banco-local.sh"
P=/home/pgl/kb
psql -h $P -p 5499 -U postgres -d kb -q -c "do \$\$ begin create role authenticator login noinherit; exception when duplicate_object then null; end \$\$; grant anon, authenticated, service_role to authenticator;"
D=${POSTGREST_DIR:-/opt/postgrest}
if [ ! -x "$D/postgrest" ]; then
  mkdir -p "$D" && curl -sSL -o "$D/p.tar.xz" https://github.com/PostgREST/postgrest/releases/download/v12.2.3/postgrest-v12.2.3-linux-static-x64.tar.xz && tar xJf "$D/p.tar.xz" -C "$D"
fi
cat > "$D/kb.conf" <<CONF
db-uri = "postgres://authenticator@/kb?host=$P&port=5499"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "segredo-local-de-teste-com-mais-de-32-caracteres"
jwt-aud = "authenticated"
server-port = 3001
CONF
pkill -f "[p]ostgrest $D/kb.conf" || true
for i in $(seq 1 20); do curl -s -o /dev/null http://localhost:3001/ || break; sleep 0.5; done   # espera a porta ficar livre
setsid "$D/postgrest" "$D/kb.conf" > "$D/log.txt" 2>&1 < /dev/null &
for i in $(seq 1 20); do curl -s -o /dev/null http://localhost:3001/ && break; sleep 0.5; done
echo "PostgREST em http://localhost:3001 (log: $D/log.txt)"
