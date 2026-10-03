# KORbuild Measure — documentação do módulo (protótipo, fatia 1)

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
| 2 | Catálogo de itens, assemblies e fórmulas (mathjs restrito), perda e arredondamento como campos | Próxima |
| 3 | Preços com vigência, estimativa (material, mão de obra, equipamento, subempreiteiro, overhead, lucro com markup **e** margem), snapshot | — |
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

## 3. Telas

| Tela | Rota | O que faz |
| --- | --- | --- |
| **Projeto** | `#/measure/projeto/<id>` | Folhas (escala e situação da conferência), **Enviar PDF** (cada página vira uma folha) e a tabela de **quantidades** por condição, com as derivadas |
| **Folha (visor)** | `#/measure/folha/<id>` | A planta desenhada pelo PDF.js, com as medições por cima, e o painel de condições |

### Visor de medição
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
  - cada condição com cor, tipo, propriedades, total e derivadas;
  - a condição ativa mostra a lista de medições (apagar uma por uma), **Editar** e **Excluir**;
  - na condição de área, a opção "desenhar como desconto".
- **Dica:** uma linha embaixo explica o próximo passo da ferramenta atual.

### Projeto de exemplo
- **Casa modelo**, 1450 Elm St, Manchester (NH).
- **Folha A-101 · First Floor Plan:** PDF vetorial gerado por `tools/gerar-planta.py`, casa de 40'-0" × 28'-0" em 1/4" = 1'-0", com cotas para calibrar e conferir.
- **Condições prontas:** Paredes externas (linear, altura 9'-0"), Piso (LVP) (área) e Portas internas (contagem).

## 4. Permissões

| Permissão | O que libera | Perfis prontos |
| --- | --- | --- |
| `measure.medir` (Medir plantas) | Abrir o Measure, enviar PDF, definir escala, medir e ver quantidades | Administrador, Gestor de obras |

Encarregado e Trabalhador não veem o Measure (configurável em Settings › Perfis).

## 5. Técnica

- **PDF.js 4.10** (Mozilla, Apache 2.0) guardado em `vendor/pdfjs/`, carregado só no Measure. O PDF é aberto **no navegador**, sem conversão para imagem e sem servidor.
- **Canvas em duas camadas:** a planta (PDF.js) e as medições (desenhadas de novo a cada mudança, com a densidade de pixels da tela).
- **PDF enviado:** fica no armazenamento do navegador (IndexedDB), como as fotos do Daily. Na versão real, vai para o armazenamento da empresa.
- **Precisão do clique:** cada clique cai num pixel inteiro. Com 85% de zoom, isso dá uns 3/4" de incerteza por ponto. A conferência mostra o erro, e o zoom maior reduz. Próximo passo: atrair o clique para as linhas do desenho vetorial do PDF.

## 6. Testes

- `tests/imperial.test.mjs` (Node, sem navegador): saída e entrada em ft-in, ida e volta, inclinação, Shoelace e escalas. **50 verificações.**
- `tests/measure.test.mjs` (Chromium, tela de computador): **18 verificações.**
  - escala da lista e conferência;
  - perímetro com superfície, área com desconto e contagem;
  - zoom que não muda a medida;
  - condição com espessura → cu yd;
  - envio de PDF, calibração e conferência na outra direção;
  - permissões.

  As medidas são conferidas com tolerância (até 1%), porque o clique cai em pixel inteiro.
