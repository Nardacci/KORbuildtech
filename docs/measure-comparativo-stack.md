# KORbuild Measure × STACK Takeoff & Estimate — o que falta

> **Base da análise:** a tela do STACK enviada pelo usuário (projeto de exemplo, folha A200 com a fachada medida) e a documentação pública da STACK (site, central de ajuda, comparativos). Não houve acesso à conta. **STACK é marca de terceiros**: serve só de referência de mercado, nunca como nome no KORbuild.
>
> **Data:** outubro de 2026. **Estado do Measure:** fatias 1 e 2 prontas (medição, assemblies, fórmulas, vãos, condições por folha, árvore). Ver [`measure.md`](measure.md).

## 1. O que a tela do STACK mostra

| Área da tela | O que tem |
| --- | --- |
| Topo | Projetos, **Calendário**, **Bibliotecas** (itens e assemblies prontos), compartilhar e convidar |
| Abas do projeto | Home · **Plans & Takeoffs** · **Reports** · **Estimates** |
| Esquerda | Lista de folhas em **pastas**, **Bookmarks**, **busca**, **Upload**, número da folha (A102, A200…) separado do nome |
| Centro | **Abas com várias folhas abertas** e uma aba **Overview**; **minimapa** no canto da planta |
| Barra | escala da folha (1/8" = 1'), **IA** (botões com brilho), **+ nova medição**, seleção, régua/dimensão, formas, **cortar** (tesoura), **favoritos**, zoom, **camadas**, **imprimir**, modo HD, folha anterior/próxima |
| Direita | **Estimate** ao lado da planta: Hours, Base Costs, Direct Costs, Indirect Costs, Contingencies, Cost Types; abas **Libraries** e **Detect** (IA); "Go to Estimate" |

## 2. Comparativo

Legenda: ✅ temos · 🟡 temos em parte · ❌ não temos. Prioridade: **A** (perde venda sem isso), **B** (produtividade), **C** (depois).

### 2.1 Folhas e plantas

| Recurso no STACK | KORbuild hoje | Situação | Prioridade |
| --- | --- | --- | --- |
| Upload de PDF, cada página vira folha | Igual | ✅ | — |
| Número da folha (A200) separado do nome; nome automático lido do carimbo | Nome = arquivo + página | ❌ | B |
| Pastas, busca e bookmarks na lista de folhas | Lista simples e troca rápida no visor | 🟡 | B |
| Várias folhas abertas em abas; Overview | Uma folha por vez | ❌ | C |
| Minimapa da planta | — | ❌ | C |
| **Revisões da planta: sobrepor (overlay) e comparar versões**, levar as medições para a nova revisão | — | ❌ | **A** |
| Imprimir/exportar a planta com as marcações | — | ❌ | B |

### 2.2 Medição no desenho

| Recurso no STACK | KORbuild hoje | Situação | Prioridade |
| --- | --- | --- | --- |
| Escala por folha, da lista ou calibrada | Igual, **mais a conferência obrigatória** com outra cota | ✅ (melhor) | — |
| Mais de uma escala na mesma folha (detalhes em escala diferente) | Uma escala por folha | ❌ | B |
| Linear, área e contagem | Igual | ✅ | — |
| Formas prontas (retângulo, círculo, arco) | Polígono por cliques (retângulo só no Vão) | 🟡 | B |
| Régua rápida (medir sem condição) | — | ❌ | B |
| **Cortar** (tirar janela da área) | **Recortar** e **Vão**, que conta a janela e recorta o siding numa ação só | ✅ (melhor) | — |
| **Editar medição**: mover vértice, copiar/colar, desfazer/refazer | Só apagar e refazer | ❌ | **A** |
| **Atração em cantos e linhas do PDF** (precisão) | Só nos pontos já medidos | ❌ | **A** |
| Camadas / mostrar e ocultar | Caixa por condição, por folha | ✅ | — |
| **Labels** (CSI, pavimento, fase, prédio) para agrupar relatórios | — | ❌ | **A** |
| **Typicals**: um conjunto de medições que se repete (apartamento tipo × 12) e multiplica | — | ❌ | **A** (multifamiliar) |
| Anotações na planta (texto, nuvem, destaque) | — | ❌ | C |
| Favoritos de medição | Catálogo com "já no desenho" | 🟡 | C |

### 2.3 Itens, assemblies e estimativa

| Recurso no STACK | KORbuild hoje | Situação | Prioridade |
| --- | --- | --- | --- |
| Itens e assemblies ligados à medição | Igual, com **fórmula transparente e rastro** de cada número | ✅ (melhor) | — |
| **Item groups**: escolher uma opção dentro do assembly (ex.: drywall 1/2" ou 5/8") | — | ❌ | B |
| Bibliotecas prontas por ofício | 28 itens e 8 assemblies de exemplo | 🟡 | B |
| **Preços** e os dois modos: **custo unitário** (US$/sq ft) ou **material + mão de obra** | Só quantidades (preço é a fatia 3) | ❌ | **A** |
| Perda | Campo da linha | ✅ | — |
| **Imposto, overhead, markup, contingência, custos não medidos** | — | ❌ | **A** |
| Custos por tipo (material, mão de obra, equipamento, sub), horas | Horas de mão de obra calculadas; sem custo | 🟡 | **A** |
| **Estimativa ao lado da planta**, atualizando a cada medição | Quantidades na tela do projeto | 🟡 | B |
| Relatórios filtrados por folha, tipo de custo e label; Excel | CSV com o cálculo | 🟡 | B |
| **Proposta em PDF** com logo, escopo, termos e subtotais | — | ❌ | **A** |

### 2.4 Plataforma e IA

| Recurso no STACK | KORbuild hoje | Situação | Prioridade |
| --- | --- | --- | --- |
| Projetos com lista e prazo | Lista com situação, **prazo da proposta**, estimador e obra vinculada | ✅ | — |
| Calendário de propostas | Prazo com alerta na lista | 🟡 | C |
| Compartilhar e convidar (colaborador externo) | Perfis de acesso internos | 🟡 | C |
| Integrações (Procore, contabilidade) | — | ❌ | C |
| **Auto count** (achar o mesmo símbolo na planta) | — | ❌ | B |
| IA: detectar paredes, portas, janelas e ambientes; assistente que responde sobre a planta | — | ❌ | C (diferencial futuro) |

## 3. O que o KORbuild já faz melhor

1. **Cálculo à vista:** cada quantidade mostra condição → variáveis → fórmula → perda → arredondamento. No STACK a lógica do assembly fica fechada.
2. **Conferência da escala** com uma segunda cota, e o aviso quando passa de 1%.
3. **Vão desenhado:** uma ação conta a janela (com flashing, guarnição e J-channel) e recorta o siding, sem desconto em dobro.
4. **Ligação com a obra:** as horas estimadas viram o orçamento de mão de obra do Crew, e as quantidades podem virar o avanço físico no Daily. O STACK para na proposta.
5. **Regras com vigência e auditoria** (Settings), sem nada fixo no código.

## 4. Proposta de próximas fatias

| Fatia | Conteúdo | Por quê |
| --- | --- | --- |
| **3 · Estimativa** (já planejada) | Preços com vigência; modo custo unitário e material + mão de obra; imposto, overhead, markup e margem, contingência, custos não medidos; painel de estimativa ao lado da planta; **proposta em PDF**; snapshot da versão enviada | Sem preço e proposta, o Measure não fecha uma venda |
| **4 · Precisão e edição** | Atração em cantos e linhas do PDF; mover vértice, desfazer/refazer, copiar; retângulo e círculo; régua; **labels** | Velocidade e confiança do estimador no dia a dia |
| **5 · Repetição e revisões** | **Typicals** (apartamento tipo, pavimento tipo); revisões da planta com sobreposição e medições levadas para a nova versão; número da folha e pastas | Multifamiliar e addenda, comuns em New Hampshire |
| **6 · Automação** | Auto count por símbolo; nome da folha lido do carimbo; depois, detecção por IA | Diferencial, quando a base estiver sólida |

## Fontes

- Tela do STACK enviada pelo usuário (Sample Project, folha A200).
- [STACK — guia de IA em takeoff 2026 (ConstructConnect)](https://www.constructconnect.com/blog/ai-powered-takeoff-and-estimating-software-a-contractors-guide-to-the-top-players-in-2026)
- [STACK — What is an Assembly](https://help-preconstruction.stackct.com/docs/what-is-an-assembly)
- [STACK — Auto-Create Takeoffs from Items and Assemblies](https://help-preconstruction.stackct.com/docs/autocreate-takeoffs-from-items-and-assemblies)
- [STACK — Floor Plan AI](https://help-preconstruction.stackct.com/docs/floor-plan-ai)
- [STACK — Advanced estimating](https://www.stackct.com/blog/advanced-estimating/)
- [STACK — Transform your takeoff with a complete set of tools](https://www.stackct.com/blog/transform-your-takeoff-with-a-complete-set-of-tools-for-the-job)
- [SoftwareConnect — STACK Takeoff & Estimate](https://softwareconnect.com/estimating/stack/)
