# KORbuild Measure — especificação conceitual 0.1 (takeoff e estimativa)

> **Status:** versão conceitual 0.1, escrita pelo time de produto. **Não é** ainda a especificação funcional nem o pedido de código. A revisão técnica está em [`measure-revisao.md`](measure-revisao.md).
>
> **Nome do módulo:** **KORbuild Measure**. "Takeoff & Estimating" descreve o que ele faz; "STACK" aparece só como referência de mercado (é marca de terceiros).

## 1. Objetivo

Transformar plantas e documentos de construção em informações quantitativas para estimar materiais, mão de obra, equipamentos, subcontratação e o custo da obra.

```
Plan → Takeoff → Quantities → Calculation → Estimate
```

O módulo é concebido desde o início para os **Estados Unidos**, e não como a conversão de um sistema métrico brasileiro.

## 2. Takeoff

Takeoff é analisar a planta e determinar quanto de cada elemento a obra vai precisar.

| Elemento | Medição |
| --- | --- |
| Flooring | 2,450 sq ft |
| Baseboard | 680 lin ft |
| Doors | 24 each |
| Concrete | 185 cu yd |
| Drywall | 10,000 sq ft |

Referência de mercado: tipos de medição como Area, Linear, Count, Linear with Drop, Pitched Area, Pitched Linear, Surface Area, Volume 2D e Volume 3D. A arquitetura deve suportar esses conceitos sem se limitar a eles.

## 3. Unidades (EUA)

**Padrão: unidades imperiais.** ft, in, sq ft, lin ft, cu ft, cu yd, lb, ton, each.

- O cálculo **não** converte para o sistema métrico: 2,450 sq ft continua 2,450 sq ft (e não "≈ 227,61 m²").
- Conversão métrica pode existir no futuro como recurso auxiliar, sem interferir no cálculo principal.

**Regra técnica crítica: frações de polegada.** Plantas e usuários americanos trabalham com frações e textos formatados (ex.: `12'-6 1/2"`).
- **Nunca** guardar frações nem textos para cálculo. Tudo é guardado numa unidade base decimal (polegadas ou pés, como número).
- **Camada de tradução:**
  - entrada: o usuário digita `10'-6"` e o sistema grava `126.0` (polegadas);
  - cálculo: `126.0 / 12 = 10.5 ft`;
  - tela: `126.0` volta a ser `10'-6"`.

## 4. Particularidades da construção americana

O residencial americano é majoritariamente **wood framing**: 93% das casas unifamiliares concluídas em 2023 (NAHB, dados do Census Bureau). O domínio que a arquitetura deve suportar, sem obrigação de implementar tudo no MVP:
- estrutura e acabamentos: lumber/framing, drywall, roofing, siding, insulation, flooring, doors, windows, finishes;
- concreto e terreno: concrete, excavation/site work;
- instalações: electrical, plumbing, HVAC.

## 5. Takeoff → quantidade

Cada medição produz uma quantidade estruturada.

Exemplo 1 (Flooring):
- medido: 2,450 sq ft;
- multiplicador: 1.00;
- quantidade: 2,450 sq ft.

Exemplo 2 (Doors):
- medido: 24;
- perda: 0%;
- quantidade: 24 each.

Fatores configuráveis, não fixos no código: multiplier, waste, coverage, productivity, material factor e labor factor.

## 6. Motor de cálculo (Formula Engine)

```
TAKEOFF → MEASURED QUANTITY → FORMULA → MATERIAL QUANTITY → LABOR QUANTITY → COST
```

Exemplo (Drywall, 10,000 sq ft medidos):

| | Conta | Valor |
| --- | --- | --- |
| Material | 10,000 × $0.85 | $8,500 |
| Mão de obra | 10,000 × $1.20 | $12,000 |
| **Custo direto** | | **$20,500** |

As fórmulas são configuradas por item ou assembly, não programadas uma a uma. Variáveis vindas do takeoff: `MeasuredArea`, `MeasuredLinear`, `MeasuredCount`. Variáveis informadas pelo usuário: `WallHeight`, `RoofPitch`.

**Fluxo no canvas:**
1. **Envio do PDF:** o PDF vira imagem e é desenhado na tela.
2. **Calibração da escala:** uma linha sobre uma cota conhecida (ex.: 10 ft) define a relação entre pixels e pés.
3. **Medição:** cliques na planta. Distância em pixels × relação = medida real.
   - Count: lista de pontos.
   - Linear: caminhos.
   - Area: polígono fechado, calculado pela fórmula de Shoelace (Gauss).

## 7. Item e assembly

**Item:** um componente da estimativa, como 2x4 lumber, drywall 1/2", joint compound, screws ou "Labor – Drywall Installation". Campos:
- descrição, unidade, quantidade e categoria;
- preço unitário, custo e fornecedor;
- produtividade e regras de cálculo.

**Assembly:** um conjunto de itens. Exemplo: **Wall assembly** = 2x4 lumber + OSB + insulation + drywall + fasteners + labor. Assim, uma medição de parede alimenta vários componentes.

**Modelo de dados base:**

| Entidade | Campos |
| --- | --- |
| `Takeoff_Measurement` (a geometria) | `id`, `plan_id`, `name`, `measurement_type` (AREA, LINEAR, COUNT), `raw_value` (na unidade padrão do tipo) |
| `Formula_Variable` | `MeasuredArea`, `MeasuredLinear`, `MeasuredCount`, `WallHeight`, `RoofPitch` |
| `Assembly_Item` (o vínculo) | `id`, `assembly_id`, `item_id`, `formula_material` (ex.: `MeasuredArea * 1.10 / 32`), `formula_labor` (ex.: `MeasuredArea * 0.05`) |

## 8. Estimate

```
TAKEOFF → QUANTITIES → MATERIAL → LABOR → EQUIPMENT → SUBCONTRACTOR → DIRECT COST → OVERHEAD → PROFIT → SELLING PRICE
```

**Quantity ≠ Cost ≠ Price.** Exemplo conceitual (não são parâmetros):

| | Valor |
| --- | --- |
| Quantity | 10,000 sq ft |
| Material | $8,500 |
| Labor | $12,000 |
| Direct cost | $20,500 |
| Overhead | $3,000 |
| Profit | $4,500 |
| **Price** | **$28,000** |

## 9. Regras fundamentais

| # | Regra |
| --- | --- |
| RB-001 | Cálculo em unidades imperiais |
| RB-002 | Precisão preservada; arredondar só na apresentação ou quando uma regra de negócio exigir |
| RB-003 | Rastreabilidade: Plan → Takeoff → Measurement → Formula → Quantity → Cost |
| RB-004 | Fórmula transparente: o usuário vê como a quantidade e o custo foram calculados |
| RB-005 | A IA pode ajudar a identificar elementos, mas não cria quantidade sem evidência na planta ou nos dados do usuário |
| RB-006 | Separar medida, quantidade, material, mão de obra, custo, markup/overhead, lucro e preço de venda |
| RB-007 | Contexto regional: materiais, métodos, preços e produtividade variam por região; custo não é universal |

## 10. Contexto regional (New England como piloto)

New Hampshire/New England é o **contexto regional inicial**, mas regras de New Hampshire **não** são codificadas como regras nacionais.

**Exemplo: fundações.** Em New England, o inverno exige basement ou frost wall com pelo menos 4 ft de profundidade. No Sul (Texas, Flórida), usa-se slab-on-grade. Segundo a NAHB, em 2024 o basement era muito mais comum em New England do que nas regiões quentes.

**Entidade `Regional_Profile`:** injeta valores padrão no motor de fórmulas sem mudar o código.

| Variável | New England | Flórida |
| --- | --- | --- |
| `FrostLineDepth` | 48 in | 0 |
| `SnowLoadDefault` | 40 lb/sq ft | 0 |

## 11. Diretriz arquitetural

```
PLAN → TAKEOFF → QUANTITIES → FORMULA ENGINE → MATERIAL / LABOR / ETC. → COST → ESTIMATE → PROPOSAL
```

**Princípio central:** não é um simples medidor de plantas. É uma plataforma que transforma a planta em quantidades e, depois, em custos e estimativas.

## 12. Stack sugerida e perguntas abertas (da versão 0.1)

**Stack sugerida:**
- ferramenta só para computador (web);
- Canvas, PixiJS ou Fabric.js para desenhar;
- `expr-eval` ou `mathjs` para as fórmulas, sem `eval()`;
- Supabase (PostgreSQL) para os dados.

**Perguntas abertas:**
1. Começar pelo canvas ou pelo motor de cálculo?
2. Converter o PDF em imagem no navegador ou num serviço no servidor?

As respostas estão na revisão.
