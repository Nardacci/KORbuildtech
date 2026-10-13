# Situação do protótipo

O protótipo (a demonstração com dados de exemplo) mostra o produto funcionando. Ao lado dele, a **conta de verdade** já roda as concorrências no banco de dados na nuvem e está em homologação. Esta página diz o que é real hoje e o que ainda é simulado na demonstração.

## Já funcionando no banco de dados (conta de verdade)

| Item | Como funciona hoje |
|---|---|
| Onde ficam as concorrências | No servidor, nas tabelas da contratante. Cada convidada recebe só o próprio convite, as próprias propostas e as mensagens que pode ver; nunca vê quem mais foi convidado nem os outros valores. Toda ação depois do envio (prorrogar, convidar mais, adendo, responder, proposta, fechar, cancelar) passa por uma função do banco que confere quem está chamando. |
| Convites para empresas sem conta | O link do convite é gerado pelo banco ao enviar (só o hash fica guardado) e aparece uma vez, para copiar; fica guardado no aparelho que enviou. O envio por e-mail é a próxima etapa. |
| A página do link | Abre sem login: a convidada vê o pacote e os desenhos, responde, pergunta e manda a proposta com o PDF. Quando ela cria a conta com o mesmo e-mail, o convite, as mensagens e as propostas vêm junto. |
| Desenhos | Os PDFs vão para a pasta da concorrência no armazenamento da empresa na nuvem. "Vou cotar" copia cada desenho para o projeto da convidada, folha a folha. |
| PDF da proposta | Guardado com a proposta, na pasta do convite, para a contratante baixar. |
| Fechamento e a obra ligada | Fechar marca o projeto da vencedora como ganho; "Criar obra a partir deste projeto" abre o cadastro preenchido e a obra nasce já ligada à obra da contratante, o que liga o diário, o cronograma e a presença no canteiro entre as duas empresas. |
| Canal | Perguntas, respostas (para todas ou só para quem perguntou), avisos a todos e o canal da obra depois do fechamento, tudo registrado e nunca editado. |
| Quarteirização | Concorrências abertas a partir de um projeto ou de uma obra ganha, com a política de quem está acima (permitida, com aprovação, não permitida); o pedido de aprovação mostra só a empresa escolhida, nunca o valor. |

## Simulado hoje (na demonstração)

| Item | No protótipo | No produto |
|---|---|---|
| Onde ficam as concorrências | No navegador, num lugar comum às empresas de exemplo. | No servidor, e cada empresa lê só o que pode ver — **já funciona** na conta de verdade. |
| Convites por e-mail | Não são enviados. A contratante usa **Copiar o link** para quem não tem conta. | Enviados por e-mail, com o link pessoal (próxima etapa; o link em si **já funciona**). |
| Desenhos | Guarda só o nome dos PDFs; o projeto da convidada começa sem folhas. | Os PDFs vão com o convite e viram as folhas do projeto da convidada — **já funciona**. |
| PDF da proposta | Guarda só o nome do arquivo. | Guardado com a proposta — **já funciona**. |
| Orçamento por etapa | Existe no motor; o formulário pede só o total. | Um campo de orçamento por etapa. |
| *Usar no meu orçamento* | O preço da quarteirizada entra na proposta como **outros itens**, com as suas margens. | Uma linha de subempreiteiro no catálogo, por etapa. |
| Anexos no canal | Só texto. | Fotos e PDFs. |

## O que vem depois

| Item | Observações |
|---|---|
| Convites e avisos por e-mail | A próxima etapa do trabalho no banco de dados. |
| Envelope fechado | A contratante só vê os valores depois do prazo (comum em obra pública). |
| Aditivo a partir do canal | Uma mensagem vira um pedido de mudança formal (*change order*). |
| Dividir o fechamento | Fechar etapas diferentes com prestadoras diferentes. |
| Convidar só pelo e-mail | Convidar quem ainda não está nos Contatos. |
