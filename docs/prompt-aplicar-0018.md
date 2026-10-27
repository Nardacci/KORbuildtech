# Prompt para a sessão local: aplicar a migração 0018 no Supabase real

O dono autorizou ("pode aplicar o 0018"): `supabase/migrations/20261028_0018_item_ativo.sql`.
Só adiciona `itens.ativo` (boolean, not null, padrão true); não muda políticas nem apaga dados. Item nunca é apagado: fica inativo.

1. `git pull origin main`. Leia o arquivo e confirme que é só isso.
2. Aplique no banco real, pelo mesmo caminho da 0016 e da 0017.
3. Confira: `select column_name, column_default from information_schema.columns where table_name = 'itens' and column_name = 'ativo';` → 1 linha, padrão `true`.
4. Só depois, publique o app (`PERSISTE_ATIVO_ITEM = true` já está no código, service worker `korbuild-v139`). Publicar antes da migração faz a gravação de itens falhar por coluna inexistente. Se a produção usa `node tools/gerar-producao.mjs`, rode também.
5. Teste de fumaça na conta real: Takeoff › Itens › abrir um item › Deixar inativo → recarregar: continua inativo (filtro Inativos); Reativar → volta à lista. Importar uma planilha com a coluna Active = No num item existente também deve deixá-lo inativo.
6. Relate o que foi aplicado, o resultado do passo 3 e do passo 5. Se algo falhar, não corrija às cegas.
