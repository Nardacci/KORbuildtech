# Testes por fluxo (decisão do dono, 28/10)

Em vez de testar tela por tela, de forma solta, cada rodada de teste segue um **fluxo de ponta a ponta**, escrito antes, com dados conhecidos, e fica **registrado**: o roteiro (este diretório), o teste automático que o segue passo a passo (`tests/fluxo-NN-*.test.mjs`) e o resultado da rodada (`docs/testes/rodadas/AAAA-MM-DD.md`, gerado pelo teste).

## Como um roteiro é escrito
- **Um arquivo por fluxo**, `FNN-nome.md`. Cabeçalho: objetivo, pré-condições (massa de dados e usuários), onde roda (protótipo `?demo` e/ou conta real local).
- **Passos numerados**, cada um com: *quem* (usuário e perfil), *onde* (tela e rota), *o que faz* (dados de entrada exatos) e *esperado* (o que a tela e o banco devem mostrar). Um passo = uma verificação do teste automático, com o mesmo número.
- **Dados de entrada fixos**, nomeados no roteiro (ex.: projeto "Garagem Pereira", função "Instalador de drywall", valor 38). A massa (`tools/massa-primeira-versao.mjs` + `tools/massa-measure.mjs --conjunto=pv`) é o ponto de partida; o fluxo cria o resto e, na conta real, desfaz no fim.
- **Cada item da lista de checagem** (`lista-checagem-primeira-versao.md`) cita o fluxo que o cobre (coluna *Fluxo*), para a conferência manual seguir a mesma trilha.

## Fluxos
| Fluxo | O quê | Roda em |
|---|---|---|
| F01 | Empresa nova: conta, contatos, funções com valor hora, itens e assemblies | conta real |
| F02 | Projeto do zero até "Liberar para obra": plantas, escala, medição, materiais, cronograma, proposta | protótipo e conta real |
| F03 | Obra: diário com tarefa, aprovação, % feito no Gantt, Início | protótipo e conta real |
| F04 | Concorrência: convite, proposta da prestadora, fechamento, vínculo das obras, diário entre empresas | conta real |
| F05 | Settings: usuários, perfis, listas, preços e margens, auditoria | conta real |
