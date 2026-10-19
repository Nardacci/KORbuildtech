# Prompt — Dashboard do Início (1ª versão, Measure Takeoff)

Serve para pedir o dashboard a um agente de código (implementação no app) ou a uma ferramenta de design (visual). A seção "Restrições técnicas" só vale para o agente de código.

```
PAPEL
Você é um designer de produto e engenheiro front-end sênior. Vai criar a tela inicial (dashboard) de um sistema para empresas de construção civil dos EUA (construtoras, prestadoras de serviço e empresas que são as duas coisas). Pense como o GESTOR da empresa que abre o sistema às 7h e precisa decidir em segundos. Texto da tela em português (PT) e inglês (EN) com o mesmo conteúdo.

PRODUTO
KORbuild — 1ª versão, só computador: "Measure Takeoff" (medir plantas em PDF, montar quantidades de material, emitir proposta), "Concorrências" (convites para cotar entre empresas: construtora→prestadora, construtora→construtora, prestadora→prestadora, com propostas e fechamento), e "Settings" (obras, contatos, usuários, perfis de acesso, empresa). Daily, Crew e Cronograma existem mas estão ocultos nesta versão.
Toda empresa usa a mesma tela. Quem entra no sistema por convite fica ligada a quem convidou: quem convidou vê só o trabalho em comum (obra em comum, prazo, propostas), nunca os dados internos da convidada (preços, margens, outros projetos).

OBJETIVO DA TELA
Informações importantes logo de cara, sem poluir: poucos blocos, números grandes, gráficos simples, cada item clicável levando à lista filtrada. Estados vazios que ensinam ("Nenhum projeto ainda. Crie o primeiro") em vez de zeros soltos.

BLOCOS, NESTA ORDEM
0. "Precisa de você agora" (topo, até 4 cartões, por urgência): propostas recebidas prontas para comparar; convites recebidos sem resposta e prazo; rascunhos de concorrência parados; projetos ganhos sem obra criada; perguntas de convidadas sem resposta; cotações de material sem retorno.
1. Projetos por status: rosca com rascunho, em medição, proposta emitida, ganho, perdido (+ contagem de obras em andamento e concluídas). "Fechado" = projeto finalizado.
2. Dinheiro em jogo: valor das propostas abertas, ganho no ano, taxa de acerto, ticket médio, e barras de valor por contratante (mostra dependência de um cliente só).
3. Cotações de material: o relatório "lista para cotação" (materiais na unidade de compra, por fornecedor, sem preço) que o projeto gera. Mostrar listas geradas, fornecedores e projetos sem lista. NÃO inventar "respondidas" nem "menor preço": isso depende de um módulo futuro.
4. Convites enviados e recebidos: barras por situação (proposta, vai cotar, não vai, sem resposta), economia média (menor contra maior proposta) e tempo médio de resposta; recebidos: novos, proposta enviada, ganhos, perdidos.
5. Prazo das obras: por obra, barra do tempo decorrido contra o prazo (datas de início e prazo da obra), marcador "hoje", dias restantes e alerta de atraso. Reservar um espaço "andamento do cronograma: —" para quando o cronograma for ligado. NÃO mostrar valor gasto/custo.
6. Minhas parceiras: empresas que entraram por convite meu, com a obra em comum, dias restantes, propostas e tempo de resposta. Convidada sem conta aparece como "só pelo link".
7. Catálogo e preços: itens sem preço novo há mais de 90 dias e margem média das propostas emitidas.

REGRAS DE VISIBILIDADE (permissões do sistema)
- Projetos, propostas, cotações de material, catálogo e preços: quem tem measure.medir; valores em dinheiro e preços: quem também tem measure.catalogo ou crew.custos.
- Concorrências enviadas, convites e parceiras: quem tem concorrencias.gerir; convites recebidos para responder: concorrencias.responder.
- Obras e prazo: settings.obras ou measure.medir.
- Trabalhador e quem só tem "contatos": Início simples, sem dashboard.
- Cada bloco some sem deixar buraco quando a pessoa não tem a permissão.

VISUAL
Tema escuro como painel executivo: fundo grafite, cartões levemente mais claros, títulos de bloco em etiqueta laranja (#f3813a → #d9621b), números grandes, barras com gradiente laranja, rosca com 5 cores distintas por luminosidade (não só por matiz). Marca KORbuild, fonte Inter. Boa leitura em 1280–1440 px e que se adapte a telas menores (blocos empilham, tabelas rolam na horizontal). Texto com contraste mínimo 4,5:1. Sem emoji, sem gradientes decorativos fora das barras. Gráficos só em SVG e CSS, sem biblioteca.

DADOS (somente o que já existe; não mudar o banco)
Projetos e propostas emitidas do Measure; concorrências, convites, propostas, mensagens e fechamento; obras (início, prazo, situação, contratante, vínculo com a obra de outra empresa); contatos; catálogo, preços (com histórico) e versões de margem. A lista para cotação vem do relatório do projeto. Se um dado não existir, mostrar o estado vazio, nunca um número inventado.

RESTRIÇÕES TÉCNICAS (agente de código)
- JavaScript puro (módulos ES), sem framework e sem biblioteca de gráficos; PWA com service worker (atualizar a lista e a versão do cache em sw.js).
- Reaproveitar o espelho de dados já carregado (js/espelho.js) e os módulos existentes (measure.js, measure-relatorios.js, concorrencias.js, obras.js, prazos.js); calcular tudo no cliente. Nada de migração nem mudança de esquema.
- A tela inicial da 1ª versão está em js/oficial-telas.js (cartões "Measure Takeoff" e "Concorrências"); a flag da versão em js/versao.js (PRIMEIRA_VERSAO). O app completo e o protótipo (?demo) não mudam.
- Textos pelo tr() (js/i18n.js) com as chaves em inglês em js/i18n-en.js; valores em US$, datas e unidades no padrão dos EUA.
- Cada bloco é uma função pura que recebe o estado e devolve HTML; clique leva à rota filtrada (#/measure…, #/concorrencias…, #/conta/obras…).
- Sem inline JS nem estilos injetados (a política de segurança dos testes barra); estilos em css/app.css.

ENTREGA E VERIFICAÇÃO
1) Implemente por blocos pequenos, um commit cada, direto no main. 2) Teste com a massa pv (tools/massa-primeira-versao.mjs; tests/massa-primeira-versao.test.mjs): logins pv.c1.admin (construtora), pv.p1.admin (prestadora), pv.a2.admin (ambas), pv.p1.trabalhador (sem dashboard), pv.p1.contatos (sem dashboard). Números esperados da massa: 12 concorrências (8 abertas, 2 fechadas, 1 rascunho, 1 cancelada), 8 projetos do Measure, 10 empresas. 3) Escreva tests/inicio-primeira-versao.test.mjs conferindo, por login, quais blocos aparecem e os números. 4) Rode as suítes existentes (primeira-versao, producao, seguranca-estatica, ingles, portal, demo) sem regressão. 5) Atualize docs e o checklist de testes (docs/testes/).
```
