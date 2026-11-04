# Testes por fluxo (decisão do dono, 28/10)

Em vez de testar tela por tela, de forma solta, cada rodada de teste segue um **fluxo de ponta a ponta**, escrito antes, com dados conhecidos, e fica **registrado**: o roteiro (este diretório), o teste automático que o segue passo a passo (`tests/fluxo-NN-*.test.mjs`) e o resultado da rodada (`docs/testes/rodadas/AAAA-MM-DD.md`, gerado pelo teste).

## Como um roteiro é escrito
- **Um arquivo por fluxo**, `FNN-nome.md`. Cabeçalho: objetivo, pré-condições (massa de dados e usuários), onde roda (protótipo `?demo` e/ou conta real local).
- **Passos numerados**, cada um com: *quem* (usuário e perfil), *onde* (tela e rota), *o que faz* (dados de entrada exatos) e *esperado* (o que a tela e o banco devem mostrar). Um passo = uma verificação do teste automático, com o mesmo número.
- **Dados de entrada fixos**, nomeados no roteiro (ex.: projeto "Garagem Pereira", função "Instalador de drywall", valor 38). A massa (`tools/massa-primeira-versao.mjs` + `tools/massa-measure.mjs --conjunto=pv`) é o ponto de partida; o fluxo cria o resto e, na conta real, desfaz no fim.
- **Cada item da lista de checagem** (`lista-checagem-primeira-versao.md`) cita o fluxo que o cobre (coluna *Fluxo*), para a conferência manual seguir a mesma trilha.

## Fluxos
| Fluxo | O quê | Roteiro | Teste | Roda em |
|---|---|---|---|---|
| F01 | Empresa nova: primeira entrada, empresa, perfis, funções com valor hora, cliente, itens e assembly | `F01-empresa-nova.md` | `tests/fluxo-01-empresa-nova.test.mjs` | conta real (o passo 1 entra pela tela de login só com `--real`) |
| F02 | Projeto do zero até "Liberar para obra": plantas, escala, medição, materiais, cronograma, proposta, início da obra | `F02-projeto-ate-liberar.md` | `tests/fluxo-02-projeto-ate-liberar.test.mjs` | conta real |
| F03 | Obra: diário com tarefa, aprovação, % feito no Gantt, Início | `F03-obra-diario-gantt.md` | `tests/fluxo-03-obra-diario-gantt.test.mjs` | conta real |
| F04 | Concorrência: convite, proposta da prestadora, fechamento, vínculo das obras, diário entre empresas | (a escrever) | (a escrever; reaproveita `concorrencias-oficial`) | conta real |
| F05 | Settings: usuários, perfis, listas, preços e margens, auditoria | (a escrever) | (a escrever) | conta real |

## Como rodar
"Conta real" tem dois ambientes, com o mesmo teste e o mesmo roteiro:
- **Banco local de teste** (nuvem de desenvolvimento): `python3 -m http.server 8123 &`, `bash tools/supabase-local.sh` e `node tests/fluxo-NN-….test.mjs --relatorio`. Não tem o serviço de login: as pessoas entram com a sessão já gravada.
- **Supabase de verdade** (o do `js/config.js`): servidor em `:8123`, `$env:SUPABASE_ACCESS_TOKEN = "sbp_…"` (token novo da conta, apagado depois) e `node tests/fluxo-NN-….test.mjs --real --relatorio`. Cria uma empresa marcada `plano.massa = 'fluxo'` e logins `fluxo.*@example.com` e apaga tudo no fim; os dados reais não são tocados. Nenhum e-mail sai.
- **Antes de rodar no Supabase de verdade**, confira o esquema: `psql $env:KOR_DESTINO_URL -f tools\conferir-esquema.sql` (só lê; nenhuma linha = o banco tem as migrações 0016 a 0025). Foi o que faltou para a 0018 passar despercebida.
- Cada rodada grava o registro em `docs/testes/rodadas/AAAA-MM-DD_HH-MM_FNN.md`.
