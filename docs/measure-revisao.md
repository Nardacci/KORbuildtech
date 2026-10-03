# KORbuild Measure — revisão da especificação 0.1

> Revisão técnica e de negócio da [especificação conceitual 0.1](measure-especificacao-0.1.md). Objetivo: corrigir o que pode dar problema antes de virar código e fechar as decisões para a especificação funcional (versão 0.2).
>
> **Resumo:** a direção está certa. Os pontos fortes são unidade base decimal, geometria separada do item, motor de fórmulas, Quantity ≠ Cost ≠ Price e perfil regional. Há **7 ajustes** que evitam retrabalho grande (seção 1), **2 respostas** às perguntas abertas (seção 2) e uma proposta de MVP (seção 6).

---

## 1. Ajustes recomendados

### 1.1 Guardar a geometria em coordenadas do PDF, não em pixels

O fluxo 0.1 calcula "100 pixels = 10 ft". O problema: pixel depende do zoom e da resolução com que a folha foi desenhada. Mudou o zoom, mudou a qualidade da imagem ou trocou a revisão da planta, e as medições ficam presas a uma imagem específica.

**Recomendação:** guardar cada ponto em **coordenadas da página do PDF**. O PDF tem a própria unidade, o *point*, que vale 1/72 de polegada do papel. A escala da folha diz quantas polegadas reais vale cada point. Assim:
- o desenho na tela pode ter qualquer zoom e qualquer resolução;
- a medida não muda;
- a geometria pode ser recalculada se a escala for corrigida depois.

```
ponto clicado na tela → coordenada da página (points) → × escala da folha → polegadas reais
```

### 1.2 Escala é da folha (e às vezes de um trecho da folha)

- Plantas americanas dizem a escala: **arquitetônica** (`1/4" = 1'-0"` = 1:48; `1/8" = 1'-0"` = 1:96) ou **de engenharia** (`1" = 20'` = 1:240).
- A calibração deve aceitar **as duas formas**: escolher a escala da lista ou medir uma cota conhecida.
- **Uma mesma folha pode ter várias escalas:** a planta em 1/4" e um detalhe em 1-1/2". O modelo precisa de **regiões com escala própria** (viewports) desde o início, mesmo que a tela do MVP só use uma escala por folha.
- **Conferência obrigatória:** depois de calibrar, o sistema pede para medir uma segunda cota conhecida e mostra a diferença. Escala errada é o erro mais caro de um takeoff: estraga todas as medições da folha.
- Folha marcada "NTS" (not to scale) não pode ser medida, só contada.

### 1.3 Uma unidade base por dimensão, convertida só nas bordas

A 0.1 diz "tudo em polegadas", mas também "`raw_value` na unidade do tipo (sq ft, lin ft, each)". As duas regras se contradizem. Proposta:

| Dimensão | Guardado (base) | Na fórmula e na tela |
| --- | --- | --- |
| Comprimento | **polegadas** (número decimal) | lin ft · ft-in (`12'-6 1/2"`) |
| Área | **polegadas quadradas** | sq ft |
| Volume | **polegadas cúbicas** | cu ft · cu yd |
| Contagem | unidades | each |

- **As frações comuns são exatas em binário.** 1/2, 1/4, 1/8, 1/16, 1/32 e 1/64 de polegada são guardadas sem nenhuma perda num número decimal (float). Polegada como base é a escolha certa.
- O motor de fórmulas recebe as variáveis **na unidade do ofício**: `MeasuredArea` em sq ft, `MeasuredLinear` em lin ft. Quem escreve a fórmula pensa como o estimador americano.
- **Apresentação:** arredondar para 1/16" (configurável: 1/8, 1/16, 1/32), sem nunca alterar o valor guardado.
- **Entrada:** o tradutor precisa aceitar `12'-6 1/2"`, `12' 6.5"`, `12-6-1/2`, `150.5"`, `12.54'`, `12ft 6in` e recusar o que for ambíguo, mostrando o valor entendido antes de salvar.

### 1.4 Separar o Takeoff (a "condição") das Medições (os desenhos)

Na 0.1, `Takeoff_Measurement` é ao mesmo tempo o nome ("Exterior Walls 1st Floor") e a geometria. Na prática:
- uma condição como "Exterior walls" é desenhada em **várias folhas e vários trechos**;
- ela tem **propriedades** (altura da parede, inclinação, espessura);
- trechos da área podem ser **descontados** (vãos, recortes).

Proposta:

```
Projeto ─ Conjunto de plantas ─ Folha (escala, viewports)
   │
   └─ Takeoff / condição (nome, tipo, cor, propriedades: WallHeight, RoofPitch, Depth…)
         ├─ Medição 1 (geometria numa folha)
         ├─ Medição 2 (outra folha)
         └─ Desconto (área a subtrair)
```

O valor medido da condição é a soma das medições menos os descontos. Ele é **calculado**, e pode ficar em cache, mas nunca é digitado.

### 1.5 Tipos de medição: três geometrias + propriedades

Os 9 tipos de mercado não precisam virar 9 tipos de desenho. São **3 geometrias** (ponto, linha, polígono) com **propriedades** que geram medidas derivadas:

| Tipo de mercado | Geometria | Medida derivada |
| --- | --- | --- |
| Count | pontos | quantidade |
| Linear | linha | comprimento |
| Linear with drop | linha | comprimento + quedas verticais × número de quedas |
| Pitched linear | linha | comprimento × fator de inclinação |
| Area | polígono | área (Shoelace), menos os descontos |
| Pitched area | polígono | área × fator de inclinação |
| Surface area | linha | comprimento × altura (parede) |
| Volume 2D | polígono | área × espessura/profundidade |
| Volume 3D | polígono | área × altura, com lados |

**Fator de inclinação do telhado:** inclinação `6/12` (6" de subida a cada 12") → fator = √(1 + (6/12)²) = **1,118**. A inclinação é digitada como o americano fala (`6/12`) e guardada como número.

Assim, um tipo novo é só **uma propriedade e uma fórmula derivada**, sem geometria nova. Isso cumpre o "não se limitar a esses tipos".

### 1.6 Fórmulas: transparência, perda separada e versões

- **Perda (waste) e arredondamento são campos, não números escondidos na fórmula.** `MeasuredArea * 1.10 / 32` funciona, mas o "1.10" fica invisível na tela. Melhor assim:
  - fórmula: `MeasuredArea / 32`;
  - perda: **10%**;
  - arredondar para cima (ceil), porque não se compra meia chapa.

  O usuário vê "10.000 sq ft ÷ 32 sq ft/chapa = 312,5 → +10% de perda = 343,75 → **344 chapas**". É o RB-004 na prática.
- **Validação ao salvar:**
  - variável inexistente;
  - unidade incompatível (área onde se espera comprimento);
  - divisão por zero;
  - prévia com valores de teste.
- **Versões e congelamento:** quando o preço, a fórmula ou a produtividade mudam, a **estimativa já enviada ao cliente não muda sozinha**. A estimativa guarda um *snapshot*: fórmula, preço e resultado da época. É o mesmo princípio de vigência que já usamos no Settings para valor hora, encargos e regras de jornada.
- **Precedência das variáveis**, igual à herança do Settings. Da mais forte para a mais fraca:

```
medição → condição (takeoff) → projeto/obra → perfil regional → padrão da empresa
```

  A tela mostra de onde veio cada valor ("WallHeight = 9' · definido na condição").

### 1.7 Perfil regional: cuidado com valores de segurança

A ideia do `Regional_Profile` está certa e segue a nossa decisão de **não amarrar a New Hampshire**: é dado, não código. Mas há dois cuidados.

- **Carga de neve e profundidade de congelamento não são valores de estado.** Em New Hampshire, a carga de neve do solo **varia muito de cidade para cidade** (o estado tem tabela por município), e a profundidade de fundação segue o código adotado pelo município. "40 lb/sq ft" como padrão para todo o estado pode ficar **abaixo do exigido** em muitos lugares.
- **Regra proposta:** no Measure, essas variáveis servem **para estimar quantidades** (ex.: profundidade da frost wall → volume de concreto). Elas **nunca** servem como valor de projeto estrutural. O valor certo vem da planta do engenheiro. A tela avisa: "valor padrão para estimativa; confira na planta".
- **Onde o perfil mora:** no **Settings** (cadastro, com vigência e auditoria), ligado à **obra** pelo endereço. A empresa pode ter vários perfis (ex.: "NH Seacoast", "NH Lakes Region").
- **O perfil também carrega preços e impostos:** imposto sobre material (New Hampshire não tem imposto geral sobre vendas; Massachusetts tem), produtividade e preço regional (RB-007).

---

## 2. Respostas às perguntas abertas

### 2.1 Começar pelo canvas ou pelo motor de cálculo?

**Pelos dois, em fatias finas.** O valor só aparece quando a medição vira quantidade. Um canvas sem motor é só uma régua; um motor sem canvas é uma planilha. A ordem proposta:
1. Tradutor imperial (entrada e saída de ft-in) e testes. É a base de tudo.
2. Canvas: abrir o PDF, calibrar, conferir, medir Count/Linear/Area.
3. Motor: condição com propriedades → variáveis → assembly → quantidades.
4. Preço e estimativa.

Sim, consigo construir o canvas: medição sobre PDF com zoom, pan, snap e polígonos é trabalho de Canvas 2D, que já usamos no mapa do Crew.

### 2.2 Converter o PDF em imagem: no navegador ou no servidor?

**No navegador, com o PDF.js** (biblioteca da Mozilla, licença Apache 2.0, a mesma do visualizador de PDF do Firefox). Na verdade, **sem converter**:
- o PDF.js desenha o PDF **vetorial** direto no canvas, em qualquer zoom e sempre nítido;
- as coordenadas da página ficam à mão (seção 1.1);
- no futuro, dá para "grudar" o clique nas linhas do desenho (*snap* na geometria vetorial do PDF);
- não precisa de servidor para isso: sem custo de processamento, e a planta do cliente não sai do computador até ser salva;
- folhas grandes (ARCH D, 36"×24") são desenhadas **em blocos**, só a parte visível no zoom atual.

O servidor entra depois, só para miniaturas, plantas digitalizadas (escaneadas, sem vetores), OCR de cotas e IA.

**WebGL não é necessário no começo.** O Canvas 2D aguenta milhares de medições por folha. Só vale reavaliar se aparecer um gargalo real.

---

## 3. Stack: ajustes à sugestão da 0.1

| Tema | Sugestão 0.1 | Recomendação |
| --- | --- | --- |
| Interface | React/Vue + PixiJS/Fabric.js | Decidir **uma** stack para a plataforma inteira (Daily, Crew e Measure juntos), não só para o Measure. No protótipo, continuar em JavaScript puro, como os outros módulos |
| Desenho | PixiJS/Fabric.js | **PDF.js + Canvas 2D**. PixiJS (WebGL) só se houver gargalo |
| Fórmulas | `expr-eval` ou `mathjs` | **mathjs** (Apache 2.0, mantida), com as funções perigosas desligadas, como recomenda a documentação de segurança dela (`import`, `createUnit`, `evaluate` e `parse` de dentro da fórmula). Antes de escolher, conferir a manutenção e os alertas de segurança da `expr-eval`. Nunca `eval()` |
| Banco | Supabase (PostgreSQL) | Concordo: é o que já está previsto para a plataforma (`saas.md`) |
| Dispositivo | Só computador | Concordo para **medir**. No celular, a estimativa aprovada só para consulta (o dono da obra quer ver o valor na obra) |

---

## 4. O que a 0.1 ainda não cobre (e o mercado americano espera)

1. **Markup ≠ margem.** É o erro de conta mais comum em estimativa. Um markup de 20% sobre $100 dá $120, mas a margem é 20 ÷ 120 = **16,7%**. A especificação precisa dizer qual dos dois o usuário digita, e a tela deve mostrar os dois.
2. **Revisões de planta.** A planta muda (Rev A, Rev B). É preciso trocar a folha mantendo as medições e mostrar o que mudou entre as revisões. Sem isso, o estimador refaz tudo.
3. **Itens fora do takeoff:**
   - verbas (allowances) e alternativas (alternates);
   - exclusões, contingência, bonds e seguro;
   - licenças municipais (permits).
4. **Códigos de custo:** usar a mesma lista de **etapas / cost codes** do Settings (com o modelo **CSI MasterFormat** como opção). É o que liga o Measure ao Crew e ao Daily (seção 5).
5. **Unidade de compra × unidade medida:** mede-se em sq ft, mas compra-se em chapas, caixas ou rolos. Cada item tem a sua unidade de compra, e a conversão fica visível.
6. **Exportação:** a estimativa sai em Excel e PDF (proposta ao cliente) e, depois, vai para QuickBooks.

---

## 5. A ligação com o resto da plataforma (o diferencial)

O Measure fecha o ciclo que nenhum concorrente pesquisado fecha num produto só:

```
MEASURE                       CREW                         DAILY
estimativa de horas  ─────►  horas reais por etapa  ◄────  avanço físico por etapa
por etapa (cost code)        (ponto, custo carregado)       (RDO)
        │                              │                          │
        └────────────► orçado × realizado × projeção ◄────────────┘
```

- **Mão de obra estimada** (horas × produtividade) por etapa vira o **orçamento de mão de obra** que o Crew já usa em Custos. Hoje esse orçamento é digitado.
- O **custo da hora** na estimativa pode vir do **custo carregado real** (valor hora + encargos do Settings).
- O **avanço físico** que o Crew pede para projetar o custo pode vir das **quantidades do Measure**: "45 de 180 cu yd de concreto". O Daily registra no RDO e a projeção fica automática.

---

## 6. Proposta de MVP do Measure

**Entra:**
1. Projeto ligado à obra; envio do PDF (várias folhas) e visualização com PDF.js (zoom, pan).
2. Escala por folha: lista de escalas americanas ou calibração por cota, mais a **conferência**.
3. Condições Count, Linear e Area, com cor, propriedades (altura, inclinação, profundidade) e descontos.
4. Medidas derivadas: surface area, pitched e volume 2D (seção 1.5).
5. Tradutor imperial completo (entrada e saída), com testes.
6. Catálogo de itens com unidade de compra e preço (com vigência), e assemblies com fórmulas, perda e arredondamento.
7. Estimativa: material, mão de obra, equipamento e subempreiteiro; overhead; lucro (markup **e** margem visíveis); preço de venda; snapshot ao enviar.
8. Rastreabilidade: tocar num valor da estimativa mostra a fórmula, a condição e as medições na planta (RB-003/004).
9. Exportação em Excel e PDF.
10. Ligação com o Crew: horas estimadas por etapa viram o orçamento de mão de obra.

**Fica para depois:**
- IA que sugere medições (sempre como "proposta" que o usuário confirma, com a evidência na planta; RB-005);
- revisões de planta com comparação;
- Volume 3D;
- snap nos vetores do PDF;
- plantas escaneadas (OCR);
- QuickBooks;
- vários perfis regionais.

---

## 7. Decisões

**Tomadas:**
- **Canvas e motor juntos**, em fatias finas (2.1);
- **PDF aberto no navegador**, com PDF.js (2.2);
- **primeira fatia construída**: tradutor imperial, escala com conferência e medição. Ver [`measure.md`](measure.md). Ela já segue 1.1 (coordenadas do PDF), 1.3 (unidade base), 1.4 (condição separada das medições) e 1.5 (geometrias e propriedades).

**Ainda para validar (antes da versão 0.2):**

1. **Unidade base:** polegadas (comprimento), polegadas² e polegadas³ guardadas; sq ft, lin ft e cu yd nas fórmulas e na tela (1.3). De acordo?
2. **Geometria em coordenadas do PDF** (1.1) e **escala por folha com viewports** (1.2)?
3. **Takeoff/condição separado das medições** (1.4)?
4. **Perda e arredondamento como campos**, e **snapshot** da estimativa enviada (1.6)?
5. **Perfil regional no Settings**, ligado à obra, com aviso de que carga de neve e congelamento são só para estimativa (1.7)?
6. **PDF.js no navegador** (2.2) e **mathjs** com funções restritas (3)?
7. **MVP** da seção 6: falta ou sobra algo?
8. **Primeiro passo de código:** o tradutor imperial com testes e uma tela de calibração e medição sobre um PDF de exemplo, para ver o canvas funcionando cedo?
