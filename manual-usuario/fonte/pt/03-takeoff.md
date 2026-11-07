# Takeoff: da planta à proposta

O Takeoff leva um projeto de ponta a ponta: **itens e assemblies** (o catálogo de preços), **projeto**, **plantas**, **escala**, **medição**, **materiais**, **cronograma**, **proposta** e **liberação para a obra**. O cartão **Visão geral** do projeto conta os passos ("5 de 6 passos") e diz o que falta.

## O catálogo: itens e assemblies

Um **item** é um material ou uma hora de mão de obra, com código, unidade e preço. Um **assembly** é uma receita: junta itens com fórmulas. Por exemplo, "Drywall, walls" usa uma chapa a cada 32 sq ft de parede e uma hora de mão de obra a cada 50 sq ft.

Para criar um item, abra **Itens › Novo item**. Escolha a categoria:

- **Material:** você digita o preço (e o histórico de preços fica guardado, com a data de cada um).
- **Mão de obra:** escolha a **função**. O preço vem do valor da hora da função (veja o capítulo anterior) e o campo de preço some.

![Novo item](img:item-novo)

A aba **Preços** do item mostra o preço de hoje e o histórico.

![Item: preços](img:item-precos)

Os **assemblies** ficam em **Assemblies**.

![Assemblies](img:assemblies)

Abra um assembly para ver as linhas. Cada linha tem o item, a **fórmula** (por exemplo `MeasuredArea / 32`, a área medida dividida por 32) e a **perda** em porcentagem.

![Assembly: linhas e fórmulas](img:assembly-editor)

## Criar o projeto

Em **Projetos › Novo projeto**, informe o nome, o cliente (escolhido nos Contatos), a cidade e o estado. Toque em **Continuar para as plantas**.

![Novo projeto](img:projeto-novo)

## Enviar as plantas

Na aba **Plantas**, envie o PDF. Cada página vira uma **folha** do projeto.

![Plantas: enviar](img:plantas-vazio)

![Plantas enviadas](img:plantas)

## Definir e conferir a escala

Antes de medir, cada folha precisa de **escala**. Abra a folha, toque em **Escala** e escolha a escala indicada na própria planta (por exemplo 1/4" = 1'-0").

![Definir a escala da folha](img:escala)

Depois **confira**: marque duas pontas de uma cota que a planta já traz (por exemplo 40'-0") e informe o valor real. O sistema compara e mostra o erro. Só com a escala conferida a medição é confiável.

![Conferir a escala numa cota](img:escala-conferir)

## Medir

Com a escala conferida, use **Incluir assembly** para criar uma **condição** (por exemplo "Piso da garagem") ligada a um assembly e depois meça no desenho. Para uma área, clique nos cantos e feche no primeiro ponto (ou dê duplo clique). O painel da esquerda mostra a medição e o assembly aplicado.

![Incluir um assembly no desenho](img:takeoff-assembly)

![Takeoff: medição no desenho](img:takeoff)

Outras ferramentas na barra: **Mover**, **Recortar**, **Vão** (aberturas, como portas e janelas), **Typical** (folhas que se repetem).

## Materiais e mão de obra

A aba **Materiais** mostra o que as medições pedem: cada material com a quantidade e o rastro do cálculo, e a **mão de obra estimada** em horas. As quantidades são arredondadas para cima.

![Materiais e mão de obra](img:materiais)

## Cronograma

Na aba **Cronograma**, adicione as tarefas com **início** e **duração em dias**; o término é calculado. Em **quem faz**, diga se é a sua equipe ou uma prestadora.

![Cronograma](img:cronograma)

O **Gantt** do projeto desenha essas tarefas e, depois que o Daily começa, mostra o andamento (veja o próximo capítulo).

## Visão geral do projeto

A Visão geral lista os passos e o que falta. Com tudo pronto, o cartão **Obra** libera o botão **Liberar para obra**.

![Visão geral do projeto](img:projeto-visao)

## Proposta

Na aba **Proposta**, o sistema monta uma linha por etapa: custo (material + mão de obra) com **overhead** e **lucro** aplicados. Confira e toque em **Emitir**. A proposta recebe um número (P-AAAA-NNN) e fica guardada.

![Proposta](img:proposta)

A proposta é opcional para liberar a obra.

## Liberar para obra

Na Visão geral, confira o campo **Início da obra** (vem com a data de hoje) e toque em **Liberar para obra**.

![Liberar para obra](img:liberar)

O projeto vira uma obra no **Daily**. O cartão passa a mostrar **Liberado para obra**, quem liberou e o botão **Abrir no Daily**. Você ainda pode mudar a data de início depois, e a obra acompanha. Se precisar rever o orçamento, use **Voltar para análise**: a obra sai do Daily até você liberar de novo.

![Projeto liberado para obra](img:liberado)

> **Depois que o projeto já tem diário,** o botão **Voltar para análise** some: já existe obra andando.
