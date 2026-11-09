# Início da 1ª versão: o painel (limpo e objetivo)

**Princípio (08/11/2026):** o Início é limpo e objetivo, feito para apresentar. Só o principal fica à vista; o resto fica recolhido e só aparece quando tem o que mostrar. Nenhum número é calculado duas vezes: cada um vem da mesma função que a tela de origem usa, para o Início, o Gantt e o Daily nunca divergirem.

## O que fica à vista (modelo aprovado em 09/11/2026)
De cima para baixo, o dono do sistema sabe em segundos o que está acontecendo:

| Bloco | O que mostra | Fonte (função única) |
|---|---|---|
| **Faixa de 4 cartões** | Propostas abertas (valor e quantidade) · Ganho no ano · Projetos em aberto (rascunho + medição + proposta) · **Atrasados** (vermelho, com o projeto e os dias). Cada cartão abre a lista. Quem só acompanha o diário vê Diários de hoje, Aguardando aprovação e Com diário atrasado. | `blocoProjetos`, `blocoAndamento`, `resumoDoDaily` |
| **Precisa de você agora** | Uma **linha fina**, só com as pendências (itens que abrem a tela certa). Sem pendência: "Tudo em dia por aqui". | `blocoAcao` em `js/inicio-calculo.js` |
| **Previsto × feito** | Gráfico de linha do projeto em destaque: a curva do previsto (tracejada, do início ao fim do cronograma), a marca de "hoje" e o ponto do feito de hoje. Fora do período, "hoje" fica preso na borda. Sem cronograma: orientação para montar o Schedule. | `curvaPrevista` em `js/andamento.js`; destaque em `projetoEmDestaque` |
| **Andamento dos projetos** | A lista ao lado: situação, barra do feito contra o previsto e, com medição, **Valor: feito de total** e **Horas**. **Clicar na linha troca o projeto do gráfico**; o nome abre o Gantt. | `andamentoDoCronograma` (`js/andamento.js`); valor/horas de `js/valor-cronograma.js` |

**Projeto em destaque:** o de mais dias de atraso; sem atrasado, o de maior valor entre os em dia; senão, o primeiro da lista.

**A curva do feito:** só se conhece o feito de **hoje** (a equipe informa o % no Schedule; não guardamos histórico). Por isso o feito é um ponto, não uma linha.

## O que fica recolhido ("Mais indicadores")
Diário de obra, Dinheiro em jogo (taxa de acerto e ticket médio só com projeto decidido), Projetos por status, cotações de material, concorrências, parceiras, catálogo e preços, prazo das obras. Cada um só entra se tem dado: o bloco que só diria "ainda não há nada" não aparece.

## Como ler o % feito (duas medidas, nomes diferentes)
- **% feito do projeto (barra)**: peso = dias de cada tarefa. Existe para todo projeto com cronograma. Ex.: tarefas de 3, 5 e 4 dias, a de 5 dias a 60% → 25% feito.
- **Valor feito**: peso = quanto cada tarefa vale pela medição do Takeoff. Só existe quando o projeto tem medição ligada às tarefas (as etapas do cronograma batem com as dos itens). É o "Feito até hoje" do Gantt.
- "Andamento" é só a execução da obra. A montagem do orçamento (plantas, escala, medição, proposta) passou a se chamar **Preparo**, para as duas palavras não se confundirem.

## Quem vê o quê
O bloco do Daily e os cartões do diário aparecem para quem pode aprovar ou acompanhar diários (`daily.aprovar` ou `daily.acompanhar`). Dinheiro, catálogo e preços seguem as permissões do Takeoff. Quem só responde convites vê só o que lhe cabe.

## Testes
- `tests/inicio-destaque.test.mjs`: a curva do previsto e a escolha do projeto em destaque (funções puras).
- `tests/inicio-primeira-versao.test.mjs`: o cálculo sozinho (cartões do diário, valor e horas do Gantt, permissões) e o painel por perfil e idioma.
- `tests/fluxo-03-obra-diario-gantt.test.mjs`: **conciliação Início × Daily × cronograma** no banco: antes de aprovar o Início tem 1 diário esperando, igual ao painel do Daily, e o cartão abre o diário; depois de aprovar, zero; o % feito do Início é o do cronograma (25%).


---

## Referência (desenho de 05/11/2026, ainda vale para o cálculo e o layout)

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

## Layout

- **Início em tela cheia:** o painel ocupa a largura toda abaixo do cabeçalho; saudação, os dois botões (**Takeoff** e **Settings**) e o link do manual ficam dentro dele. "Precisa de você agora" tem moldura e fundo laranja próprios.
- **Menu lateral no Settings** (1ª versão): Início, Obras, Contatos, Usuários, Perfis de acesso, Empresa e Meu perfil, como o menu do Takeoff, que ganhou o item **Início** (volta ao painel). No celular o menu vira as abas de antes.

Não há custo gasto nem valor realizado: isso depende do Crew e de lançamentos de custo (fora desta versão).

Teste: `tests/inicio-primeira-versao.test.mjs` (cálculo sozinho e 7 logins da massa pv, em PT e EN).
