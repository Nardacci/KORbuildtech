# Funções com valor hora padrão (decisão do dono, 28/10)

**A função** (Carpinteiro, Eletricista, Servente…) é um cadastro da empresa em **Settings › Funções**, com o **valor hora padrão** com vigência (cada valor vale a partir de uma data, com motivo, e nunca apaga o anterior). É a base do custo de mão de obra do orçamento: o **Takeoff** usa o valor da função; o **Crew** (custo real) continua usando o valor hora de cada funcionário, que tem o dele.

- **Custo da hora** = valor hora padrão × (1 + encargos vigentes). Autônomo não entra aqui: encargos são da folha.
- **Item de mão de obra do catálogo** pode apontar a função (campo *Função* no cadastro do item, só para a categoria Mão de obra). Com função, o preço da hora **vem da função** (valor + encargos) e a aba Preços do item mostra isso, sem "Novo preço"; sem função, o item continua com o preço digitado, como antes.
- **Funcionário** aponta a função pelo nome (lista das funções ativas). Renomear a função leva o nome junto nos funcionários.
- **Inativar** tira a função das listas; o histórico fica. Não se apaga.
- **Permissão:** quem tem `settings.funcionarios` ou `measure.catalogo` cadastra e registra valor; todos da empresa leem os nomes; os valores quem cuida de funcionários, vê custos ou monta orçamento.
- **1ª versão:** a aba Funções fica visível no Settings (ao lado de Contatos), porque o Takeoff precisa dela.

## Onde está
- Modelo e telas compartilhadas: `js/funcoes.js` (protótipo grava em `estado().funcoes`; a lista antiga de nomes `settings.funcoes` vira cadastro na primeira leitura).
- Protótipo: `js/settings-telas.js` (rotas `#/settings/funcoes`, `#/settings/funcao/nova`, `#/settings/funcao/:id[/editar]`).
- Conta com banco: `js/cadastros.js` (`funcoesCad`, `salvarFuncaoCad`, `novoValorDaFuncaoCad`) e `js/cadastros-telas.js` (`#/conta/funcoes…`); o espelho (`js/espelho-crew.js`) traz `funcoes` + `funcao_valores` para o Takeoff.
- Preço da mão de obra: `precoEm` em `js/precos.js`; item: `funcaoId` (`js/measure.js`, `js/itens-telas.js`).
- Banco: migração **0023** (`funcoes`, `funcao_valores`, `itens.funcao_id`, dez funções padrão por empresa); teste `supabase/testes/0015_funcoes.sql`. No app, `PERSISTE_FUNCAO` (`js/measure-oficial.js`) está ligado desde que a migração entrou (28/10).

## Próximo (Gantt físico-financeiro, fatia 1)
O valor de cada tarefa do cronograma = material + horas por função × custo da hora da função.
