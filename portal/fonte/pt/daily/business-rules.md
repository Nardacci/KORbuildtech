# Regras de negócio

Cada regra tem um código (`DLY-nnn`) para ser citada em reuniões, testes e pedidos de mudança. A coluna **Situação** diz se a regra já funciona no protótipo.

!!! note "Origem"
    Estas regras vêm do código do protótipo e das decisões de produto registradas na documentação do projeto (alertas do diário, obras, cronograma). O que ainda não foi decidido está marcado como **A confirmar**.

## Quem faz o diário e quando

| Código | Regra | Situação |
|---|---|---|
| DLY-001 | Cada obra tem **um responsável** pelo diário. Lembretes e alertas vão para essa pessoa. | Funcionando |
| DLY-002 | O diário é obrigatório em cada **dia de trabalho do calendário da obra** (padrão: segunda a sábado). Dia que não é de trabalho não gera alerta; se houver serviço, o diário pode ser feito assim mesmo. | Funcionando |
| DLY-003 | Só obras **em andamento** cobram diário. Obras **paralisadas** ou **concluídas** não aparecem no campo nem geram alerta. A obra também não cobra nada antes da data de início. | Funcionando |
| DLY-004 | O **prazo diário é 18h** do próprio dia. | Funcionando |
| DLY-005 | O dia está **cumprido** quando o diário foi enviado (mesmo que ainda guardado no celular, sem sinal) ou registrado como **Sem atividade**. | Funcionando |
| DLY-006 | **Sem atividade** exige o motivo (chuva, feriado ou folga, obra paralisada, falta de material, greve, outro) e pode ter uma observação. Vale como o diário do dia e para os alertas daquele dia. | Funcionando |

## Alertas

| Código | Regra | Situação |
|---|---|---|
| DLY-010 | Às **16h**, o responsável recebe um lembrete: falta o diário de hoje. | Funcionando (com o app aberto) |
| DLY-011 | Às **18h**, o diário do dia está **atrasado**: o responsável recebe um alerta. | Funcionando (com o app aberto) |
| DLY-012 | Às **8h do dia seguinte**, o escritório vê no Painel e nas notificações cada obra que ficou sem diário no último dia de trabalho, com o responsável. | Funcionando |
| DLY-013 | Os alertas vão para as notificações do app (o sininho) e do celular. **Sem SMS nem e-mail** por enquanto. | Funcionando |
| DLY-014 | O número de pendências do campo (dias atrasados + obras sem o diário de hoje + pedidos de ajuste) aparece na aba **Hoje** e, onde o celular permite, no ícone do app. | Funcionando |

## Diário atrasado

| Código | Regra | Situação |
|---|---|---|
| DLY-020 | Os **últimos 3 dias de trabalho** sem diário aparecem como atrasados e podem ser preenchidos. | Funcionando |
| DLY-021 | O diário enviado depois do prazo é aceito, mas fica marcado **Enviado com atraso** no relatório e no PDF, com a data e a hora do envio e o prazo que passou. | Funcionando |
| DLY-022 | O atraso é medido no **primeiro envio**: reenviar depois de um pedido de ajuste não conta como atraso. | Funcionando |

## Preenchimento

| Código | Regra | Situação |
|---|---|---|
| DLY-030 | O diário só pode ser enviado com: o clima da manhã e da tarde, pelo menos uma pessoa presente na equipe e pelo menos uma atividade descrita. | Funcionando |
| DLY-031 | Um diário sem fotos pode ser enviado, depois de uma confirmação. | Funcionando |
| DLY-032 | O clima vem sozinho, pela localização da obra, para a manhã (7h–12h) e a tarde (13h–17h). Mais de 2 mm de chuva num período o marca como **Impraticável**. Tudo pode ser corrigido à mão; o relatório mostra se o clima foi automático, ajustado ou informado. | Funcionando |
| DLY-033 | **Copiar de um RDO anterior** traz a equipe (as faltas voltam a zero), os equipamentos e as atividades ainda em andamento. Clima, fotos e ocorrências nunca são copiados. | Funcionando |
| DLY-034 | A equipe pode vir das pessoas que bateram ponto na obra naquele dia, no Crew. | Funcionando |
| DLY-035 | Tudo o que é digitado fica guardado no celular na hora, com ou sem sinal. | Funcionando |
| DLY-036 | O diário enviado sem sinal espera numa fila no celular e sobe sozinho, foto por foto, quando a conexão volta. | Funcionando |
| DLY-037 | Uma atividade pode apontar uma etapa do cronograma da obra, com o % concluído. O cronograma só recebe quando o diário é **aprovado**. | Funcionando |

## Fotos como prova

| Código | Regra | Situação |
|---|---|---|
| DLY-040 | Cada foto ganha um carimbo **dentro da imagem** com a obra, a data, a hora e as coordenadas do GPS. | Funcionando |
| DLY-041 | Sem GPS, vale a localização da obra, e o carimbo avisa. | Funcionando |
| DLY-042 | As fotos são reduzidas no celular (cerca de 1.600 px e 300 KB) antes de subir. | Funcionando |
| DLY-043 | Uma impressão digital (SHA-256) do arquivo **original** fica guardada com cada foto. | Funcionando |

## Aprovação e lacre

| Código | Regra | Situação |
|---|---|---|
| DLY-050 | Só quem tem **Aprovar RDO e enviar ao contratante** pode aprovar ou pedir ajustes. | Funcionando |
| DLY-051 | O pedido de ajuste exige o motivo, que aparece no celular do campo. O diário volta para **Ajustes pedidos**. | Funcionando |
| DLY-052 | Na aprovação, todo o conteúdo do diário (inclusive a impressão digital de cada foto) recebe uma impressão digital SHA-256. Os 12 primeiros caracteres viram o **código de verificação**. | Funcionando |
| DLY-053 | O diário aprovado **não pode ser mudado por ninguém**. | Funcionando |
| DLY-054 | Cada diário guarda o histórico: quem começou, quem enviou, quando chegou ao escritório, quem pediu ajustes e quem aprovou. | Funcionando |
| DLY-055 | **A construtora aprova.** Na obra da prestadora ligada a uma obra da construtora, o diário vai para a fila de aprovação da construtora. O diário fica na conta da prestadora, com quem aprovou e a empresa (*Ana Ribeiro (Construtora Exemplo)*). A prestadora não consegue aprovar. | Funcionando |
| DLY-056 | **Nas obras próprias, a prestadora aprova.** Numa obra direto com o dono (sem construtora ligada), o próprio pessoal da prestadora aprova. | Funcionando |
| DLY-057 | Quando a construtora aprova, o % concluído informado no diário vai para o cronograma **da prestadora**. | Funcionando |
| DLY-058 | A construtora não preenche diário: as obras dela são registradas pelas prestadoras que trabalham nelas. | Funcionando |

## Compartilhar com o cliente

| Código | Regra | Situação |
|---|---|---|
| DLY-060 | Só diários **aprovados** podem ser compartilhados. | Funcionando |
| DLY-061 | O cliente abre o relatório por um link, só leitura, **sem conta**. | Funcionando (só no mesmo navegador; veja Situação do protótipo) |
| DLY-062 | Toda vez que o link abre, o lacre é conferido: se o conteúdo mudou depois da aprovação, a página avisa que o documento não bate com o que foi aprovado. | Funcionando |
| DLY-063 | O PDF tem o logo da empresa, a obra, o clima, as tabelas, as fotos com legenda, data e GPS, o lacre e as assinaturas. | Funcionando (impresso pelo navegador) |

## Acompanhamento do escritório

| Código | Regra | Situação |
|---|---|---|
| DLY-070 | **Farol da obra:** verde quando o diário de hoje chegou, amarelo com 1 dia de atraso, vermelho com 2 dias ou mais. | Funcionando |
| DLY-071 | O Painel mostra os diários do dia, os que aguardam aprovação, as obras com diário atrasado e as fotos recebidas hoje. | Funcionando |
| DLY-072 | Para a construtora, o farol, o aviso da manhã seguinte e as notificações são **por prestadora em cada obra**. | Funcionando |
| DLY-073 | Em cada obra, a construtora vê as pessoas de cada prestadora no canteiro: nome, função, horário de entrada, quem está lá agora e as horas. **Nunca salários, encargos ou custo.** | Funcionando |

!!! confirm "A confirmar"
    - Se o prazo das 18h e o lembrete das 16h viram uma configuração por empresa ou por obra.
    - Se um diário aprovado por engano pode ser reaberto (hoje: nunca).
    - Lembretes por SMS e e-mail (fora por enquanto: SMS nos EUA exige o registro A2P 10DLC e consentimento).
