# Prompt para a sessão local: aplicar a migração 0026 e publicar a função `criar-usuario` (projeto novo, qudyyewfrtfimbytahkv)

Só rodar depois que o dono escrever "pode aplicar 0026". Arquivo: `supabase/migrations/20261105_0026_usuario_direto.sql`; função de borda: `supabase/functions/criar-usuario/index.ts`.
O que faz: o administrador da empresa cadastra a pessoa direto, com senha provisória, sem convite. A migração cria três funções (`preparar_usuario_direto`, `finalizar_usuario_direto` e `preparar_nova_senha`): quem pode é sempre o banco (permissão `settings.acesso`); a finalização só o `service_role` executa. A função de borda cria o login (precisa da chave de serviço, que fica só no servidor). Não apaga nem altera dado existente.

1. `git pull origin main`. Leia a migração e a função e confirme que é só isso.
2. Aplique a migração no banco do projeto novo, pelo PowerShell do dono, com o endereço já definido na janela. **Antes, `$env:PGCLIENTENCODING = "UTF8"`** (sem isso o `psql` do Windows grava os acentos quebrados dentro das funções: foi o que o F05 `--real` mostrou em 05/11). Depois: `psql $env:KOR_DESTINO_URL -f supabase\migrations\20261105_0026_usuario_direto.sql` (tem que responder BEGIN, CREATE FUNCTION ×3, REVOKE, GRANT ×3 e COMMIT).
3. Confira: `psql $env:KOR_DESTINO_URL -f tools\conferir-esquema.sql` → nenhuma linha. Depois `notify pgrst, 'reload schema';`.
4. Publique a função **com verificação de JWT** (o padrão; NÃO use `--no-verify-jwt`, é o contrário das outras): `$env:SUPABASE_ACCESS_TOKEN = "token da conta NOVA"` e `npx supabase functions deploy criar-usuario --project-ref qudyyewfrtfimbytahkv --use-api`. Depois apague o token (`Remove-Item Env:SUPABASE_ACCESS_TOKEN`).
5. Só depois publique o app (service worker `korbuild-v160`). Publicar antes faz "Novo usuário" falhar (a função ainda não existe).
6. Teste no Supabase de verdade: `node tests/fluxo-05-settings.test.mjs --real --relatorio` (o passo 8 cadastra o Heitor, entra com a senha provisória, é obrigado a trocá-la). Relate os resultados. Se algo falhar, não corrija às cegas.
