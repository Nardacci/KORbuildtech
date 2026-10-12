# Regras de negócio

Cada regra tem um código (`CO-nnn`) para ser citada em reuniões, testes e pedidos de mudança. A coluna **Situação** diz se a regra já funciona no protótipo.

!!! note "Origem"
    Estas regras vêm do código do protótipo e da especificação das concorrências na documentação do projeto. Os pontos em aberto estão marcados como **A confirmar** no fim.

## Quem contrata quem

| Código | Regra | Situação |
|---|---|---|
| CO-01 | **Os dois caminhos convivem.** A prestadora cujo cliente não está no KORbuild continua mandando a proposta por e-mail (PDF); com o cliente no KORbuild, tudo vai pela plataforma. | Funcionando |
| CO-02 | As concorrências vêm **com o plano**, não são um módulo à parte. | Funcionando |
| CO-19 | **Qualquer empresa pode ser contratante**: construtora ou prestadora. Telas, situações e regras são as mesmas. | Funcionando |
| CO-20 | **Quem contrata aprova.** O diário e o cronograma de uma empresa quarteirizada vão para quem a contratou, não para a construtora. | Funcionando |
| CO-22 | **Os valores não atravessam elos.** Cada empresa vê só as propostas que recebeu e as que mandou. | Funcionando |

## O pacote e os convites

| Código | Regra | Situação |
|---|---|---|
| CO-03 | **Mostrar o orçamento é escolha** de cada concorrência: não mostrar (padrão) ou mostrar o total. | Funcionando (por etapa: só no motor) |
| CO-08 | Enviar exige a obra (ou o projeto, quando é cotação para o próprio orçamento), o serviço, pelo menos uma etapa, o escopo incluso, um prazo no futuro e pelo menos um convidado. | Funcionando |
| CO-09 | Depois de enviada, a concorrência só muda por **prorrogação do prazo**, **convidados a mais** ou **aviso a todos** (adendo). Tudo vai para o histórico. | Funcionando |
| CO-16 | Uma empresa é convidada só uma vez por concorrência. Uma obra pode ter várias concorrências (uma por serviço). | Funcionando |
| CO-07 | A prestadora **sem conta** cota por um **link pessoal**: vê o convite, responde, pergunta e manda o PDF com o total. O link abre só aquele convite. | Funcionando |

## Quem vê o quê

| Código | Regra | Situação |
|---|---|---|
| CO-04 | Cada convidada vê **só o próprio convite, as próprias propostas** e as mensagens mandadas para ela ou para todas. Nunca quem mais foi convidado nem os valores dos outros. | Funcionando |
| CO-11 | A contratante vê os valores **assim que chegam** (comum em obra privada). | Funcionando |
| CO-17 | Os valores das propostas são vistos por quem tem *Fazer concorrências e fechar*. A visão gerencial da obra (equipe no canteiro) não mostra valores. | Funcionando |

## Propostas, prazo e comparação

| Código | Regra | Situação |
|---|---|---|
| CO-05 | Proposta enviada não se edita: uma nova é uma **revisão** (rev. 1, rev. 2…). A comparação usa a revisão mais recente de cada empresa. | Funcionando |
| CO-10 | As propostas são aceitas **até o prazo**. Depois dele, a concorrência fica *Para fechar* e só uma prorrogação reabre. | Funcionando |
| — | A proposta vinda do Measure vai **por etapa**: as linhas com o código de uma etapa da concorrência vão para essa etapa; as outras linhas e os outros itens vão como **outros itens**. O total precisa ser a soma. | Funcionando |
| CO-12 | **Comparar**: uma linha por etapa, uma coluna por proposta. Etapa sem preço é **não cotada**, nunca zero. O menor valor de cada linha fica destacado; exclusão que bate com o escopo incluso fica marcada. | Funcionando |

## Fechamento e cancelamento

| Código | Regra | Situação |
|---|---|---|
| CO-06 | O fechamento fica registrado (quem, quando, valor, revisão aceita) e a concorrência não muda mais. | Funcionando |
| CO-13 | Fechar exige uma proposta enviada. A vencedora fica *Vencedora*; as outras com proposta ficam *Não escolhida* e são avisadas, sem o valor da vencedora. | Funcionando |
| CO-14 | **Ligação da obra:** o projeto da vencedora no Measure vira *Ganha*; a obra criada a partir dele **já nasce ligada** à obra da contratante. | Funcionando |
| CO-15 | Cancelar exige um motivo e avisa as convidadas. Um rascunho é só apagado. | Funcionando |
| CO-18 | Toda ação vai para a **auditoria** da empresa que fez. | Funcionando |

## O canal

| Código | Regra | Situação |
|---|---|---|
| — | Uma conversa por convidada. A resposta vai **para todas as convidadas** (a pergunta vai junto, sem dizer quem perguntou) ou **só para quem perguntou**. O **aviso a todos** chega a todas. | Funcionando |
| — | Depois do fechamento, a conversa da vencedora é o **canal da obra**, na página da obra das duas empresas. Com as outras, a conversa para. Nada se edita nem se apaga. | Funcionando |
| — | O sininho mostra: propostas recebidas, recusas, mensagens e prazos (contratante); convites, prorrogações, respostas e o resultado (convidada). | Funcionando |

## Quarteirização

| Código | Regra | Situação |
|---|---|---|
| CO-21 | **A presença sobe a cadeia inteira**: a construtora vê quem está na obra de todas as empresas abaixo dela, marcadas com quem as contratou, sem valores. Diários e cronogramas, só da contratada direta. | Funcionando |
| CO-23 | Cada concorrência diz se a contratada pode quarteirizar: **permitida** (padrão), **com a minha aprovação** (a contratante de cima aprova a empresa escolhida, vendo só o nome) ou **não permitida** (a quarteirização não é enviada). | Funcionando |
| CO-24 | A concorrência aberta a partir de um **projeto em orçamento** recebe propostas e tem os preços usados no orçamento, mas só fecha depois que o projeto é **ganho** e a obra é criada. Projeto **perdido** cancela as concorrências dele. | Funcionando |
| CO-25 | Cotando a partir do projeto, o prazo precisa vencer **antes** do prazo da proposta do próprio projeto. | Funcionando |

!!! confirm "A confirmar"
    - **Envelope fechado**: valores visíveis só depois do prazo.
    - Se o **encarregado** vê o canal da obra.
    - Se a visita à obra é só informativa ou se a contratante marca quem foi.
    - Convidar uma empresa que **não está nos Contatos**, só pelo e-mail.
    - **Dividir o fechamento** entre duas prestadoras, por etapa.
    - O padrão da quarteirização: *permitida* ou *com a minha aprovação*.
