# Prompt para a sessão local: aplicar a migração 0024 no Supabase real

Só rodar depois que o dono escrever "pode aplicar 0024". Arquivo: `supabase/migrations/20261102_0024_projetos_do_daily.sql`.
O que ela faz: cria a função `public.projetos_do_daily()` (security definer). Ela devolve, só para quem tem permissão do Daily (preencher, acompanhar ou aprovar), os projetos já liberados para obra e que têm obra na própria empresa: id, nome, obra, cidade, estado, liberação e as tarefas do cronograma (id, nome, quem, início, dias, %). Motivo: o encarregado não tem permissão de Takeoff, e a política de `projetos` bloqueava a leitura; ele via "Seus projetos" vazio. Revoga de public e anon, concede a authenticated. Não cria tabela, não altera nem apaga dado.

1. `git pull origin main`. Leia o arquivo e confirme que é só isso.
2. Aplique no banco real pelo mesmo caminho das anteriores (0016–0023).
3. Confira: `select count(*) from pg_proc where proname = 'projetos_do_daily';` → 1. Depois `notify pgrst, 'reload schema';` se a API não enxergar a função.
4. Só depois publique o app em homologação (service worker `korbuild-v149`). O app tolera a função ausente (lista vazia), então não quebra se a ordem inverter. Hostinger continua manual e fora desta etapa.
5. Relate o que foi aplicado e os resultados. Se algo falhar, não corrija às cegas.
