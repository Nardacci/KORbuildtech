# Migrar o banco KORbuild Tech para a conta nova do Supabase

> **Concluído em 02/11/2026.** O projeto novo é `qudyyewfrtfimbytahkv`; o antigo (`gbdmtgephszxhaprpiss`) foi excluído no mesmo dia, por ser só dado de teste e por custo. Este guia fica como referência para a próxima migração.

**Objetivo:** copiar o projeto "KORbuild Tech" (conta antiga, região us-west-2) para um projeto novo, na conta nova, sem perder dados, logins nem arquivos. O banco antigo **não é alterado** em nenhum momento: se algo der errado, ele continua funcionando.

**Tamanho hoje (levantado em 02/11):** 22 empresas, 84 usuários, 16 projetos, 137 RDOs, 3.949 batidas de ponto, 503 arquivos (430 de diários, 57 de concorrências, 16 de plantas) e 36 MB de banco. A cópia leva poucos minutos.

## O que é copiado e como

| Parte | Como |
|---|---|
| Tabelas, funções, políticas de acesso, gatilhos e dados (`public`) | `backup` e `restaurar` |
| Logins dos usuários (e-mail, senha criptografada) | `backup` e `restaurar`. Ninguém precisa refazer a senha. |
| Buckets, regras de acesso aos arquivos, tempo real das notificações | `backup` e `restaurar` |
| Os 503 arquivos (fotos de diário, plantas, desenhos de concorrência) | `arquivos` |
| Jobs de aviso (cron) e o segredo deles | `cron` |
| Funções do servidor (`enviar-avisos`, `diario-publico`, `convite-publico`) | Passo 7, publicar de novo |
| Segredos (SMTP, CRON_SECRET), e-mails do Auth, endereços permitidos | **Passo 8, à mão no painel** (o Supabase não deixa copiar segredos) |

## Antes de começar

1. **Combine uma janela:** a partir do backup, o que for gravado no banco antigo não vai para o novo. Faça no fim do dia, avise a equipe e não use o app até o passo 10.
2. **Pré-requisito no Windows:** o cliente do PostgreSQL **17** (`pg_dump` e `psql`). No PowerShell: `winget install PostgreSQL.PostgreSQL.17`. No instalador, marque só "Command Line Tools". Depois feche e abra o PowerShell e confira com `pg_dump --version` (tem que mostrar 17 ou maior). O Node você já tem.

## Passo a passo

### 1. Criar o projeto novo (na conta nova)
No painel do Supabase da conta nova: **New project**, nome **KORbuild Tech**, **região us-west-2 (Oregon)**, a mesma do antigo. Anote a senha do banco que você escolher. Deixe o projeto **vazio**: não rode nenhuma migração nele.

### 2. Pegar os endereços de conexão
Em cada projeto (antigo e novo): botão **Connect** (no alto da tela) → **Session pooler** → copie o endereço `postgresql://postgres.CODIGO:[YOUR-PASSWORD]@…pooler.supabase.com:5432/postgres`. Use o *Session pooler* (e não o "Direct"), porque o direto só funciona com IPv6 e muitos computadores não têm.

### 3. Pegar as chaves de arquivos
Em cada projeto: **Project Settings → API Keys → service_role (secret)**. Copie (clique em revelar). É a chave mais poderosa do projeto: nunca cole no chat, no código ou no GitHub.

### 4. Variáveis (só na janela do PowerShell, somem ao fechar)
Substitua os valores entre aspas. Não deixe `[YOUR-PASSWORD]` no endereço.

```powershell
cd C:\p\korbuildtech
git pull origin main
$env:KOR_ORIGEM_URL  = "postgresql://postgres.CODIGOANTIGO:SENHAANTIGA@...pooler.supabase.com:5432/postgres"
$env:KOR_DESTINO_URL = "postgresql://postgres.CODIGONOVO:SENHANOVA@...pooler.supabase.com:5432/postgres"
```

Se a senha tiver caracteres como `@`, `#` ou `/`, troque pelo código dela (`@` = `%40`, `#` = `%23`, `/` = `%2F`) ou crie uma senha só de letras e números no painel.

### 5. Backup (só lê o banco antigo)
```powershell
node tools/migrar-supabase.mjs backup
```
Cria `backups\AAAA-MM-DD_HHMM\` com tudo. **Guarde essa pasta num lugar seguro e não suba para o GitHub** (a pasta já está no `.gitignore`): ela tem os logins dos usuários.

### 6. Restaurar no banco novo
```powershell
node tools/migrar-supabase.mjs restaurar
node tools/migrar-supabase.mjs conferir
```
O `restaurar` recusa se o banco novo não estiver vazio. Mensagens como "already exists" são normais. O `conferir` lista, tabela por tabela, as linhas do antigo e do novo. **Tem que terminar com "Tudo bate".** Se mostrar `DIFER`, pare e me mande a tela (sem endereços nem senhas).

Se o `conferir` mostrar só `auth.identities` diferente (o restante da cópia foi feito por outro caminho, como o DBeaver), copie essa tabela direto do antigo:
```powershell
node tools/migrar-supabase.mjs identidades
```

Depois os arquivos:
```powershell
$env:KOR_ORIGEM_SERVICE_KEY  = "chave service_role do ANTIGO"
$env:KOR_DESTINO_SERVICE_KEY = "chave service_role do NOVO"
node tools/migrar-supabase.mjs arquivos
node tools/migrar-supabase.mjs conferir
```
Se der falha em alguns arquivos, rode `arquivos` de novo: ele só repete o que falta.

### 6b. Conferir o esquema (migrações)
```powershell
psql $env:KOR_DESTINO_URL -f tools\conferir-esquema.sql
```
Só lê. **Nenhuma linha** significa que o banco tem tudo o que as migrações 0016 a 0025 criam. Se listar algo, aplique a migração indicada antes de seguir. (Na migração real, a 0018 faltava e só apareceu no teste F01.)

### 7. Funções do servidor
Precisa do token de acesso da conta nova (painel → avatar → Access Tokens → Generate), só nesta janela:
```powershell
$env:SUPABASE_ACCESS_TOKEN = "token da conta NOVA"
npx supabase functions deploy enviar-avisos   --project-ref CODIGONOVO --no-verify-jwt --use-api
npx supabase functions deploy diario-publico  --project-ref CODIGONOVO --no-verify-jwt --use-api
npx supabase functions deploy convite-publico --project-ref CODIGONOVO --no-verify-jwt --use-api
```

### 8. Segredos e configurações do Auth (à mão, no painel do projeto novo)
- **Edge Functions → Secrets:** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`, `CRON_SECRET` (invente um valor longo novo), e `SITE_URL` se vocês usavam. Os valores antigos estão no painel antigo (menos senhas, que você tem de onde criou).
- **Authentication → URL Configuration:** Site URL e Redirect URLs iguais aos do projeto antigo (o app em homologação e em produção).
- **Authentication → Email Templates:** cole os três modelos de `supabase/email/` (confirmação, recuperar senha, troca de e-mail) e o remetente/SMTP, como no antigo.
- **Authentication → Providers:** confira se e-mail/senha está ligado e as opções de confirmação iguais às do antigo.

Depois, os avisos automáticos (usa o mesmo `CRON_SECRET` do passo anterior):
```powershell
$env:KOR_CRON_SECRET = "o mesmo valor do CRON_SECRET"
node tools/migrar-supabase.mjs cron
```

### 9. Aplicar a 0024 no banco novo
O banco novo tem tudo até a 0023. Falta a `supabase/migrations/20261102_0024_projetos_do_daily.sql`: cole no **SQL Editor** do projeto novo e rode.

### 10. Trocar o app para o projeto novo
Em `js/config.js`, troque `SUPABASE_URL` (para `https://CODIGONOVO.supabase.co`) e a chave pública (**Project Settings → API Keys → anon / publishable**, essa é pública por desenho). Peça para eu fazer essa troca, o teste e a nova versão do app. Só depois publique.

Como o projeto novo tem outra chave de assinatura, **todo mundo vai ter que entrar de novo** (a senha continua a mesma). É esperado.

### 11. Conferir como usuário
Entre no app com um administrador e com um encarregado: conferir empresas, um projeto, as fotos de um RDO, as plantas e a lista "Seus projetos" do Daily. Rode também a homologação automática contra o projeto novo.

### 12. Só depois de tudo conferido
Mantenha o projeto antigo **pausado** (não apagado) por pelo menos 30 dias. Não apague antes de ter certeza.

## Se algo der errado
- O banco antigo nunca foi alterado: basta continuar usando o app como estava (`js/config.js` antigo).
- Para recomeçar a restauração: no projeto novo, **Project Settings → General → Delete project**, crie outro vazio e repita do passo 1. (O `restaurar` não sobrescreve banco que já tem dados.)
- Erro "pg_dump não encontrado": volte ao pré-requisito. Erro de versão: instale o PostgreSQL 17 ou maior.
- Erro de conexão: confirme que usou o **Session pooler** e que a senha não tem caracteres especiais sem código.
