# Início da 1ª versão: o painel

O Início da conta (`#/conta`) deixa de ser dois cartões com botão e passa a mostrar o que importa a quem gerencia a empresa. Só dados que já existem; **nenhuma mudança no banco**.

- Quem vê: quem tem `measure.medir`, `concorrencias.gerir` ou `concorrencias.responder` (administrador, gestor, orçamentista). Trabalhador e "só contatos" continuam com o Início simples.
- Cálculo: `js/inicio-calculo.js` (funções puras, testadas sozinhas). Desenho: `js/inicio-dashboard.js` (SVG e CSS, sem biblioteca). Ligação: `htmlInicio()` em `js/oficial-telas.js` e `desenhar()` em `js/app.js` (carrega o espelho do banco ao abrir o Início e relê no máximo uma vez por minuto).

| Bloco | De onde vem | Quem vê |
| --- | --- | --- |
| Precisa de você agora | propostas recebidas, convites sem resposta (e os que vencem em 3 dias), rascunhos parados há mais de 7 dias, cotações sem retorno, projetos ganhos sem obra | cada cartão segue a permissão do assunto |
| Projetos por status | rascunho (sem medição), em medição, proposta emitida, ganho, perdido, derivados da situação, das medições e das propostas; obras em andamento e concluídas | `measure.medir` |
| Dinheiro em jogo | última proposta de cada projeto: abertas, ganho no ano, taxa de acerto, ticket médio, valor por contratante | quem vê dinheiro no Measure (`measure.catalogo` ou `crew.custos`) |
| Cotações de material | `cotacao.envios` e `cotacao.respostas` do projeto (e-mail preparado e preço recebido por fornecedor) | `measure.medir` |
| Concorrências | enviadas e recebidas por situação, economia média (proposta vencedora contra a mais cara), tempo médio de resposta | gerir (enviadas) e responder (recebidas) |
| Prazo das obras | início e prazo da obra: tempo decorrido, dias restantes, atraso. **Andamento do cronograma fica "—"** até o cronograma ser ligado | `settings.obras` ou `measure.medir` |
| Minhas parceiras | empresas que convidei para cotar: obra em comum (a minha), propostas, tempo de resposta, dias restantes da **minha** obra; sem conta aparece "só pelo link" | `concorrencias.gerir` |
| Catálogo e preços | itens sem preço novo há mais de 90 dias; margem vigente (overhead + lucro) | `measure.medir` (margem: quem vê dinheiro) |

Não há custo gasto nem valor realizado: isso depende do Crew e de lançamentos de custo (fora desta versão).

Teste: `tests/inicio-primeira-versao.test.mjs` (cálculo sozinho e 7 logins da massa pv, em PT e EN).
