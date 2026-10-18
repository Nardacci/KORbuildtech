# O KORbuild no iPhone (e no Android)

O Daily e o Crew rodam no celular como **PWA**: o app é o site, instalado na Tela de Início. Não precisa de loja (App Store, Google Play), de conta de desenvolvedor nem de aprovação. Este documento diz o que muda no iPhone, como testamos sem ter um e como ler o relatório que as pessoas mandam.

## O que o iPhone faz diferente

| Ponto | No iPhone | Como o KORbuild lida |
|---|---|---|
| Instalar | Não há botão automático: Compartilhar → "Adicionar à Tela de Início" | Aviso na tela com o passo a passo (`js/instalar.js`), só para quem abre pelo celular sem instalar; "Agora não" esconde por 14 dias |
| Navegador de dentro de outro app (WhatsApp, Instagram) | Não deixa instalar | O aviso manda abrir no Safari |
| Dados do site | O Safari apaga o que um site guardou depois de **7 dias sem uso**, exceto PWA instalado | O ponto e as fotos que ainda não subiram ficam em risco para quem não instalou: o aviso e o diagnóstico mostram isso |
| Localização | Só com o app aberto; sem segundo plano | O Crew registra a localização com o app aberto (nunca dependeu de segundo plano) |
| Push | Só instalado e iOS 16.4+ | Não dependemos: avisos pelo sininho e por e-mail |
| Sincronizar com o app fechado | Não existe | A fila (ponto, diário, fotos) sobe com o app aberto e com sinal |
| Câmera | Campo de arquivo do sistema; o Safari converte HEIC em JPEG | O app usa o campo de arquivo (`capture`), sem permissão separada; o teste do diagnóstico confere o tipo da foto |

## Aba privada do Safari e aparelho sem espaço (achado no WebKit, 16/10/2026)

O Safari em **aba privada** (e o WebKit dos testes, que abre cada contexto assim) **cancela sem mensagem** a gravação de um `Blob` no IndexedDB. O app guardava as fotos como Blob; a criação da demonstração ficava presa em "Preparando a demonstração…" para sempre, e o ponto e as fotos offline não gravariam. Correção (`js/armazem.js`, `js/app.js`):

- a foto vai para o banco como **bytes** (`{ tipo, bytes }`) e volta como Blob; fotos antigas, guardadas como Blob, continuam lendo;
- se o banco do aparelho não gravar de jeito nenhum, o cofre cai para a **memória** da página (o app continua; as fotos só duram até fechar). `cofreDasFotos()` diz qual dos dois está valendo e o diagnóstico mostra;
- se a partida falhar por qualquer motivo, a pessoa vê "Não foi possível abrir o KORbuild neste aparelho", com "Tentar de novo" e o caminho para o diagnóstico, em vez de "carregando" para sempre.

Coberto por `tests/armazem-fotos.test.mjs` (simula os dois jeitos de falhar no Chromium; no WebKit efêmero acontecem de verdade).

## Como testamos sem um iPhone

1. **Motor WebKit** (o do Safari) pelo Playwright, no Windows: `npx playwright install webkit` e rodar as suítes com `devices['iPhone 15']`. Pega diferenças de motor (formulário, data, CSS, IndexedDB, service worker). Não é um iOS de verdade.
2. **Pessoas com iPhone, à distância** (o caminho principal): a pessoa abre o roteiro do aparelho dela (`teste-iphone.html` no iPhone, `teste-android.html` no Android; os dois saem de `tools/gerar_roteiros.py`, e o link está na tela de entrada) no celular, segue 7 passos e manda o **relatório do aparelho**. Cada pessoa vira um aparelho de teste. Use só **logins demo**, nunca contas reais, e mande a senha em separado.
3. **Aparelho real em nuvem** (BrowserStack, LambdaTest), por um mês, para fechar o que só o aparelho responde.

## O relatório do aparelho

Em `#/conta/diagnostico` (menu da pessoa → "Diagnóstico do aparelho") ou, sem login, em `diagnostico.html`. Mostra e copia:

- **Pontos de atenção** no alto: não instalado, navegador embutido, iOS antigo, armazenamento não protegido, localização negada, sem servidor, fila com itens esperando.
- Aparelho (sistema, navegador, tela, áreas seguras), app (versão do cache, service worker), armazenamento (localStorage e IndexedDB testados de verdade, espaço), conexão (online, alcança o servidor e em quantos ms), permissões, conta e fila.
- **Testes na hora:** localização (mede a precisão) e foto da câmera (tipo, tamanho, se abre; HEIC vira erro).

O relatório **não leva** e-mail, senha, token, coordenadas nem nome de arquivo; do usuário só 8 caracteres do código. Só sai do aparelho se a pessoa tocar em Enviar/Copiar.

### Como ler

- `✖` é erro, `▲` é atenção, `✔` está certo, `·` é informação.
- "Instalado: não" + "Armazenamento protegido: não" → o risco dos 7 dias; peça para instalar e repetir.
- "Banco do aparelho (IndexedDB): falhou" → o ponto e as fotos offline não funcionam neste aparelho (aba privada ou sem espaço).
- "Alcança o servidor: não" com internet ligada → rede da obra bloqueando; veja o tipo de rede.
- "Foto da câmera: NÃO abriu" ou HEIC → o campo de foto não entregou um JPEG utilizável.

## Quando uma loja entraria

Só por decisão de produto: aparecer na busca da loja, ponto automático ao chegar na obra (localização em segundo plano), push no iPhone fora do PWA. Android: dá para publicar o próprio PWA na Google Play (TWA; conta de US$ 25 uma vez). iPhone: Apple Developer Program (US$ 99/ano) e um empacotador (Capacitor) compilado na nuvem; a Apple costuma recusar app que é só um site embrulhado.
