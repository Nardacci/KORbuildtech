# Prompt para a sessão local: aplicar a migração 0021 no Supabase real

Só rodar depois que o dono escrever "pode aplicar 0021". Arquivo: `supabase/migrations/20261029_0021_rdo_tarefa_do_projeto.sql`.
O que ela faz: reescreve só a função `aprovar_rdo`. Além das etapas de obra (como hoje), cada atividade do diário que aponta uma tarefa do cronograma do projeto (`tarefaId` + `tarefaPct`) atualiza o % feito dessa tarefa em `projetos.cronograma` e guarda o avanço (data, antes, pct, nº do RDO, quem aprovou). Não cria tabela, não muda coluna, não apaga nem altera dado existente; o app já está preparado e não precisa de chave nova.

1. `git pull origin main`. Leia o arquivo e confirme que é só isso.
2. Aplique no banco real pelo mesmo caminho das anteriores (0016–0020).
3. Confira: `select count(*) from pg_proc where proname = 'aprovar_rdo' and prosrc like '%tarefaId%';` → 1.
4. Relate o que foi aplicado e o resultado. Se algo falhar, não corrija às cegas.
