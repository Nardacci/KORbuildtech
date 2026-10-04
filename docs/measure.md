# KORbuild Measure — documentação do módulo (protótipo, fatias 1 e 2)

> **O que é:** o módulo de medição de plantas (*takeoff*) e, depois, de estimativa da plataforma KORbuild.
>
> **Relacionados:**
> - [`measure-especificacao-0.1.md`](measure-especificacao-0.1.md): o conceito;
> - [`measure-revisao.md`](measure-revisao.md): a revisão técnica e as decisões;
> - [`settings.md`](settings.md): permissões.
>
> **Mercado:** EUA, unidades imperiais. **Só no computador:** medir planta exige mouse e tela grande.

## 1. Onde estamos

O desenvolvimento é em fatias finas: o canvas e o motor de cálculo andam juntos (revisão §2.1).

| Fatia | Conteúdo | Situação |
| --- | --- | --- |
| **1** | Tradutor imperial; abrir o PDF no navegador; escala da lista ou por calibração, mais a conferência; condições (linear, área, contagem) com propriedades; medição no canvas; quantidades | **Feita** |
| **2** | Catálogo de itens, assemblies e fórmulas (mathjs restrito), perda e arredondamento como campos, quantidades de material e mão de obra com o cálculo à vista, CSV | **Feita** |
| 3 | Preços com vigência, estimativa (material, mão de obra, equipamento, subempreiteiro, overhead, lucro com markup **e** margem), snapshot | Próxima |
| 4 | Ligações: horas estimadas por etapa → orçamento de mão de obra do Crew; quantidades → avanço físico no Daily | — |

## 2. Regras de unidade e geometria (implementadas)

| # | Regra | Onde |
| --- | --- | --- |
| MZ-01 | **Nada de fração nem de texto para calcular.** Guardado: polegadas (comprimento), polegadas² (área), polegadas³ (volume) | `js/imperial.js` |
| MZ-02 | **Os pontos ficam em coordenadas da página do PDF** (points, 1/72" do papel), nunca em pixels. Zoom e resolução não mudam a medida | `js/measure.js` |
| MZ-03 | **A escala é da folha:** polegadas reais por point. Vem da lista (arquitetônica e de engenharia) ou da calibração por uma cota | `definirEscala` |
| MZ-04 | **Conferência:** depois de definir a escala, mede-se outra cota conhecida. Diferença acima de 1% fica marcada | `registrarConferencia` |
| MZ-05 | **Condição ≠ medições:** a condição (nome, tipo, cor, propriedades) tem medições em uma ou mais folhas | `condicoes[].medicoes[]` |
| MZ-06 | **Três geometrias e propriedades:** linear (+ altura → superfície; + inclinação → linear inclinado), área (+ inclinação → área do telhado; + espessura → volume) e contagem | `totaisDaCondicao` |
| MZ-07 | **Desconto:** uma área pode ser desenhada como desconto (vão, recorte) e é subtraída | `desconto: true` |
| MZ-08 | **Arredondamento só na tela:** ft-in para 1/16" e sq ft inteiro; o valor guardado não muda | `formatarPesPolegadas` |
| MZ-09 | **A medida é sempre calculada da geometria**, nunca digitada (RB-003, rastreável até a planta) | — |

**Entradas aceitas** (`interpretarComprimento`): `12'-6 1/2"`, `12' 6.5"`, `12'6"`, `12'`, `6"`, `6 1/2"`, `1/2"`, `150"`, `12.54'`, `12ft 6in`, `12-6`, `12-6-1/2`. Número sem unidade vale como pés.

**Recusadas:** `12'-14"` (com pés, as polegadas devem ser menores que 12), fração com zero embaixo e texto sem medida.

**Inclinação:** `6/12`, `6:12` ou `6`. O fator é √(1 + (6/12)²) = 1,118.

## 2b. Itens, assemblies e fórmulas (fatia 2)

```
condição medida ──► variáveis (lin ft, sq ft, cu yd…) ──► assembly: uma linha por item
                                                           fórmula → bruta → + perda % → arredondamento → quantidade
```

| # | Regra | Onde |
| --- | --- | --- |
| MZ-10 | **Item** é o que se compra ou se paga, na **unidade de compra** (chapa, caixa, rolo, peça, cu yd, hora), com categoria (material, mão de obra, equipamento, subempreiteiro) e etapa/cost code (CSI MasterFormat) | `itens` |
| MZ-11 | **Assembly** é um conjunto de linhas para um tipo de condição. Uma medição alimenta vários itens: a parede gera montantes, guias, OSB, house wrap, isolamento, drywall e horas | `assemblies` |
| MZ-12 | **Fórmula** só calcula a quantidade **bruta**. **Perda (%)** e **arredondamento** (não arredondar, ou para cima de 1, 0,5 ou 0,25) são colunas próprias, nunca números escondidos na fórmula (RB-004) | `calcularLinha` |
| MZ-13 | **Variáveis em unidades do ofício**, com nomes em inglês (o vocabulário do estimador americano): `MeasuredLinear`, `MeasuredArea`, `MeasuredCount`, `WallHeight`, `SurfaceArea`, `Thickness`, `VolumeCF`, `VolumeCY`, `RoofPitch`, `PitchFactor`, `PitchedArea`, `PitchedLinear` | `VARIAVEIS` |
| MZ-14 | **Motor seguro:** mathjs com as funções perigosas desligadas e uma **lista branca**: números, + − × ÷ ^, parênteses, as variáveis do tipo e `ceil floor round min max sqrt abs`. Recusa atribuição, função nova, unidade ("5 ft"), texto, matriz, condicional e variável de outro tipo. Nunca `eval()` | `js/formulas.js` |
| MZ-15 | **Validação ao salvar:** a fórmula é testada com valores de exemplo do tipo; divisão por zero e resultado negativo são recusados, e o erro diz a linha | `validar` |
| MZ-16 | **Falta de propriedade não quebra:** se a condição não tem altura e o assembly usa `SurfaceArea`, a linha vira **pendência** ("Falta na condição: SurfaceArea (altura)") | `quantidadesDoProjeto` |
| MZ-17 | **Arredondamento por linha** (como a compra de cada serviço); o total do item soma as linhas | `porItem` |
| MZ-18 | **Rastro completo:** condição · assembly → fórmula = bruta → +perda = com perda → arredondado, com os valores das variáveis | tela e CSV |
| MZ-19 | **Vãos:** uma contagem (janela, porta) pode ter **largura e altura do vão**. Ela gera `OpeningWidth`, `OpeningHeight`, `OpeningArea` (quantidade × largura × altura) e `OpeningPerimeter` (2 × (largura + altura) × quantidade), usados em guarnição, flashing e J-channel | `variaveisDaCondicao` |
| MZ-20 | **Desconto de vãos ligado:** a parede (linear) e o siding (área) escolhem quais contagens descontar ("Descontar os vãos de"). Isso gera `OpeningCount`, `OpeningArea`, `OpeningPerimeter`, `NetSurfaceArea` (parede) e `NetArea` (área). Contar mais uma janela já muda o OSB, o drywall e o siding | `vaosLigados` |
| MZ-21 | **Cada desenho é medido onde ele aparece:** paredes e piso na planta; siding (inclusive a empena) e janelas/portas na fachada; alturas, frost wall e inclinação no corte. Cada folha tem a sua escala | folhas |
| MZ-22 | **Cadastro do projeto:** nome, cliente, cidade e estado são obrigatórios; estado com 2 letras, ZIP com 5 dígitos (ou 5+4). O estado vem preenchido com NH (só sugestão; nada amarra o sistema a um estado) e o estimador com quem está cadastrando | `salvarProjeto` |
| MZ-23 | **Situação do projeto:** Em orçamento → Proposta enviada → Ganha ou Perdida. O prazo da proposta (*bid due date*) só alerta (vencido, hoje, em até 3 dias) enquanto está **Em orçamento** | `SITUACOES`, lista |
| MZ-24 | **Excluir um projeto** apaga as folhas e as condições (com as medições) dele, depois de confirmar | `excluirProjeto` |
| MZ-25 | **Cor da condição:** quem cria ou edita a condição escolhe a cor (paleta sugerida ou "Outra", qualquer cor). As marcações dela no desenho, no painel e na tabela de quantidades usam essa cor. Condição nova sem escolha pega uma cor da paleta ainda não usada no projeto | `salvarCondicao` |
| MZ-27 | **O desenho começa vazio:** nenhuma condição pronta. No visor, **Incluir assembly** abre o catálogo agrupado por tipo (linear, área, contagem), com o resumo de cada um e a marca "já no desenho". Escolhido o assembly, a pessoa confirma o nome no desenho, a cor e as medidas (altura, espessura, vão, vãos a descontar); a condição nasce com o assembly aplicado e já ativa para medir. "Só medir, sem assembly" cria uma condição sem materiais (o assembly pode ser aplicado depois) | `dialogoIncluir` |
| MZ-28 | **Recortar (borracha):** ferramenta da barra, só para condição de área. Desenha um polígono que **sai do total** da condição (escada, chaminé, recorte). Aparece hachurado em vermelho, com "− X sq ft", e na lista como "Recorte" | `finalizar` |
| MZ-29 | **Vão desenhado:** a ferramenta **Vão** desenha o retângulo da janela ou porta (dois cantos opostos) e pergunta qual é. Ela **conta +1** nessa contagem, que gera os materiais do vão (janela, flashing, guarnição), e **recorta a mesma área** das condições de área escolhidas. A tela já marca as áreas que estão por trás do vão nesta folha. O recorte usa a **medida desenhada**; a contagem continua dando o tamanho cadastrado para as paredes da planta | `adicionarVao` |
| MZ-30 | **Sem desconto em dobro:** se a área também tem essa contagem em "Descontar os vãos de", o vão que já a recortou não é descontado de novo pelo tamanho cadastrado. Os vãos desenhados entram em `OpeningCount` e `OpeningPerimeter` (J-channel) com a medida desenhada. Apagar a contagem ou o recorte de um vão apaga os dois | `vaosLigados`, `vaosDesenhados`, `excluirMedicao` |
| MZ-31 | **Condições por folha:** cada folha mostra só as condições incluídas nela (o que é incluído na fachada não aparece no corte). O painel mostra o total **desta folha** | `condicoesDaFolha` |
| MZ-32 | **Reaproveitar em outra folha:** no "Incluir assembly", a seção "Já medido em outras folhas" traz a mesma condição para a folha aberta (ex.: paredes do 1º e do 2º pavimento). As medições somam no mesmo total; o cartão mostra "Também em A-101 · projeto: X". **Tirar desta folha** apaga só as medições daqui. Excluir apaga em todas | `incluirNaFolha`, `tirarDaFolha` |
| MZ-33 | **Vãos entre folhas:** "Descontar os vãos de" lista as contagens do projeto inteiro, com a folha (a parede medida na planta desconta as janelas contadas na fachada). A ferramenta Vão também oferece contagens de outras folhas, e a janela passa a aparecer na folha onde foi desenhada | `dialogoCondicao`, `adicionarVao` |
| MZ-26 | **Mostrar no desenho:** cada condição tem uma caixa ao lado do nome. Desmarcada, as marcações dela somem da planta (em todas as folhas) e o cartão fica apagado, com a etiqueta "oculta". É só visual: as quantidades e os materiais não mudam, e o clique não gruda em ponto oculto. Fica guardado na condição (continua oculta ao reabrir). "Mostrar todas" e "Ocultar todas" no topo do painel | `mostrarCondicao` |

**Exemplo** (Paredes externas medidas com 135,87 lin ft, altura 9'):
- SurfaceArea = 1.222,83 sq ft;
- OSB: `SurfaceArea / 32` = 38,21 → +10% = 42,03 → para cima: **43 chapas**.

**Dados de exemplo:** 28 itens (wood framing residencial) e 8 assemblies:
- parede externa 2x6 @ 16" (descontando vãos);
- piso LVP com manta;
- laje de concreto com tela;
- porta interna 30";
- janelas W1 e W2 instaladas;
- porta de entrada instalada;
- siding vinil com J-channel.

As condições prontas incluem Janelas W1, Janelas W2, Porta de entrada D1 e Siding (fachadas). **Coberturas, produtividades e perdas são exemplos para a demonstração, não referência de mercado.**

## 3. Telas

| Tela | Rota | O que faz |
| --- | --- | --- |
| **Projetos** | `#/measure` | Lista dos projetos: nome, cliente (e a obra vinculada), cidade/UF, tipo, estimador, prazo da proposta (com alerta), número de folhas e situação; filtro por situação; **Novo projeto** |
| **Cadastro do projeto** | `#/measure/projeto/novo` e `#/measure/projeto/<id>/editar` | Projeto e cliente (nome, cliente, tipo de obra, situação, escopo); local da obra (endereço, cidade, estado, ZIP); proposta (prazo, estimador responsável, obra vinculada, para aditivo ou ampliação). Excluir fica na edição |
| **Projeto** | `#/measure/projeto/<id>` | Os dados do cadastro (com **Editar projeto**), folhas (escala e situação da conferência), **Enviar PDF** (cada página vira uma folha) e a tabela de **quantidades** por condição, com as derivadas |
| **Folha (visor)** | `#/measure/folha/<id>` | A planta desenhada pelo PDF.js, com as medições por cima, e o painel de condições (com os assemblies aplicados: "+ Aplicar assembly" e ✕ para tirar) |
| **Projeto › Materiais e mão de obra** | (na tela do projeto) | Itens por categoria com a quantidade na unidade de compra; tocar abre o cálculo de cada linha; total de horas de mão de obra; pendências; **Exportar CSV** com o cálculo |
| **Itens** | `#/measure/itens` | Catálogo por categoria: código, nome, unidade de compra, etapa, nota; novo, editar e excluir (o item usado em assembly não sai) |
| **Assemblies** | `#/measure/assemblies` | Lista com o nome (e a descrição), o tipo, um resumo das linhas (quantas e os primeiros itens) e em quantas condições está em uso. Clicar no nome ou em **Editar** abre o editor |
| **Assembly** | `#/measure/assembly/<id>` (ou `/novo`) | Editor: item, fórmula, perda, arredondamento e a coluna **Teste**, ao vivo, com valores de exemplo; a ajuda lista as variáveis do tipo |

### Visor de medição
- **Tela maximizada:** a planta ocupa a tela inteira, sem o menu lateral; as **condições ficam à esquerda** e a planta no resto. O caminho de volta ao projeto e a folha (com troca rápida entre as folhas do projeto) ficam na própria barra. **Tela cheia** usa a tela do monitor toda e reajusta a planta.
- **Barra em grupos (uma linha):** voltar ao projeto e a folha (troca rápida) · ferramentas (Mover, Medir, Recortar, Vão) num grupo segmentado, com a ativa em destaque e as indisponíveis apagadas com o motivo no "title" · escala com um ponto de situação (verde conferida, âmbar não conferida, vermelho diferença) e Conferir; sem escala, o botão "Definir escala" em âmbar · zoom (−, %, +, Ajustar) · tela cheia.
- **Painel em árvore:** tipo (Linear, Área, Contagem, com a quantidade e a unidade) → condição (seta, caixa de mostrar no desenho, cor, nome, propriedades e o total desta folha na mesma linha) → ao abrir: total em ft-in e derivadas, **Assemblies** (tirar, aplicar) e **Medições nesta folha** (apagar uma a uma), Editar, Tirar desta folha, Excluir. A condição escolhida abre sozinha; as outras abrem pela seta; cada tipo recolhe pelo título.
- **Ferramentas:** Mover, Medir, **Recortar** (borracha, MZ-28) e **Vão** (MZ-29). Escolher uma condição no painel volta para Medir.
- **Incluir assembly** (no topo do painel): o desenho abre sem nenhuma condição; cada assembly do catálogo é incluído quando a pessoa vai medir (ver MZ-27).
- **Mostrar no desenho:** a caixa ao lado do nome de cada condição mostra ou oculta as marcações dela; no topo do painel, "Mostrar todas" e "Ocultar todas". A condição oculta aparece apagada, com a etiqueta "oculta", e a dica avisa se a condição ativa está oculta.
- **Barra:**
  - ferramentas **Mover** e **Medir**;
  - **Escala** (lista ou "Calibrar por uma cota") e **Conferir**, com a etiqueta "conferida" ou "diferença";
  - **zoom** (−, +, Ajustar). Ctrl + rolagem do mouse dá zoom no ponto do cursor.
- **Medir:**
  - **Contagem:** um clique por item.
  - **Linear:** cliques nos pontos. **Duplo clique** ou **Enter** conclui, **Esc** cancela, **Backspace** desfaz o último ponto.
  - **Área:** igual à linear. Também fecha com um clique no primeiro ponto.
  - **Shift** deixa a linha reta (horizontal ou vertical).
  - **Atração:** perto (6 px) de um ponto já medido, o clique gruda nele. **Alt** desliga.
  - **Espaço segurado** ou **Mover**: arrastar a planta.
- **Em andamento:** a linha tracejada mostra a medida ao vivo (ft-in ou sq ft).
- **Painel:**
  - cada condição com a caixa "mostrar no desenho", a cor escolhida, tipo, propriedades, total e derivadas;
  - a condição ativa mostra a lista de medições (apagar uma por uma), **Editar** e **Excluir**;
- **Dica:** uma linha embaixo explica o próximo passo da ferramenta atual.

### Jogo de plantas de exemplo (`assets/plantas/casa-modelo.pdf`, 3 folhas)
| Folha | Escala | O que tem |
| --- | --- | --- |
| A-101 · First Floor Plan | 1/4" = 1'-0" | Planta baixa 40' × 28', paredes, portas, janelas marcadas W1/W2/D1, cotas, linha do corte A |
| A-201 · Elevations | 1/4" = 1'-0" | Fachadas sul e leste: siding, empena, telhado 6/12, janelas W1/W2 e porta D1, quadro de vãos (W1 5'×4', W2 4'×4', D1 3'×6'-8") |
| A-301 · Section A | **3/8" = 1'-0"** | Corte: laje de 4", frost wall de 4'-0" abaixo do terreno (New England), parede 2x6, forro, telhado 6/12 |

**Exemplo de siding:**
- **Medido na fachada:** sul 40' × 9' e leste 28' × 9' + empena ≈ 709 sq ft.
- **Vãos:** 2 W1 + 1 W2 + 1 D1 = 76 sq ft.
- **NetArea:** ≈ 633 sq ft → ÷ 100 + 10% → **7 squares**.

**Exemplo de guarnição de janela:**
- **W1:** 2 × 2 × (5 + 4) = 36 lin ft → ÷ 12' + 15% → 4 peças.
- **W2:** 16 lin ft → 2 peças.
- **Porta (3 lados):** 2 peças.
- **Total:** 8 peças.

### Projetos de exemplo
- **Casa modelo** (Thompson Family), 88 Bridge St, Manchester, NH 03104 · residencial unifamiliar · em orçamento, com as 3 folhas.
- **Galpão Logístico · ampliação do mezanino** (LogSul Armazéns), Nashua (NH) · industrial · proposta enviada, vinculado à obra Galpão Logístico Rodovia.
- **Reforma de cozinha · Mitchell**, Concord (NH) · reforma · ganha.
- **Folha A-101 · First Floor Plan:** PDF vetorial gerado por `tools/gerar-planta.py`, casa de 40'-0" × 28'-0" em 1/4" = 1'-0", com cotas para calibrar e conferir.
- **Condições:** nenhuma pronta; o desenho abre vazio e os assemblies são incluídos pelo visor.

## 4. Permissões

| Permissão | O que libera | Perfis prontos |
| --- | --- | --- |
| `measure.medir` (Medir plantas) | Abrir o Measure, enviar PDF, definir escala, medir, aplicar assemblies e ver quantidades | Administrador, Gestor de obras |
| `measure.catalogo` (Itens e assemblies) | Criar e editar itens e assemblies (sem ela, as fórmulas aparecem só para consulta) | Administrador |

Encarregado e Trabalhador não veem o Measure (configurável em Settings › Perfis).

## 5. Técnica

- **mathjs 14.9** (Apache 2.0) guardada em `vendor/mathjs/`, carregada só no Measure. Enquanto carrega, a tela mostra "Carregando o motor de fórmulas…".
- **PDF.js 4.10** (Mozilla, Apache 2.0) guardado em `vendor/pdfjs/`, carregado só no Measure. O PDF é aberto **no navegador**, sem conversão para imagem e sem servidor.
- **Canvas em duas camadas:** a planta (PDF.js) e as medições (desenhadas de novo a cada mudança, com a densidade de pixels da tela).
- **PDF enviado:** fica no armazenamento do navegador (IndexedDB), como as fotos do Daily. Na versão real, vai para o armazenamento da empresa.
- **Precisão do clique:** cada clique cai num pixel inteiro. Com 85% de zoom, isso dá uns 3/4" de incerteza por ponto. A conferência mostra o erro, e o zoom maior reduz. Próximo passo: atrair o clique para as linhas do desenho vetorial do PDF.

## 6. Testes

- `tests/imperial.test.mjs` (Node, sem navegador): saída e entrada em ft-in, ida e volta, inclinação, Shoelace e escalas. **50 verificações.**
- `tests/formulas.test.mjs` (Node, sem navegador): fórmulas aceitas, **14 tentativas de abuso recusadas**, perda e arredondamento (inclusive 10.000 ÷ 32 → 344 chapas), validação. **31 verificações.**
- `tests/measure.test.mjs` (Chromium, tela de computador): **89 verificações.** Inclui as condições por folha (a fachada e o corte abrem só com o que foi incluído neles; reaproveitar e tirar de uma folha; vãos da fachada descontados na parede da planta), a borracha no piso, o vão desenhado na fachada (conta a W2, recorta o siding, sem desconto em dobro, apagar leva os dois), o desenho abrindo vazio e os assemblies incluídos um a um pelo catálogo (com nome, medidas e vãos); a lista de assemblies com resumo; a lista de projetos com filtro, o cadastro (obrigatórios, ZIP, prazo, obra vinculada), edição e exclusão; o visor maximizado com as condições à esquerda; mostrar e ocultar cada condição no desenho (conferido pelos pixels, e guardado ao reabrir); a cor escolhida na condição (paleta e cor livre) aparecendo no painel e na planta. Inclui também siding na fachada com empena, janelas e porta contadas com o tamanho do vão, materiais descontando os vãos e o corte em outra escala. Além do que está abaixo, cobre:
  - aplicar um assembly pelo visor;
  - materiais calculados (OSB, montantes, portas, concreto de meia em meia jarda);
  - o rastro do cálculo e o CSV;
  - novo item e novo assembly com teste ao vivo;
  - fórmula insegura recusada na digitação e ao salvar;
  - gestor sem permissão de catálogo.
  - escala da lista e conferência;
  - perímetro com superfície, área com desconto e contagem;
  - zoom que não muda a medida;
  - condição com espessura → cu yd;
  - envio de PDF, calibração e conferência na outra direção;
  - permissões.

  As medidas são conferidas com tolerância (até 1%), porque o clique cai em pixel inteiro.
