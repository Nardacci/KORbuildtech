# Prompt para a sessão local: aplicar a migração 0016 no Supabase real

O dono digitou **"pode aplicar"** para a migração `supabase/migrations/20261026_0016_projeto_espaco.sql`
(colunas `projetos.entrega`, `projetos.cronograma` e `concorrencia_desenhos.observacao`; só adiciona colunas, não muda políticas nem apaga dados).

1. `git pull` em `main`.
2. Aplicar o arquivo no banco real (mesmo caminho das migrações 0001–0015) e conferir:
   `select column_name from information_schema.columns where table_name in ('projetos','concorrencia_desenhos') and column_name in ('entrega','cronograma','observacao');` → 3 linhas.
3. Publicar o app (o código já grava `entrega`/`cronograma`, `PERSISTE_ESPACO = true`, sw `korbuild-v110`).
4. Aproveitar para refazer o deploy da função `enviar-avisos` (e-mails em inglês revisados).
5. Teste de fumaça: abrir um projeto → aba Scope & delivery → mudar "We subcontract it all" → recarregar: continua.

Importante: aplicar a migração **antes** de publicar o app; senão salvar projeto falha por coluna inexistente.
