# Itens e preços (Takeoff)

Decisões do dono (27/10): itens e preços numa tela só; histórico de preços; filtros; importar e exportar (Excel e CSV); item **nunca é excluído** (ativo ou inativo); preço desatualizado = mais de **12 meses**; markups na tela de Itens; preço por fornecedor fica para um módulo financeiro, mais adiante.

## Tela única: Itens
- **Lista:** código, item, categoria, cost code, unidade de compra, preço atual, desde quando e situação (Em dia, Desatualizado, Sem preço, Inativo). Busca por nome/código e filtros de categoria, cost code e situação, com contadores. Por padrão só os ativos.
- **Markups:** cartão no topo (overhead, lucro, imposto sobre material), com versões e histórico, como antes na tela Preços. O menu **Pricing** deixou de existir (o endereço antigo `#/measure/precos` abre Itens).
- **Página do item** (abas): **Details** (campos do item e, ao criar, preço inicial opcional), **Pricing** (preço atual, botão Novo preço e histórico com variação % sobre o anterior, origem, fornecedor e quem registrou, mais um gráfico), **Used in** (assemblies que usam o item).
- **Ativo/inativo:** não há exclusão. Inativo some da lista padrão e dos assemblies novos; o histórico de preços fica. Na conta com banco, o botão só funciona depois da migração **0018** (`itens.ativo`, em `supabase/pendentes/`, não aplicada).
- **Preços:** nunca são apagados; um preço novo vale a partir de uma data e a proposta usa o que vale no dia em que é emitida. As respostas de cotação de fornecedores continuam entrando no histórico (origem "Cotação · fornecedor").

## Importar e exportar
- **Exportar** (botão na tela de Itens): Excel (`Items - AAAA-MM-DD.xlsx`, aba *Items* com o preço atual e aba *Price history* com todo o histórico) ou CSV (só os itens, UTF-8 com BOM, separado por vírgula).
- **Importar** (quem edita o catálogo): baixe o modelo (Excel, com a aba *How to fill*), preencha e envie `.xlsx` ou `.csv` (vírgula, ponto e vírgula ou tab). Antes de gravar aparece a **conferência**: itens novos, alterados, preços novos e linhas com erro (com o número da linha). Só grava depois de Importar; as linhas com erro são puladas.
- **Casamento:** pelo código; sem código, pelo nome. Em item existente só muda o que veio preenchido e diferente.
- **Preço:** um preço diferente do atual vira um **preço novo** com a data da coluna *Price valid from* (vazia = hoje) e origem *Price source* (vazia = "Importado"). O histórico nunca é sobrescrito nem apagado. Datas aceitas: AAAA-MM-DD ou mm/dd/aaaa.
- **Active:** Yes/No deixa o item ativo/inativo; nunca exclui. Na conta com banco a coluna é ignorada até a migração 0018.
- Código: `js/itens-planilha.js` (ExcelJS vendorizado, carregado só na hora). Teste: `tests/itens.test.mjs`.
