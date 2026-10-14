# Uma conta de verdade com dados de exemplo

O KORbuild tem uma **massa de dados de exemplo** numa conta de verdade: três construtoras, seis prestadoras que trabalham para elas e três prestadoras independentes, sem construtora. Tudo é fictício (nomes, endereços e e-mails `example.com`) e nenhum e-mail sai. Serve para ver as telas com movimento, e não listas vazias. As páginas abaixo mostram o que um cliente vê num dia comum de trabalho.

## A construtora: Northfield Builders

O painel conta os diários do dia, os que aguardam aprovação e as obras que não relataram. A caixa vermelha aponta a obra sem o diário do último dia útil e quem é o responsável.

![O painel da construtora: diários do dia, aguardando aprovação, obras atrasadas](img/live-gc-dashboard.png)

Os diários de todas as prestadoras da obra chegam em **Aprovações**.

![Aprovações: diários esperando o escritório](img/live-gc-approvals.png)

Abrir um diário mostra o clima, a equipe, os equipamentos, o serviço executado e o **registro de fotos**. Cada foto leva o horário, a posição GPS e a impressão digital do arquivo original. Aprovar sela o diário: ele não muda mais.

![Um diário aguardando aprovação, com três fotos](img/live-gc-review.png)

![Obras: cada uma com as prestadoras que trabalham nela](img/live-gc-jobs.png)

## Concorrências entre empresas

Uma concorrência com duas propostas, niveladas por código de custo. O menor valor de cada linha fica em verde e um código não cotado nunca conta como zero.

![Nivelamento de duas propostas lado a lado](img/live-gc-bid-leveling.png)

## A prestadora: Summit Framing

O **cronograma** tem quatro etapas, uma linha de base, a previsão de término e a versão que a construtora vê. O avanço vem dos diários aprovados.

![O cronograma de uma obra com avanço, linha de base e previsão](img/live-schedule.png)

O **Crew** mostra quem está trabalhando agora e as batidas fora da cerca da obra. Cada item de revisão abre o dia com um toque.

![Quem está trabalhando agora, com batidas fora da obra para revisar](img/live-crew-now.png)

![Folhas de ponto aguardando aprovação](img/live-crew-timesheets.png)

## Measure

Uma prestadora de construtora e uma independente, cada uma com projetos em etapas diferentes: em orçamento, proposta enviada.

![Projetos de uma prestadora de revestimento](img/live-measure-projects.png)

![Projetos de uma empresa de pintura independente](img/live-measure-independent.png)

## A visão da equipe do KORbuild

Na administração da plataforma as empresas de exemplo levam a etiqueta **Demo**. A lista também mostra uma empresa com teste vencido, uma com teste terminando em 6 dias e uma suspensa.

![Administração da plataforma: doze empresas de exemplo](img/live-platform-admin-companies.png)

## Como entrar

Os usuários de exemplo seguem o padrão `demo.<empresa>.<papel>@example.com`. A senha é combinada em particular com a equipe e nunca é publicada aqui. Veja `docs/massa-demo.md` no repositório para a lista completa e como carregar ou remover os dados.
