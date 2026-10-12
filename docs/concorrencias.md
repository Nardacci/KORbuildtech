# KORbuild — Concorrências (bid) e canal entre contratante e contratada

> Especificação de outubro de 2026. Versão 2: desenho das telas, estrutura e regras **para o protótipo**. A versão 1 dizia que precisava de servidor; no protótipo, as duas empresas já se encontram no aparelho (como o cronograma publicado em `compartilhados()` e os diários em `diariosDeFora()`), então a concorrência pode ser simulada do mesmo jeito. No produto, esse lugar comum é o servidor.
>
> **Situação:** fatias 1 a 6 prontas (o portal vem a seguir): o motor (`js/concorrencias.js`), as telas da contratante (Daily › Concorrências) e as da convidada (Measure › Convites: o convite, Vou cotar → projeto no Measure, Enviar pela plataforma a partir da proposta emitida, Não vou participar, e a vitória que vira obra já ligada), o canal (aba Perguntas, conversa no convite, aviso a todos, canal da obra depois do fechamento) e os avisos no sininho, e a quarteirização (concorrência a partir do projeto ou da obra, Usar no meu orçamento, aprovação da contratante de cima, presença da cadeia na obra). e o link para quem não tem conta (`#/convite/<token>`, sem login: ver o convite, responder, perguntar e mandar a proposta com PDF; "Copiar o link" para a contratante). `tests/concorrencias.test.mjs`, 128 verificações.
>
> **Simplificações:** a proposta enviada pela plataforma usa as linhas da proposta emitida no Measure: as que têm o código de uma etapa da concorrência vão por etapa, as outras (e os outros itens) vão em **outros itens**, que aparecem numa linha própria na comparação. "Vou cotar" cria o projeto sem as folhas (o protótipo não guarda os PDFs da contratante; a prestadora envia as plantas no projeto, como hoje). A convidada que não tem o Measure no plano responde pelo link (fatia 6).
>
> **Simplificações da fatia 2:** dos desenhos, o protótipo guarda só o nome do PDF; o orçamento aparece no formulário como total (o *por etapa* já existe no motor, sem campo ainda); a aba **Perguntas** entra com o canal (fatia 4).

## 1. A ideia

Quem contrata (a **contratante**) manda um serviço da obra para a sua lista de prestadoras, com as informações, os desenhos e o escopo. As prestadoras confirmam se vão participar e mandam proposta. A contratante compara, escolhe a melhor e fecha negócio. Daí em diante, as duas ficam **ligadas** naquela obra, com um **canal** de conversa entre elas.

**A contratante não é só a construtora.** Uma prestadora também contrata: ela pega um serviço de uma construtora e **quarteiriza** parte dele (ou cota com as suas prestadoras antes de mandar a própria proposta). O canal de proposta vale para **construtora → prestadora** e para **prestadora → prestadora**, com as mesmas telas e regras (§1.1, §3.5).

No mercado americano: *invitation to bid* (ITB), *bid package*, *bid leveling* (comparação), *RFI* (dúvida) e *award* (fechamento).

**O que fecha o ciclo:** o fechamento cria a **mesma ligação de obra** (`vinculo {empresaId, obraId}`) que já existe hoje. A partir dela, tudo o que já funciona entre as empresas passa a valer sozinho: a construtora aprova os diários da prestadora (HS-11), vê a equipe na obra sem valores (HS-10) e recebe o cronograma publicado (SET-057).

### 1.1 Quem contrata quem (a cadeia)

```
Dono da obra
  └─ Construtora Exemplo ............ obra: Edifício Atlântico
       └─ Northfield (contratada) ... obra ligada: Atlântico · framing e drywall
            └─ Bay State Drywall .... obra ligada: Atlântico · drywall   (quarteirizada)
```

- Cada elo é uma **concorrência fechada** e uma **ligação de obra** (`vinculo`) da contratada para a obra de quem a contratou. A ligação já é genérica no protótipo: aponta para uma empresa, seja construtora ou prestadora.
- **Quem contrata aprova.** O diário da Bay State é aprovado pela Northfield, e o da Northfield pela Construtora (generaliza o HS-11). É o que o protótipo já faz: quem está na outra ponta da ligação recebe e aprova.
- **Cada elo só vê os vizinhos**, com uma exceção, a presença na obra (CO-21): a construtora sabe quem está no canteiro, de todas as empresas da cadeia.
- Os valores de um elo nunca sobem nem descem: a construtora não vê o preço da Bay State para a Northfield, e a Bay State não vê o preço da Northfield para a construtora.
- Uma prestadora pode ser contratante e contratada ao mesmo tempo (na mesma obra ou em obras diferentes). Uma prestadora sem construtora (HS-13) também pode contratar outras.

## 2. Fluxo

Escrito para o caso mais comum (construtora → prestadora); na quarteirização, a "construtora" é a prestadora que contrata.

| # | Quem | O quê |
| --- | --- | --- |
| 1 | Construtora | Monta a **concorrência** de um serviço (framing, drywall…) numa obra: escopo (incluso e excluso), etapas (cost codes) a cotar, desenhos (PDF), prazo da proposta e, se quiser, o orçamento (CO-03). |
| 2 | Construtora | Escolhe os convidados em **Contatos** (marcador subempreiteiro + etapas que faz) e envia. |
| 3 | Prestadora | Recebe o convite (sininho e e-mail) e responde: **Vou cotar** ou **Não vou participar** (motivo opcional). |
| 4 | Prestadora | Quem vai cotar ganha um **projeto no Measure** já criado, com os desenhos, o cliente e o prazo preenchidos. Mede, aplica preços e **envia a proposta pela plataforma** (o PDF vai junto). |
| 5 | As duas | Dúvidas durante a concorrência pelo **canal** (§5). |
| 6 | Construtora | **Compara** as propostas lado a lado: total, por etapa, prazo, exclusões, seguros e licenças. |
| 7 | Construtora | **Fecha** com uma. As outras são avisadas, sem ver o valor da vencedora. |
| 8 | As duas | **Vínculo selado:** na prestadora, o projeto vira *Ganha* e a obra é criada já ligada à obra da construtora. O canal continua, agora como a conversa da obra. |

## 3. Telas (desenho)

### 3.1 Contratante (construtora ou prestadora)

A concorrência fica no plano (CO-02), não é um módulo à parte. A tela **Concorrências** tem duas abas, **Enviadas** (eu contrato) e **Recebidas** (me convidaram), e mostra só as que a empresa usa. Ela aparece no menu do Daily (ao lado de Painel e Obras) e no menu do Measure (é a mesma tela), e como uma seção na página de cada obra e de cada projeto do Measure.

**Concorrências** (lista)

```
Concorrências                                          [ Nova concorrência ]
[Abertas 1] [Para fechar 0] [Fechadas 1] [Todas]

Serviço            Obra                    Prazo        Convidados  Propostas  Situação
Framing e drywall  Edifício Atlântico      24/10 (5 d)  3           2 de 3     Aberta
Siding             Residencial Jardim      —            2           2          Fechada · Northfield
```

**Nova concorrência** (um formulário em blocos, como o cadastro da obra)

| Bloco | Campos |
| --- | --- |
| Serviço | Obra\* (das obras da construtora), nome do serviço\*, etapas a cotar\* (cost codes, ex.: 06 10 00 Rough Carpentry, 09 21 16 Gypsum Board) |
| Escopo | **Incluso\*** e **Excluso** (em itens); observações |
| Desenhos | PDFs (as folhas vão para o projeto do Measure de quem cotar) |
| Prazos | Prazo da proposta\* (data e hora), início e término previstos do serviço |
| Orçamento | Valor (opcional) e **o que mostrar**: não mostrar (padrão) · o total · por etapa (CO-03) |
| Exigências | Seguro mínimo (GL, workers' comp), licença, visita à obra (sim/não, data) |
| Convidados\* | Contatos com o marcador subempreiteiro que fazem as etapas escolhidas (os outros num "mostrar todos"). Cada um diz **Tem KORbuild** ou **Recebe por link** (CO-07). |

Botões: **Salvar rascunho** e **Enviar convites**.

**Concorrência** (página, com abas)

```
Framing e drywall · Edifício Atlântico               Aberta · prazo 24/10 18:00
[Convidados] [Perguntas 2] [Comparar] [Detalhes]           [ Prorrogar ] [ Cancelar ]

Northfield Framing & Siding   KORbuild   Proposta rev. 1 · US$ 186.400 · 20/10
Bayside Drywall       link       Proposta rev. 1 · US$ 61.500 (só drywall) · 21/10
Pine Ridge Builders           link       Não vai participar · "agenda cheia"
                                                            [ Convidar mais ]
```

- **Perguntas:** o canal da concorrência (§5), com as dúvidas de todos.
- **Comparar** (*bid leveling*): uma coluna por proposta, uma linha por etapa; o total, o prazo de execução, as exclusões e as exigências atendidas (seguro, licença, visita). Destaca o menor valor de cada linha e marca **etapa não cotada** e **exclusão que está no escopo**, para a construtora perguntar antes de fechar. **Fechar com esta** em cada coluna.
- **Detalhes:** o que foi enviado, com o histórico (prorrogações, convidados a mais, adendos).

**Fechar** (confirmação): proposta e revisão escolhidas, valor, observação. Depois de confirmar, a concorrência fica **Fechada** e não muda mais (CO-06).

### 3.2 Convidada (prestadora)

Os convites aparecem no **sininho** e em **Concorrências › Recebidas** (é lá que ela cota). Uma prestadora sem o Measure no plano vê o convite pelo sininho e responde como pelo link (anexa o PDF).

**Convite** (página)

```
Convite para cotar · Construtora Exemplo                    Prazo 24/10 18:00 (5 dias)
Framing e drywall · Edifício Atlântico · Manchester, NH
Etapas: 06 10 00 Rough Carpentry · 09 21 16 Gypsum Board
Incluso: …          Excluso: …          Exigências: GL US$ 1M, workers' comp
Desenhos: A-101, A-201, A-301
Orçamento da construtora: não informado

[ Vou cotar ]  [ Não vou participar ]                     Perguntas (2)  [ Perguntar ]
```

- **Vou cotar** cria o projeto no Measure (*Em orçamento*, cliente = a construtora, prazo = o da concorrência, folhas = os desenhos) e leva até ele. O projeto mostra uma faixa: *Concorrência da Construtora Exemplo · prazo 24/10 · Perguntas*.
- Na **Proposta** do Measure, quando o projeto veio de uma concorrência, ao lado de **Emitir** aparece **Enviar pela plataforma**. Emite como hoje (P-AAAA-NNN, congelada) e entrega a revisão à construtora. Uma etapa da concorrência sem linha na proposta vai como **não cotada**.

### 3.3 Prestadora sem conta (link, CO-07)

Uma página só, aberta pelo link pessoal do convite, sem menu e sem login: o convite (como acima), **Vou cotar / Não vou**, **Perguntas** e **Enviar proposta** com PDF anexo, total, total por etapa (opcional), prazo de execução e exclusões. No rodapé: *Crie sua conta para medir e orçar no KORbuild* (com o mesmo e-mail, tudo vem junto).

### 3.4 Depois do fechamento

- **Na construtora:** a obra mostra a prestadora em **Prestadoras na obra** (já existe), com o botão **Canal**.
- **Na prestadora:** a obra nova (ligada) mostra o **Canal** com a construtora.
- O canal é o mesmo: as perguntas da concorrência ficam como o começo da conversa (só as que essa prestadora via).

### 3.5 Quarteirização (prestadora → prestadora)

A prestadora abre uma concorrência por dois caminhos:

| De onde | Quando | O que acontece |
| --- | --- | --- |
| **Projeto do Measure** (em orçamento) | Antes de mandar a própria proposta: cota uma parte com as suas prestadoras (ex.: a Northfield cota o drywall com a Bay State) | A concorrência nasce com as etapas escolhidas do projeto, as folhas e o prazo (que precisa ser **antes** do prazo dela). Na comparação, **Usar no meu orçamento** leva o preço escolhido para o projeto como linha de **subempreiteiro** (categoria que o Measure já tem), por etapa. O fechamento fica para depois de ela ganhar (CO-24). |
| **Obra** (já contratada) | Depois de ganhar: passa uma parte do serviço adiante | A concorrência nasce da obra dela; quem ganha fica ligado à obra **dela**, não à da construtora. |

Na tela da concorrência da prestadora aparece de onde veio: *Edifício Atlântico · para a Construtora Exemplo*. O escopo e os desenhos que ela repassa são os que ela escolhe; nada da concorrência original (valores, outros convidados) passa adiante.

## 4. Situações

**Concorrência:** `rascunho` → `aberta` (convites enviados) → `para fechar` (prazo vencido; até lá, as convidadas ainda mandam revisões, e a contratante pode fechar antes se quiser) → `fechada` (com a vencedora) ou `cancelada`. **Prorrogar** volta de *para fechar* para *aberta* com o novo prazo.

**Convite:** `enviado` → `visto` → `vai cotar` ou `não vai participar` → `proposta enviada` (rev. 1, 2…) → `vencedora` ou `não escolhida`. Se a concorrência é cancelada: `cancelada`.

## 5. Canal contratante ↔ contratada

Um canal de conversa entre as duas empresas de cada elo (construtora e prestadora, ou prestadora e prestadora), que **nasce no convite** e **continua depois do fechamento**, durante toda a obra.

- **Antes do fechamento (*RFI*):** a prestadora pergunta; a construtora responde e escolhe, em cada resposta, **para todos os convidados** (a pergunta vai junto, sem dizer quem perguntou) ou **só para quem perguntou**.
- A construtora também pode mandar um **aviso a todos** (ex.: *adendo nº 1: nova folha A-102*). Um adendo com desenho novo entra no projeto do Measure de quem está cotando.
- **Depois do fechamento:** o mesmo canal vira a conversa da obra: dúvidas de projeto, mudanças, avisos. Cada mensagem pode ter anexo (foto, PDF).
- Os avisos chegam no **sininho**. Nada se apaga nem se edita: o canal é o registro do que foi combinado.
- No futuro, uma mensagem pode virar um item formal (pedido de mudança, *change order*), sem sair do canal.

## 6. Regras

| # | Regra |
| --- | --- |
| CO-01 | **Os dois caminhos convivem.** Construtora fora do KORbuild: a prestadora continua mandando a proposta por e-mail (PDF), como hoje. Construtora no KORbuild: tudo pela plataforma. |
| CO-02 | A concorrência fica **no plano** da construtora (não é um módulo à parte). |
| CO-03 | **Mostrar o orçamento é parâmetro** de cada concorrência: *não mostrar* (padrão), *mostrar o total* ou *mostrar por etapa*. A empresa define o padrão em Settings. |
| CO-04 | Cada prestadora só vê **o próprio convite, a própria proposta** e as mensagens mandadas para ela ou para todos. Nunca vê quem mais foi convidado nem os valores dos outros. |
| CO-05 | Proposta enviada não se edita: uma nova é uma **revisão** (rev. 1, rev. 2…), com histórico. A comparação usa a revisão mais recente de cada uma. |
| CO-06 | O fechamento fica registrado (quem, quando, valor, revisão aceita) e é o que **sela o vínculo**. Concorrência fechada não muda mais. |
| CO-07 | Prestadora **sem conta no KORbuild** cota por um **link**: vê o convite, os desenhos e o escopo, responde, pergunta e envia a proposta (PDF e valores). Ao criar a conta com o mesmo e-mail, o histórico vem junto. |
| CO-08 | Enviar convites exige obra, serviço, pelo menos uma etapa, o escopo incluso, o prazo (no futuro) e pelo menos um convidado. |
| CO-09 | Depois de enviada, a concorrência só muda por **prorrogação do prazo**, **convidados a mais** ou **adendo** (aviso a todos); tudo fica no histórico e avisa os convidados. Escopo e etapas não se reescrevem: quem muda é o adendo. |
| CO-10 | A proposta só pode ser enviada **até o prazo**. Depois dele, só se a construtora prorrogar. |
| CO-11 | A construtora vê os valores **assim que chegam** (prática comum em obra privada nos EUA). O "envelope fechado" está em *A confirmar*. |
| CO-12 | **Comparar** usa as etapas da concorrência como linhas; etapa sem preço aparece como *não cotada*, nunca como zero. |
| CO-13 | Fechar exige uma proposta enviada. Ao fechar: a vencedora vira `vencedora`; as outras com proposta, `não escolhida`; as demais ficam como estão. Todas são avisadas; nenhuma vê o valor da vencedora. |
| CO-14 | **Vínculo:** ao fechar com uma prestadora com conta, o projeto dela vira *Ganha* e **Criar obra a partir deste projeto** já vem com a ligação à obra da construtora (`vinculo`). Prestadora pelo link: a ligação nasce quando ela cria a conta. |
| CO-15 | Cancelar exige um motivo e avisa os convidados; os projetos deles no Measure ficam (passam para *Perdida* só se eles quiserem). |
| CO-16 | Uma prestadora só é convidada uma vez por concorrência. Uma obra pode ter várias concorrências (uma por serviço); o mesmo serviço pode ter outra concorrência depois de cancelada. |
| CO-17 | **Valores na construtora:** os valores das propostas são vistos por quem tem a permissão de concorrências (§8). A visão gerencial (HS-10) continua sem os custos da prestadora: a proposta é preço, não custo. |
| CO-18 | Toda ação (enviar, prorrogar, convidar, responder, enviar proposta, fechar, cancelar) vai para a **auditoria** da empresa que fez. |
| CO-19 | **Qualquer empresa pode ser contratante:** construtora, prestadora ou as duas. As telas, as situações e as regras são as mesmas; muda só quem está de cada lado. |
| CO-20 | **Quem contrata aprova** o diário da contratada e recebe o cronograma dela (generaliza HS-11 e HS-12). A construtora não aprova o diário de quem foi quarteirizado; a prestadora que contratou aprova. |
| CO-21 | **Presença na obra sobe a cadeia inteira:** a construtora vê, sem valores, quem está no canteiro de todas as empresas abaixo dela (nome, empresa, entrada, horas), agrupado pela contratada direta (*Northfield › Bay State Drywall*). Diários e cronogramas, só da contratada direta. |
| CO-22 | **Valores não atravessam elos:** cada empresa vê só os preços das propostas que recebeu e das que mandou. |
| CO-23 | **Quarteirização na concorrência:** a contratante diz, em cada concorrência, se a contratada pode quarteirizar: *permitida* (padrão), *com a minha aprovação* (a contratante aprova cada empresa quarteirizada antes do fechamento dela) ou *não permitida*. |
| CO-24 | Uma concorrência aberta a partir de um **projeto em orçamento** pode receber propostas e ter os preços usados no orçamento, mas só pode **fechar** depois que o projeto vira *Ganha* e a obra é criada a partir dele (a contratada fica ligada a essa obra). Se o projeto vira *Perdida*, a concorrência é cancelada e os convidados são avisados. |
| CO-25 | O prazo de uma concorrência aberta a partir de um projeto precisa vencer **antes** do prazo da proposta desse projeto. |

## 7. Estrutura de dados no protótipo

Fica no aparelho, **fora das empresas**, num lugar comum como os `compartilhados` (no produto: tabelas no servidor, com acesso por empresa). Um arquivo novo, `js/concorrencias.js`, entrega a cada empresa só o que ela pode ver (CO-04), como `diariosDeFora()` faz com os diários.

```
banco.concorrencias: [{
  id, contratanteId (empresa que contrata: construtora ou prestadora),
  origem: { tipo: 'obra' | 'projeto', id },          // obra da contratante, ou projeto do Measure (CO-24)
  obraId, servico, etapas: [costCode],
  quarteirizacao: 'permitida' | 'com-aprovacao' | 'nao-permitida',   // CO-23
  incluso: [texto], excluso: [texto], observacoes, desenhos: [{ nome, arquivoId }],
  prazo, inicio, termino,
  orcamento: { valor, porEtapa: { costCode: valor }, mostrar: 'nao' | 'total' | 'etapa' },
  exigencias: { glMinimo, wcObrigatorio, licenca, visita: { obrigatoria, data } },
  situacao: 'rascunho' | 'aberta' | 'para-fechar' | 'fechada' | 'cancelada',
  criadaPor, criadaEm, historico: [{ em, por, acao, detalhe }],
  convites: [{
    id, contatoId, empresaId | null, email, token (link, CO-07),
    situacao, motivo, vistoEm, respondidoEm, projetoId (no Measure da prestadora),
    propostas: [{ rev, numero (P-AAAA-NNN), enviadaEm, por, total,
                  porEtapa: { costCode: valor }, prazoExecucaoDias, exclusoes: [texto], pdf }]
  }],
  fechamento: { conviteId, rev, valor, por, em, observacao } | null
}]

concorrencia.mensagens: [{                         // o canal fica na própria concorrência
  id, em, conviteId (a conversa de um convite; null = aviso a todos), de: 'contratante' | 'convidada', autor, texto,
  publica (todas as convidadas veem), respostaDe (a pergunta respondida), aviso
}]
```

- Uma resposta **para todos** marca a pergunta e a resposta como públicas: as outras convidadas veem as duas, com a pergunta como "Pergunta de um convidado" (sem o nome). Depois do fechamento, a conversa da vencedora é o **canal da obra**, nas páginas da obra das duas empresas. Os anexos nas mensagens ficam para depois.
- No projeto do Measure: `concorrencia: { id, conviteId, contratanteId }`. Na obra criada: `vinculo` (já existe) + `concorrenciaId`.
- Na quarteirização, o `vinculo` da obra da Bay State aponta para a obra da **Northfield**. A cadeia se descobre seguindo os vínculos; para a presença na obra (CO-21), a construtora sobe a cadeia até a própria obra.
- Linha do Measure vinda de uma proposta recebida: `{ categoria: 'subempreiteiro', costCode, valor, origem: { concorrenciaId, conviteId, rev } }`.
- **Contato com conta:** um contato que também é uma empresa no KORbuild tem `contaId` (no protótipo, Northfield, Ridgeline e a Construtora Exemplo). Convite para contato com conta chega na plataforma; sem conta, vai pelo link (CO-07). No produto, a ligação nasce quando a prestadora aceita o convite ou cria a conta com o mesmo e-mail.
- `VERSAO_DADOS` 28; os dados de exemplo têm o cenário do §9.

## 8. Permissões

| Permissão | Grupo | O que libera | Perfis prontos |
| --- | --- | --- | --- |
| **Fazer concorrências e fechar** | Concorrências (qualquer empresa) | Criar, enviar, prorrogar, comparar, fechar, cancelar; ver os valores. | Administrador, Gestor de obras |
| **Responder convites e enviar propostas** | Concorrências (prestadora) | Ver convites, Vou cotar / Não vou, enviar pela plataforma. Inclui *Medir plantas*. | Administrador, Gestor de obras |
| **Canal da obra** | Daily | No protótipo, sem permissão própria: o canal aparece na página da obra, para quem já abre a obra (*Acompanhar todas as obras*). | Administrador, Gestor de obras (Encarregado: ver *A confirmar*) |

As permissões só aparecem para a atuação certa (como hoje o Crew some para a construtora).

## 9. Cenário de demonstração

Na **Construtora Exemplo**, uma concorrência **aberta**: *Framing e drywall* no **Edifício Atlântico**, prazo daqui a 5 dias, com três convidados:

| Convidado | Como | Situação no exemplo |
| --- | --- | --- |
| **Northfield Framing & Siding** | KORbuild | Vai cotar; projeto no Measure com as folhas; proposta rev. 1 enviada |
| **Bayside Drywall** | Link | Vai cotar; proposta pelo link (PDF e total) |
| **Pine Ridge Builders** | Link | Não vai participar ("agenda cheia") |

E duas perguntas no canal: uma respondida para todos, uma só para a Northfield.

**Quarteirização:** a **Northfield** abriu, a partir da obra dela no Jardim, a concorrência *Drywall das casas* e convidou a **Bay State Drywall** (link), que já viu o convite. A construtora não vê nada disso. (No protótipo, o "Usar no meu orçamento" leva o preço como **outros itens** da proposta, não como linha de subempreiteiro do catálogo.) A concorrência do **siding do Residencial Jardim** aparece como **fechada** com a Northfield (é a ligação que já existe nos dados de exemplo).

Roteiro para apresentar (vai para o guia do apresentador): Ana abre a concorrência e compara → Tom vê o convite, cota o drywall com a Bay State e manda a rev. 2 → Ana fecha → Tom cria a obra ligada, fecha com a Bay State e o canal continua nos dois elos.

## 10. Fatias de entrega

| Fatia | O que entra | Testes |
| --- | --- | --- |
| 1 ✓ | `js/concorrencias.js` (modelo, situações, regras CO-04/05/08/09/10/12/13/15/16/18/19, visão por empresa e pelo link), dados de exemplo, permissões | `tests/concorrencias.test.mjs` (50): criar, enviar, responder, revisões, prazo e prorrogação, comparar, fechar, cancelar, isolamento entre empresas, prestadora contratante |
| 2 ✓ | Telas da contratante: lista com abas, nova concorrência (rascunho e envio), página com Convidados, Comparar e Detalhes, prorrogar, convidar mais, fechar, cancelar; seção na página da obra | Navegador (Ana; Laura entra, Carlos não) |
| 3 ✓ | Lado da convidada: Measure › Convites, o convite (visto), Vou cotar → projeto no Measure com a faixa da concorrência, Não vou participar com motivo, Enviar pela plataforma (etapas, outros itens, não cotadas), fechada → projeto *Ganha* → obra ligada à da contratante | Navegador (Tom e Ana), ponta a ponta |
| 4 ✓ | Canal: aba Perguntas (uma conversa por convidada, responder para todas ou só para quem perguntou, aviso a todos), conversa no convite, canal da obra depois do fechamento; sininho das duas empresas | Unidade + navegador, as duas empresas |
| 5 ✓ | Quarteirização: concorrência a partir do projeto (Measure › projeto › Cotar com prestadoras) ou da obra, **Usar no meu orçamento** (o preço entra na proposta do projeto como outros itens, com as margens da prestadora), CO-23 (não permitida bloqueia o envio; com aprovação, o fechamento vira um pedido que a contratante de cima aprova ou recusa, vendo só o nome), CO-24, CO-25, presença da cadeia na obra da construtora (CO-21) | Unidade + navegador, três empresas |
| 6 ✓ | Link sem conta (página única, sem login; no protótipo, "Copiar o link" no lugar do e-mail; do PDF, guarda o nome); inglês. Portal (EN e PT) e guia do apresentador a seguir | Navegador + teste EN |

A fatia 1 já nasce genérica (contratante é qualquer empresa), para a quarteirização não exigir refazer o modelo.

## 11. A confirmar

- **Envelope fechado:** a construtora só vê os valores depois do prazo (comum em obra pública). Hoje: vê na hora (CO-11); poderia ser uma opção por concorrência.
- **Encarregado no canal:** só lê, lê e escreve, ou não vê.
- **Visita à obra** obrigatória: só um campo informativo, ou a construtora marca quem foi.
- **Convidar quem não está nos Contatos**, digitando só o e-mail (cria o contato junto?).
- **Padrão da quarteirização** (CO-23): *permitida* ou *com a minha aprovação*. Em contratos americanos é comum exigir aprovação dos *sub-tier subcontractors*.
- **Presença da cadeia** (CO-21): a construtora vê as pessoas de quem foi quarteirizado (proposta: sim, por segurança e acesso ao canteiro), e se vê também os diários delas (proposta: não, só da contratada direta).
- **Mais de uma vencedora** (dividir o serviço entre duas prestadoras, por etapa).
