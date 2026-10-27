# Prompt para a sessão local: aplicar a migração 0019 no Supabase real

Só rodar depois que o dono escrever "pode aplicar 0019". Arquivo: `supabase/pendentes/20261028_0019_fechar_sem_obra.sql` (mover para `supabase/migrations/` junto).
Só redefine a função `fechar_concorrencia`: deixa de exigir `projetos.obra_id` ao fechar uma concorrência vinda de projeto ganho. Não muda tabela, política nem dados.

1. `git pull origin main`. Leia o arquivo e confirme que é só isso.
2. Aplique no banco real, pelo mesmo caminho das anteriores.
3. Confira: `select prosrc like '%0019%' from pg_proc where proname = 'fechar_concorrencia';` → true.
4. Teste de fumaça na conta real: um projeto ganho SEM obra, com concorrência aberta e uma proposta recebida → Fechar → fecha sem pedir a obra; a vencedora vê "Você venceu".
5. Relate o que foi aplicado e o resultado dos passos 3 e 4. Se algo falhar, não corrija às cegas.
