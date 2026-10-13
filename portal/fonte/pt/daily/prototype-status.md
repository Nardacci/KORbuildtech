# Situação do protótipo

O protótipo (a demonstração com dados de exemplo) mostra o produto funcionando. Ao lado dele, a **conta de verdade** já roda no banco de dados na nuvem e está em homologação. Esta página diz o que é real hoje e o que ainda é simulado na demonstração, para ninguém prometer mais do que existe.

## Já funciona no banco de dados (conta de verdade)

| Item | Como funciona hoje |
|---|---|
| Contas | Cadastro com e-mail e senha; a empresa, os usuários, os perfis e os convites ficam no banco, separados por empresa. |
| Diários | Preenchidos no canteiro com fotos, com ou sem internet: o celular guarda o diário e envia quando o sinal volta. O mesmo diário nunca duplica por causa de sinal ruim. |
| Aprovações | O escritório aprova ou pede ajustes; o diário da prestadora numa obra ligada é aprovado pela construtora, nunca pela prestadora. |
| Lacre | O banco calcula o lacre (SHA-256) e o código de verificação na aprovação; depois disso nada muda. |
| Link do cliente | Abre em qualquer lugar, sem login, com as fotos por links temporários; o banco confere o lacre a cada abertura. |
| Cronograma da obra | Etapas com início e fim, linha de base, % concluído vindo do diário aprovado (ou à mão, com histórico) e publicação para a construtora por versão. Etapa que já recebeu andamento de um diário aprovado não pode ser excluída, e só quem aprovou pode alterá-la. |
| Dois aparelhos, um diário | Se o mesmo diário mudou em outro aparelho sem sinal, o segundo é avisado e escolhe qual versão fica. |

## Simulado hoje (na demonstração)

| Item | No protótipo | No produto |
|---|---|---|
| Onde ficam os dados | Só no navegador de cada aparelho. | O banco de dados na nuvem, separado por empresa — **já funciona** na conta de verdade. |
| Lembretes das 16h e das 18h | Só com o app aberto. | Enviados pelo servidor, mesmo com o app fechado. |
| **Melhorar texto** | Regras simples no celular. | Inteligência artificial, guardando o texto original ao lado. |
| PDF | Impresso pelo navegador (**Salvar como PDF**). | Gerado no servidor, pronto para baixar. |
| Link do cliente | Abre só no mesmo navegador. | Abre em qualquer lugar — **já funciona**. |
| Falta de sinal | Simulada tocando em **Online**. | Real — **já funciona** (o celular guarda o diário e envia depois). |
| Entrada | Usuários de exemplo, sem senha. | E-mail e senha da empresa — **já funciona**. |
| Clima | Real (Open-Meteo), quando há internet. | Igual. |

## O que vem depois

| Item | Observações |
|---|---|
| Equipe do diário vinda do ponto | Já funciona: a equipe do diário vem de quem bateu o ponto na obra. |
| Aplicativos nas lojas (App Store, Google Play) | Previstos; o protótipo já se instala na tela inicial. |
| Configurar prazo e horários dos lembretes | A confirmar. |
| Lembretes por SMS e e-mail | Avaliados depois (regras dos EUA para SMS de empresas). |
| A construtora convida a prestadora (concorrência) e um canal entre as duas | Especificado; próxima etapa do banco (hoje as obras são ligadas pela equipe do KORbuild). |
