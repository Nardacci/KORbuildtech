# Visão geral

O **Daily** é o diário de obra (RDO, relatório diário de obra). Em cada dia de trabalho, o responsável da prestadora no canteiro registra o clima, a equipe, os equipamentos, as atividades, as ocorrências e as fotos. A **construtora** da obra revisa e aprova o relatório — ou a própria prestadora, numa obra que ela tem direto com o dono — e o relatório aprovado é lacrado e compartilhado com o cliente por link ou em PDF. Veja [Como o KORbuild se organiza](@/organization.html).

## Por que importa

- **Um registro que se sustenta.** Quando o cliente contesta um atraso, os diários são a prova da empresa: a chuva que parou a concretagem, a entrega atrasada, a vistoria que não veio. As fotos levam data, hora e GPS dentro da imagem, e o relatório aprovado é lacrado.
- **Diários que realmente são feitos.** Cada obra tem um responsável pelo diário, um prazo diário (18h) e lembretes. Na manhã seguinte, o escritório vê quais obras ficaram sem diário.
- **Minutos, não uma noite.** No celular, o encarregado copia o diário de ontem, ajusta a equipe, dita o que foi feito e tira as fotos. Funciona sem sinal.

## Quem usa

| Quem | Onde | O que faz |
|---|---|---|
| **Encarregado da prestadora** | Celular | Preenche e envia o diário de cada obra, em cada dia de trabalho; corrige os que voltam com pedido de ajuste. |
| **Construtora** (administrador, gestor de obras) | Computador | Acompanha todas as prestadoras em cada obra, revisa, aprova ou pede ajustes, compartilha com o dono. Não preenche diário. |
| **Escritório da prestadora** | Computador | Acompanha os próprios diários; aprova só nas obras que tem direto com o dono. |
| **Cliente** (dono ou construtora) | Qualquer navegador | Abre o link do relatório aprovado, confere que é autêntico e baixa o PDF. Sem conta. |

Quem pode fazer o quê depende do perfil de acesso: veja [Perfis e permissões](@/daily/roles-and-permissions.html).

## As telas principais

| Tela | Quem vê | O que mostra |
|---|---|---|
| **Hoje** | Campo | As obras do dia, os diários atrasados, o que ainda falta hoje e os pedidos de ajuste. |
| **Histórico** | Campo | Todos os diários que você preencheu, do mais novo ao mais antigo. |
| **RDO** (editor) | Campo | O formulário: clima, equipe, equipamentos, atividades, ocorrências, fotos, observações. |
| **Painel** | Escritório | Os números do dia, o farol das obras (verde, amarelo, vermelho), as obras sem diário, a fila de aprovação. |
| **Aprovações** | Escritório | Diários aguardando aprovação, devolvidos para ajustes e aprovados. |
| **Obras** | Escritório | Todas as obras ativas, com o farol; cada obra abre os seus diários e o cronograma. |
| **Link do cliente** | Cliente | O relatório aprovado, só leitura, com a conferência de autenticidade e o PDF. |

![A tela Hoje no celular do encarregado](img/daily-field-today-mobile.png)

![O painel do escritório](img/daily-dashboard.png)

## O caminho de um diário

| Situação | O que significa | Quem age |
|---|---|---|
| **Rascunho** | Sendo preenchido; guardado no celular. | Campo: enviar. |
| **Guardado no aparelho** | Enviado sem sinal; sobe sozinho quando a conexão voltar. | Ninguém: é automático. |
| **Aguardando aprovação** | Recebido por quem aprova. | A construtora (ou a prestadora, na obra própria): aprovar ou pedir ajustes. |
| **Ajustes pedidos** | Devolvido com o motivo. | Campo: corrigir e reenviar. |
| **Aprovado** | Lacrado com um código de verificação. Ninguém consegue mudar. | Compartilhar com o cliente. |
| **Sem atividade** | O dia foi registrado como "sem atividade", com o motivo (chuva, feriado…). | Ninguém. |

## Ligado aos outros módulos

- **Crew:** ao começar o diário, a equipe pode vir das pessoas que bateram ponto na obra naquele dia (**Atualizar pela equipe que bateu ponto**).
- **Cronograma:** cada atividade do diário pode apontar uma etapa do cronograma da obra, com o % concluído; quando o diário é aprovado, o cronograma é atualizado.
- **Obras** são cadastradas uma vez por empresa (Settings › Obras). A construtora cadastra as obras dela; cada prestadora tem a própria obra ligada à da construtora, com quem preenche o diário e os dias de trabalho.
