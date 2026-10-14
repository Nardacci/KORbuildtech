# Segurança do KORbuild

O que protegemos, como cada proteção é testada e o que o teste de segurança já achou. A regra de fundo: **o navegador nunca é confiável**. Tudo o que importa (quem vê o quê, quem muda o plano, quem aprova) é imposto no banco (RLS, privilégios, gatilhos e funções `SECURITY DEFINER`) e conferido por testes que atacam como um usuário de verdade.

## O que é protegido

| Risco | Proteção | Onde é testado |
|---|---|---|
| Uma empresa ver ou mexer nos dados de outra | RLS em todas as tabelas; função `minha_empresa()`; vínculos entre empresas só por função | `0011_seguranca.sql` (catálogo e ataques), `seguranca.test.mjs` §3 (47 tabelas, leitura, PATCH, DELETE, INSERT em nome do vizinho, `select` embutido), testes de cada fatia |
| Administrador da empresa subir o próprio plano, módulos ou atuação | Só as colunas de perfil da empresa são atualizáveis (`grant update (colunas)`); plano e módulos mudam por `admin_*` | `0011` §2, `seguranca.test.mjs` §4 |
| Alguém virar administrador da plataforma | `admins_plataforma` e `admin_log` sem escrita para usuários; todas as `admin_*` começam por `admin_exigir()` | `0011` (chama cada `admin_*` como usuário comum), `seguranca.test.mjs` §4 |
| Quem não entrou (anon) ler ou chamar algo | Nenhum privilégio de tabela para `anon`; só `diario_por_codigo()` (link do diário aprovado) fica aberta | `0011` §1, `seguranca.test.mjs` §1 |
| Token falso ou adulterado | O Supabase confere a assinatura; o teste prova que dono trocado, `alg none`, papel `service_role` escrito à mão e token vazio são recusados | `seguranca.test.mjs` §2 |
| Modo sistema (pula as travas dos registros) ao alcance de usuário | `ligar_sistema()` fechada para `authenticated` e `anon`; funções de gatilho fechadas para todos | `0011` §1 |
| Função `SECURITY DEFINER` sequestrada por `search_path` | Todas fixam `search_path` | `0011` §1, `seguranca-estatica.test.mjs` §6 |
| Fotos e plantas de outra empresa, upload de arquivo perigoso | Buckets privados com política por pasta da empresa, limite de tamanho e lista de tipos | `0011` §1, `seguranca.test.mjs` §6 (só `--real`) |
| E-mails disparados por estranhos | `enviar-avisos` exige o segredo do cron (comparação em tempo constante, vazio recusado); fila de e-mails sem escrita para usuários | `seguranca-estatica` §5, `seguranca.test.mjs` §6b e §4 |
| Injeção (SQL, filtros do REST, código do link) | Parâmetros sempre por função/REST (nunca texto montado); formato exato do código e do token antes de tocar no banco | `seguranca.test.mjs` §5, §6b |
| XSS armazenado | Todo texto de usuário passa por `esc()` antes de virar HTML | `seguranca-xss.test.mjs` (16 telas, duas empresas, com o texto malicioso gravado de verdade) |
| Segredo no repositório | `.gitignore`, varredura de padrões, só a chave pública no navegador | `seguranca-estatica.test.mjs` §1 e §2 |
| Dados de empresa guardados no aparelho | O service worker não guarda nada da API | `seguranca-estatica.test.mjs` §3 |
| Configuração do Auth fraca | Confirmação de e-mail, sem login anônimo, senha mínima de 8, rotação do token | `seguranca.test.mjs` §7 (só `--real`) |

## Como rodar

```powershell
.\tools\testar.ps1 -Parte prototipo                 # inclui seguranca-estatica (sem token)
.\tools\testar.ps1 -Parte banco -Somente seguranca  # 0011 (SQL), seguranca (API/Storage/Auth) e seguranca-xss (navegador)
tools/banco-local.sh                                # local: roda o 0011 junto com os outros testes SQL
node tests/seguranca.test.mjs                       # local (depois de tools/supabase-local.sh)
node tests/seguranca-xss.test.mjs http://localhost:8123/
```

Os testes que escrevem (`seguranca`, `seguranca-xss`) criam só usuários `kb-e2e-daily-…@example.com` com **senha aleatória a cada execução** e os apagam no fim. Nas empresas da massa de demonstração o teste só **lê**.

## Achados e correções (rodada de 22/10/2026, migração 0013)

| # | Gravidade | Achado | Correção |
|---|---|---|---|
| 1 | **Alta** | O administrador de qualquer empresa conseguia mudar o **próprio plano** (Enterprise, limites 9999), os módulos e a atuação da empresa, com uma chamada comum ao REST (a coluna estava liberada na tabela `empresas`). Empresa suspensa ou com teste vencido também podia se reativar. | Migração 0013: `grant update` só nas colunas de perfil; plano, módulos e atuação só por `admin_*`/`criar_empresa` |
| 2 | Média | `ligar_sistema()` (liga o "modo sistema", que pula as travas de `notificacoes`) executável por qualquer pessoa, inclusive sem login. Sem um caminho conhecido de abuso em um único pedido, mas é uma chave mestra à vista. | 0013: fechada para `anon`/`authenticated` (e todas as funções de gatilho) |
| 3 | Média | `anon` com todos os privilégios em 8 tabelas e `authenticated` com `TRUNCATE`/`REFERENCES`/`TRIGGER` em todas (`TRUNCATE` passa por cima da RLS; o REST não o expõe, mas não precisa existir). | 0013: privilégios retirados e `default privileges` ajustados para tabelas e funções novas |
| 4 | Média | Funções de apoio (`minha_empresa`, `tenho_permissao`, `eh_admin_plataforma`…) abertas para `anon`. | 0013: só `authenticated` e `service_role` |
| 5 | Baixa | `convite-publico` devolvia a mensagem de erro interna do Postgres/Storage a quem chamava. | Só as mensagens escritas de propósito (`raise exception`, código P0001) chegam; o resto vira "servidor" e fica no log da função (**precisa publicar a função de novo**) |
| 6 | Baixa | Bucket legado `curriculos` sem limite de tamanho nem de tipo (sem política de acesso: ninguém de fora o alcança). | 0013: 5 MB e PDF/imagens |
| 7 | Baixa | Senhas dos usuários de teste fixas no repositório. | Aleatórias a cada execução |
| 8 | Baixa | O e-mail pessoal do dono do projeto estava em `docs/banco.md`. | Removido; a varredura estática agora barra |

## Ainda em aberto (decisões, não falhas)

- **Content-Security-Policy:** as páginas não têm CSP. O `esc()` está correto em todas as telas testadas, mas a CSP seguraria o estrago se uma tela futura esquecer. Exige um ajuste fino (o app usa estilos e scripts inline em alguns pontos); proposta: modo `Report-Only` primeiro.
- **Limite de tentativas no `diario-publico`:** o código do link tem 48 bits (inviável de adivinhar), mas só o `convite-publico` limita as tentativas por minuto. Vale o mesmo limite por IP.
- **CORS `*` nas funções públicas:** serve ao link público; depois do lançamento dá para limitar ao endereço do app.
- **Pagamento e dados de cartão:** quando entrar, fica 100% no provedor (nunca no nosso banco); cada função de cobrança ganha teste aqui.
- **Rotina periódica:** repetir `testar.ps1 -Parte banco -Somente seguranca` a cada migração nova e antes de cada lançamento.
