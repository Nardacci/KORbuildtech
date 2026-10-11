# KORbuild — Concorrências (bid) e canal construtora ↔ prestadora

> Especificação de outubro de 2026. Versão 2: desenho das telas, estrutura e regras **para o protótipo**. A versão 1 dizia que precisava de servidor; no protótipo, as duas empresas já se encontram no aparelho (como o cronograma publicado em `compartilhados()` e os diários em `diariosDeFora()`), então a concorrência pode ser simulada do mesmo jeito. No produto, esse lugar comum é o servidor.
>
> **Situação:** especificação. Nada disto está no protótipo ainda (ver §10, fatias).

## 1. A ideia

A construtora manda um serviço da obra para a sua lista de prestadoras, com as informações, os desenhos e o escopo. As prestadoras confirmam se vão participar e mandam proposta. A construtora compara, escolhe a melhor e fecha negócio. Daí em diante, as duas ficam **ligadas** naquela obra, com um **canal** de conversa entre elas.

No mercado americano: *invitation to bid* (ITB), *bid package*, *bid leveling* (comparação), *RFI* (dúvida) e *award* (fechamento).

**O que fecha o ciclo:** o fechamento cria a **mesma ligação de obra** (`vinculo {empresaId, obraId}`) que já existe hoje. A partir dela, tudo o que já funciona entre as empresas passa a valer sozinho: a construtora aprova os diários da prestadora (HS-11), vê a equipe na obra sem valores (HS-10) e recebe o cronograma publicado (SET-057).

## 2. Fluxo

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

### 3.1 Construtora

A concorrência fica no plano da construtora (CO-02), não é um módulo à parte. Ela entra como **Concorrências** no menu do Daily da construtora (ao lado de Painel e Obras) e como uma seção na página de cada obra.

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
Granite State Interiors       link       Proposta rev. 1 · US$ 179.900 · 21/10
Pine Ridge Builders           link       Não vai participar · "agenda cheia"
                                                            [ Convidar mais ]
```

- **Perguntas:** o canal da concorrência (§5), com as dúvidas de todos.
- **Comparar** (*bid leveling*): uma coluna por proposta, uma linha por etapa; o total, o prazo de execução, as exclusões e as exigências atendidas (seguro, licença, visita). Destaca o menor valor de cada linha e marca **etapa não cotada** e **exclusão que está no escopo**, para a construtora perguntar antes de fechar. **Fechar com esta** em cada coluna.
- **Detalhes:** o que foi enviado, com o histórico (prorrogações, convidados a mais, adendos).

**Fechar** (confirmação): proposta e revisão escolhidas, valor, observação. Depois de confirmar, a concorrência fica **Fechada** e não muda mais (CO-06).

### 3.2 Prestadora

Os convites aparecem no **sininho** e numa aba **Convites** do Measure (é lá que ela cota). Uma prestadora sem o Measure no plano vê o convite pelo sininho e responde como pelo link (anexa o PDF).

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

## 4. Situações

**Concorrência:** `rascunho` → `aberta` (convites enviados) → `para fechar` (prazo vencido, ou todos responderam) → `fechada` (com a vencedora) ou `cancelada`. **Prorrogar** volta de *para fechar* para *aberta* com o novo prazo.

**Convite:** `enviado` → `visto` → `vai cotar` ou `não vai participar` → `proposta enviada` (rev. 1, 2…) → `vencedora` ou `não escolhida`. Se a concorrência é cancelada: `cancelada`.

## 5. Canal construtora ↔ prestadora

Um canal de conversa entre as duas empresas, que **nasce no convite** e **continua depois do fechamento**, durante toda a obra.

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

## 7. Estrutura de dados no protótipo

Fica no aparelho, **fora das empresas**, num lugar comum como os `compartilhados` (no produto: tabelas no servidor, com acesso por empresa). Um arquivo novo, `js/concorrencias.js`, entrega a cada empresa só o que ela pode ver (CO-04), como `diariosDeFora()` faz com os diários.

```
banco.concorrencias: [{
  id, empresaId (construtora), obraId, servico, etapas: [costCode],
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

banco.canais: [{
  id, construtoraId, prestadoraId (ou conviteId, se pelo link), concorrenciaId, obraId (depois do fechamento),
  mensagens: [{ id, em, de: { empresaId, usuarioId, nome }, texto, anexos: [],
                para: 'todos' | 'um', respostaDe: mensagemId }]
}]
```

- Uma resposta **para todos** fica no canal de quem perguntou e é **copiada** nos canais dos outros convidados como "pergunta de um convidado", com a resposta (sem o nome de quem perguntou).
- No projeto do Measure: `concorrencia: { id, conviteId, construtoraId }`. Na obra criada: `vinculo` (já existe) + `concorrenciaId`.
- `VERSAO_DADOS` sobe; os dados de exemplo ganham o cenário do §9.

## 8. Permissões

| Permissão | Grupo | O que libera | Perfis prontos |
| --- | --- | --- | --- |
| **Fazer concorrências e fechar** | Daily (construtora) | Criar, enviar, prorrogar, comparar, fechar, cancelar; ver os valores. | Administrador, Gestor de obras |
| **Responder convites e enviar propostas** | Measure (prestadora) | Ver convites, Vou cotar / Não vou, enviar pela plataforma. Inclui *Medir plantas*. | Administrador, Gestor de obras |
| **Canal da obra** | Daily | Ler e escrever no canal das obras que acompanha. | Administrador, Gestor de obras (Encarregado: ver *A confirmar*) |

As permissões só aparecem para a atuação certa (como hoje o Crew some para a construtora).

## 9. Cenário de demonstração

Na **Construtora Exemplo**, uma concorrência **aberta**: *Framing e drywall* no **Edifício Atlântico**, prazo daqui a 5 dias, com três convidados:

| Convidado | Como | Situação no exemplo |
| --- | --- | --- |
| **Northfield Framing & Siding** | KORbuild | Vai cotar; projeto no Measure com as folhas; proposta rev. 1 enviada |
| **Granite State Interiors** | Link | Vai cotar; proposta pelo link (PDF e total) |
| **Pine Ridge Builders** | Link | Não vai participar ("agenda cheia") |

E duas perguntas no canal: uma respondida para todos, uma só para a Northfield. A concorrência do **siding do Residencial Jardim** aparece como **fechada** com a Northfield (é a ligação que já existe nos dados de exemplo).

Roteiro para apresentar (vai para o guia do apresentador): Ana abre a concorrência e compara → Tom vê o convite e manda a rev. 2 → Ana fecha → Tom cria a obra ligada e o canal continua.

## 10. Fatias de entrega

| Fatia | O que entra | Testes |
| --- | --- | --- |
| 1 | `js/concorrencias.js` (modelo, situações, regras CO-04/05/08/10/12/13/16, visão por empresa), dados de exemplo, permissões | Unidade: criar, enviar, responder, revisão, prazo, comparar, fechar, isolamento entre prestadoras |
| 2 | Telas da construtora: lista, nova concorrência, página com Convidados e Comparar, fechar | Navegador (Ana) |
| 3 | Lado da prestadora: Convites, Vou cotar → projeto no Measure, Enviar pela plataforma, *Ganha* → obra ligada | Navegador (Tom), ponta a ponta com a 2 |
| 4 | Canal (antes e depois do fechamento) e sininho | Navegador, as duas empresas |
| 5 | Link sem conta (página única), inglês, portal (EN e PT) e guia do apresentador | Navegador + teste EN |

## 11. A confirmar

- **Envelope fechado:** a construtora só vê os valores depois do prazo (comum em obra pública). Hoje: vê na hora (CO-11); poderia ser uma opção por concorrência.
- **Encarregado no canal:** só lê, lê e escreve, ou não vê.
- **Visita à obra** obrigatória: só um campo informativo, ou a construtora marca quem foi.
- **Convidar quem não está nos Contatos**, digitando só o e-mail (cria o contato junto?).
- **Mais de uma vencedora** (dividir o serviço entre duas prestadoras, por etapa).
