# KORbuild — Concorrências (bid) e canal construtora ↔ prestadora

> Proposta de outubro de 2026, para o esquema do banco de dados. Ainda **não está no protótipo**: precisa de um servidor, porque as duas empresas se encontram num lugar comum.

## 1. A ideia

A construtora manda a obra para a sua lista de prestadoras, com as informações, os desenhos e o detalhamento do serviço. As prestadoras confirmam se vão participar e mandam proposta. A construtora compara, escolhe a melhor e fecha negócio. Daí em diante, as duas ficam **ligadas** naquela obra, com um **canal** de conversa entre elas.

No mercado americano: *invitation to bid* (ITB), *bid package*, *bid leveling* (comparação) e *award* (fechamento).

## 2. Fluxo

| # | Quem | O quê |
| --- | --- | --- |
| 1 | Construtora | Monta a **concorrência** de um serviço (framing, drywall…): dados da obra, desenhos (PDF), escopo (incluso e excluso), prazo da proposta e, se quiser, o orçamento (ver CO-03). |
| 2 | Construtora | Escolhe os convidados na lista de **Contatos** (marcador prestadora + o que faz) e envia. |
| 3 | Prestadora | Responde: **vou cotar** ou **não vou participar** (com motivo opcional). |
| 4 | Prestadora | Quem cota recebe um **projeto no Measure** já criado, com os desenhos e as partes preenchidas. Mede, aplica preços e **envia a proposta pela plataforma** (o PDF vai junto). |
| 5 | As duas | Dúvidas durante a concorrência pelo **canal** (ver §4). |
| 6 | Construtora | **Compara** as propostas lado a lado: total, por etapa (cost code), prazo, exclusões, seguros e licenças. |
| 7 | Construtora | **Fecha** com uma. As outras são avisadas (sem ver o valor da vencedora). |
| 8 | As duas | **Vínculo selado**: na prestadora, o projeto vira *Ganha* e a obra é criada (docs/obras.md OB-07), já ligada à obra da construtora (docs/cronograma.md CR-10). |

## 3. Regras

| # | Regra |
| --- | --- |
| CO-01 | **Os dois caminhos convivem.** Construtora fora do KORbuild: a prestadora continua mandando a proposta por e-mail (PDF), como hoje. Construtora no KORbuild: tudo pela plataforma. |
| CO-02 | A concorrência fica **no plano** da construtora (não é um módulo à parte). |
| CO-03 | **Mostrar o orçamento é parâmetro** de cada concorrência: *não mostrar* (padrão), *mostrar o total* ou *mostrar por etapa*. A empresa define o padrão em Settings. |
| CO-04 | Cada prestadora só vê **a própria proposta** e as respostas que foram mandadas para ela ou para todos. Nunca vê quem mais foi convidado nem os valores dos outros. |
| CO-05 | Proposta enviada não se edita: uma nova é uma **revisão** (rev. 1, rev. 2…), com histórico. |
| CO-06 | O fechamento fica registrado (quem, quando, valor, revisão aceita) e é o que **sela o vínculo**. |
| CO-07 | Prestadora **sem conta no KORbuild**: decisão pendente (ver §6). |

## 4. Canal construtora ↔ prestadora

Um canal de conversa entre as duas empresas, que **nasce no convite** e **continua depois do fechamento**, durante toda a obra.

- **Antes do fechamento (dúvidas da concorrência, *RFI*):** a prestadora pergunta; quem responde escolhe, em cada resposta, **para todos os convidados** (sem dizer quem perguntou) ou **só para quem perguntou**.
- **Depois do fechamento:** o mesmo canal vira a conversa da obra: dúvidas de projeto, mudanças, avisos. Cada mensagem pode ter anexo (foto, PDF).
- Os avisos chegam no **sininho** (e no celular, no app). Nada se apaga: o canal é o registro do que foi combinado.
- No futuro, uma mensagem pode virar um item formal (pedido de mudança, *change order*), sem sair do canal.

## 5. No banco de dados

```
concorrencias:   id, empresa (construtora), obraId, servico, escopo, desenhos[], prazoProposta,
                 orcamento + visibilidade (CO-03), situacao (aberta, encerrada, fechada)
convites:        concorrenciaId, prestadora (empresa ou e-mail), situacao (enviado, vai cotar,
                 não vai participar), projetoId (no Measure da prestadora)
propostas:       conviteId, revisao, total, porEtapa[], prazo, exclusoes, pdf, enviadaEm
fechamento:      concorrenciaId, conviteId, revisao, por, em
ligacoes:        obra da construtora ↔ obra da prestadora (nasce do fechamento)
canal/mensagens: entre as duas empresas, por concorrência ou obra; para todos ou só um (CO, §4); anexos
publicacoes:     o que uma empresa entrega à outra (cronograma; depois, diários)
```

## 6. Decisões pendentes

- **CO-07 — prestadora sem conta.** Opções: (a) cota por um **link**, sem conta, e é convidada a criar a conta depois; (b) precisa **criar conta** (pode haver um plano gratuito só para receber convites e responder). Sugestão: (a), porque tira o atrito da primeira vez e traz a prestadora para dentro aos poucos.
