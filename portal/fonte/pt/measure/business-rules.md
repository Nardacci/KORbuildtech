# Regras de negócio

Cada regra tem um código (`MSR-nnn`) para ser citada em reuniões, testes e pedidos de mudança. A coluna **Situação** diz se a regra já funciona no protótipo.

!!! note "Origem"
    Estas regras vêm do código do protótipo e da especificação do Measure na documentação do projeto. Os pontos em aberto estão marcados como **A confirmar** no fim.

## Unidades e medição

| Código | Regra | Situação |
|---|---|---|
| MSR-001 | **Nada de fração nem de texto na conta.** Comprimentos ficam guardados em polegadas, áreas em polegadas quadradas, volumes em polegadas cúbicas. Pés e polegadas aparecem só na tela. | Funcionando |
| MSR-002 | **Os pontos ficam nas coordenadas da página do PDF**, nunca em pixels da tela. O zoom e a resolução nunca mudam uma medida. | Funcionando |
| MSR-003 | **A escala é da folha.** Vem da lista (escalas de arquitetura e de engenharia) ou da calibração por uma cota conhecida. Cada folha tem a sua escala. | Funcionando |
| MSR-004 | **Conferência da escala:** depois de definir a escala, mede-se outra cota conhecida. Diferença acima de 1% fica marcada. | Funcionando |
| MSR-005 | **A medida é sempre calculada do desenho**, nunca digitada, para toda quantidade poder ser rastreada até a planta. | Funcionando |
| MSR-006 | **Arredondamento só na tela:** pés e polegadas até 1/16", pés quadrados inteiros. O valor guardado não muda. | Funcionando |
| MSR-007 | Entradas aceitas: `12'-6 1/2"`, `12' 6.5"`, `12'6"`, `12'`, `6"`, `150"`, `12.54'`, `12-6`, `12-6-1/2`. Número sem unidade vale como pés. `12'-14"` é recusado (com pés, as polegadas precisam ser menos de 12). | Funcionando |
| MSR-008 | A inclinação do telhado é digitada como `6/12`, `6:12` ou `6`; o fator é √(1 + (6/12)²) = 1,118. | Funcionando |

## Condições

| Código | Regra | Situação |
|---|---|---|
| MSR-010 | Uma **condição** é o que se mede (paredes externas, piso LVP, siding, janelas W1). Tem nome, tipo, cor e propriedades, e medições em uma ou mais folhas. | Funcionando |
| MSR-011 | **Três tipos:** linear (com altura → superfície; com inclinação → comprimento inclinado), área (com inclinação → área do telhado; com espessura → volume) e contagem. | Funcionando |
| MSR-012 | **Vãos:** uma contagem (janela, porta) pode ter largura e altura. Uma parede ou uma área pode **descontar os vãos** das contagens escolhidas, de qualquer folha do projeto. Contar mais uma janela atualiza o OSB, o drywall e o siding. | Funcionando |
| MSR-013 | **Recortar (borracha):** numa área, um polígono desenhado sai do total (escada, chaminé, recorte). | Funcionando |
| MSR-014 | **Vão desenhado:** a ferramenta Vão desenha o retângulo da janela ou da porta, soma 1 na contagem escolhida e recorta a mesma área das áreas que estão por trás. O vão já recortado não é descontado de novo (sem desconto em dobro). Apagar um apaga o outro. | Funcionando |
| MSR-015 | **Condições por folha:** cada folha mostra só as condições incluídas nela. Uma condição pode ser reaproveitada em outra folha; as medições somam no mesmo total. | Funcionando |
| MSR-016 | O desenho **começa vazio**: as condições nascem quando se inclui um assembly do catálogo (ou "Só medir, sem assembly"). | Funcionando |
| MSR-017 | **Mostrar no desenho:** ocultar uma condição é só visual; quantidades e materiais não mudam. | Funcionando |

## Itens, assemblies e fórmulas

| Código | Regra | Situação |
|---|---|---|
| MSR-020 | Um **item** é o que se compra ou se paga, na **unidade de compra** (chapa, caixa, rolo, peça, cu yd, hora), com categoria (material, mão de obra, equipamento, subempreiteiro) e etapa (cost code, CSI MasterFormat). | Funcionando |
| MSR-021 | Um **assembly** é um conjunto de linhas para um tipo de condição. Uma medição alimenta vários itens. | Funcionando |
| MSR-022 | Uma **fórmula** só calcula a quantidade **bruta**. **Perda (%)** e **arredondamento** (nenhum, ou para cima de 1, 0,5 ou 0,25) são colunas próprias, nunca números escondidos na fórmula. | Funcionando |
| MSR-023 | **Variáveis em unidades do ofício**, com os nomes que o orçamentista americano usa: `MeasuredLinear`, `MeasuredArea`, `MeasuredCount`, `WallHeight`, `SurfaceArea`, `NetSurfaceArea`, `NetArea`, `OpeningArea`, `OpeningPerimeter`, `VolumeCY`, `PitchedArea`… | Funcionando |
| MSR-024 | **Fórmulas seguras:** só números, + − × ÷ ^, parênteses, as variáveis do tipo e `ceil floor round min max sqrt abs`. Qualquer outra coisa é recusada ao digitar e ao salvar; as fórmulas nunca são executadas como código. | Funcionando |
| MSR-025 | A fórmula é testada com valores de exemplo ao salvar; divisão por zero e resultado negativo são recusados, e o erro diz a linha. | Funcionando |
| MSR-026 | **Falta de propriedade não quebra a medição:** se um assembly precisa de `SurfaceArea` e a condição não tem altura, a linha vira **pendência** ("Falta na condição: altura"). | Funcionando |
| MSR-027 | O arredondamento é **por linha** (do jeito que cada serviço compra); o total do item soma as linhas. | Funcionando |
| MSR-028 | **Rastro completo:** cada material mostra condição · assembly → fórmula = bruta → + perda → arredondado, com os valores das variáveis. O CSV exportado leva o mesmo rastro. | Funcionando |

## Projetos

| Código | Regra | Situação |
|---|---|---|
| MSR-030 | Nome, cliente, cidade e estado são obrigatórios; estado com 2 letras, ZIP com 5 dígitos (ou 5+4). | Funcionando |
| MSR-031 | **Situação:** Em orçamento → Proposta enviada → Ganha ou Perdida. O prazo da proposta só alerta (vencido, hoje, em até 3 dias) enquanto está Em orçamento. | Funcionando |
| MSR-032 | Excluir um projeto apaga as folhas e as condições dele, depois de confirmar. | Funcionando |
| MSR-033 | Um projeto **ganho** pode criar a obra (Settings › Obras), com o cliente e o endereço preenchidos; projeto e obra ficam ligados. | Funcionando |

## Typicals (o que se repete)

| Código | Regra | Situação |
|---|---|---|
| MSR-040 | Um **typical** tem um nome, uma região da folha (ou a folha inteira) e as **ocorrências**: onde se repete e quantas vezes, contando a que está desenhada (ex.: Bloco A 3 + Bloco B 3 = × 6). | Funcionando |
| MSR-041 | Uma medição pertence ao typical quando o **centro** dela cai dentro da região; ela vale × o total de ocorrências. | Funcionando |
| MSR-042 | A multiplicação vale **em tudo**: totais das condições, vãos, variáveis das fórmulas, materiais, lista para cotação e proposta. | Funcionando |
| MSR-043 | Typicals não se sobrepõem, e o typical da folha inteira não convive com regiões na mesma folha (multiplicaria duas vezes). | Funcionando |
| MSR-044 | Mudar as ocorrências recalcula na hora; excluir o typical faz as medições voltarem a valer uma vez. | Funcionando |

## Cotações e propostas

| Código | Regra | Situação |
|---|---|---|
| MSR-050 | A **lista para cotação** tem só materiais (sem mão de obra), na unidade de compra, com perda e arredondamento, **separada por fornecedor**: cada fornecedor recebe só as etapas que ele fornece (Settings › Contatos). Itens que ninguém fornece vão para "Sem fornecedor". | Funcionando |
| MSR-051 | O fornecedor nunca vê preço de venda, mão de obra nem fórmula. | Funcionando |
| MSR-052 | Os preços que um fornecedor devolve podem ser registrados na lista; viram o preço do item a partir daquela data, com a origem "Cotação · fornecedor". | Funcionando |
| MSR-053 | **Preços têm vigência:** um preço novo vale a partir de uma data; os antigos ficam no histórico. A proposta usa o preço vigente no dia. | Funcionando |
| MSR-054 | **Margens têm vigência:** overhead % sobre o custo; lucro em **markup** (% sobre custo + overhead) ou em **margem** (% do preço de venda); imposto sobre material (uma configuração; 0 no exemplo de New Hampshire). | Funcionando |
| MSR-055 | **Preço calculado da linha** = (materiais × (1 + imposto) + mão de obra + outros) × (1 + overhead), depois + lucro (markup: × (1 + lucro); margem: ÷ (1 − lucro)). | Funcionando |
| MSR-056 | A proposta tem **uma linha por etapa**, material e mão de obra juntos. Qualquer preço de linha pode ser digitado no lugar do calculado; apagar volta ao calculado. Linhas podem ficar de fora, e outros itens (mobilização, caçamba…) podem ser incluídos. | Funcionando |
| MSR-057 | **Emitir** exige um contratante, pelo menos uma linha e preço em todas as linhas incluídas. A proposta emitida ganha um **número** (`P-AAAA-NNN`) e fica **congelada**: mudanças depois não afetam o que foi enviado. Cada emissão é uma versão nova. | Funcionando |
| MSR-058 | Emitir muda o projeto de Em orçamento para **Proposta enviada**. | Funcionando |
| MSR-059 | O documento da proposta mostra só o preço de cada linha: **custo, overhead e lucro nunca vão para o cliente**; ficam guardados na versão emitida, para consulta interna. | Funcionando |

!!! confirm "A confirmar"
    - Se o cliente vê as quantidades de material na proposta por padrão (hoje: uma opção em cada proposta).
    - Mudar a situação do projeto e registrar os preços dos fornecedores pelo celular.
    - Atrair o clique para as linhas dos PDFs vetoriais, para mais precisão.
