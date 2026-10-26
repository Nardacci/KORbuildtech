# Prompt para a sessão local: aplicar a migração 0017 no Supabase real

O dono autorizou ("pode aplicar 0017"): `supabase/migrations/20261027_0017_folha_observacao.sql`.
Só adiciona `folhas.observacao` (text, padrão '', máx. 500 caracteres); não muda políticas nem apaga dados.

1. `git pull origin main`. Leia o arquivo e confirme que é só isso.
2. Aplique no banco real, pelo mesmo caminho da 0016.
3. Confira: `select column_name from information_schema.columns where table_name = 'folhas' and column_name = 'observacao';` → 1 linha.
4. Só depois, publique o app (`PERSISTE_OBS_FOLHA = true`, service worker `korbuild-v118`). Publicar antes da migração faz o envio de plantas falhar por coluna inexistente. Se a produção usa `node tools/gerar-producao.mjs`, rode também.
5. Teste de fumaça na conta real: abrir um projeto → Plans → escrever uma observação numa folha → recarregar: continua.
6. Relate o que foi aplicado, o resultado do passo 3 e do passo 5. Se algo falhar, não corrija às cegas.
