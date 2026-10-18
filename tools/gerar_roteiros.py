#!/usr/bin/env python3
"""KORbuild — gera os dois roteiros de teste no celular a partir do mesmo molde:
teste-iphone.html (Safari) e teste-android.html (Chrome). Mude o texto aqui e rode: python3 tools/gerar_roteiros.py"""

CABECA = """<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#141B26">
<link rel="icon" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap">
<link rel="stylesheet" href="css/app.css">
<title>KORbuild · Roteiro de teste no {nome}</title>
</head>
<body>
<header class="oficial-topo"><a class="oficial-marca" href="./"><span class="logo"><span class="logo-texto" aria-label="KORbuild"><b>KOR</b><span>build</span></span></span></a><span class="oficial-empresa"></span></header>
<main class="pagina pagina-larga oficial-pagina">

<section class="cartao">
  <h1 class="oficial-titulo">Teste do KORbuild no seu {nome}</h1>
  <p>Obrigado por ajudar! Você vai testar o KORbuild no seu {nome} por uns <b>15 a 20 minutos</b>. Os dados são de exemplo, de uma empresa fictícia: <b>nada do que você fizer aqui afeta uma empresa de verdade</b>.</p>
  <p class="mudo">Você vai precisar do <b>login e da senha de teste</b> que quem te convidou mandou numa mensagem separada. A senha não está nesta página.</p>
  <p class="mudo pequeno">{outro}</p>
</section>

<section class="cartao">
  <h2 class="cartao-titulo">Seus logins de teste</h2>
  <p>Empresa fictícia <b>Summit Framing</b>. <b>Toque no e-mail ou na senha para copiar</b> e cole na tela de entrada (digitar no celular costuma errar uma letra).</p>
  <ul class="passos-teste">
    <li><b>Crew (ponto):</b> <code data-copiar>demo.s2.trabalhador@example.com</code></li>
    <li><b>Daily (diário de obra):</b> <code data-copiar>demo.s2.encarregado@example.com</code></li>
    <li><b>Senha (a mesma nos dois):</b> <code id="senha-teste">veio na mensagem de quem te convidou</code></li>
  </ul>
  <p class="mudo pequeno">Se o link que você recebeu já terminava com a senha, ela aparece acima e some da barra de endereço. São contas de teste, sem dados de ninguém.</p>
</section>
"""

PASSOS = """
<section class="cartao">
  <h2 class="cartao-titulo">1. Abra no navegador certo</h2>
  <ol class="passos-teste">
{abrir}
    <li>Endereço do app: <a href="./">abrir o KORbuild</a></li>
  </ol>
</section>

<section class="cartao">
  <h2 class="cartao-titulo">2. Instale na Tela de Início</h2>
  <ol class="passos-teste">
{instalar}
    <li>Feche o navegador e abra o <b>ícone KORbuild</b> que apareceu na tela inicial. <b>Use sempre por esse ícone.</b></li>
  </ol>
  <p class="mudo pequeno">Se não conseguir instalar, siga mesmo assim e avise no fim. Isso também é uma informação importante.</p>
</section>

<section class="cartao">
  <h2 class="cartao-titulo">3. Entre e bata o ponto (Crew)</h2>
  <ol class="passos-teste">
    <li>Entre com o login de <b>trabalhador</b> e a senha que você recebeu. Escolha <b>Crew</b>.</li>
    <li>Toque para <b>bater a entrada</b>. Se o celular pedir <b>permissão de localização</b>, toque em <b>Permitir</b>{precisa}.</li>
    <li>Quando pedir a <b>foto</b>, tire uma selfie ou uma foto qualquer. Confira se a batida aparece com a foto.</li>
    <li>Bata o <b>início do intervalo</b> e o <b>fim do intervalo</b>.</li>
  </ol>
</section>

<section class="cartao">
  <h2 class="cartao-titulo">4. Preencha um diário de obra (Daily)</h2>
  <ol class="passos-teste">
    <li>Saia e entre com o login de <b>encarregado</b>. Escolha <b>Daily</b>.</li>
    <li>Abra a obra do dia, preencha o <b>clima</b>, a <b>equipe</b>, um <b>serviço executado</b> e <b>tire 2 fotos</b>.</li>
    <li>Toque em <b>Enviar</b> e confira se aparece como enviado.</li>
  </ol>
</section>

<section class="cartao">
  <h2 class="cartao-titulo">5. Teste sem internet</h2>
  <ol class="passos-teste">
    <li>Ligue o <b>modo avião</b> (ou desligue Wi-Fi e dados).</li>
    <li>Com o app aberto, <b>bata uma entrada de ponto com foto</b> (como trabalhador) ou <b>comece outro diário</b>. O app deve avisar que guardou no celular para enviar depois.</li>
    <li>Desligue o modo avião, <b>espere 30 segundos</b> com o app aberto e veja se o aviso some e o registro aparece como enviado.</li>
  </ol>
</section>

<section class="cartao">
  <h2 class="cartao-titulo">6. Mande o relatório do aparelho</h2>
  <ol class="passos-teste">
    <li>Toque na sua <b>foto/iniciais</b> (canto de cima à direita) e em <b>"Diagnóstico do aparelho"</b>. Se não conseguir entrar no app, use este endereço: <a href="diagnostico.html">diagnóstico do aparelho</a>.</li>
    <li>Toque em <b>"Testar localização"</b> e em <b>"Testar foto da câmera"</b> (tire uma foto).</li>
    <li>Toque em <b>"Enviar relatório"</b> (ou <b>"Copiar relatório"</b> e cole na conversa) e mande para quem te convidou.</li>
  </ol>
</section>

<section class="cartao">
  <h2 class="cartao-titulo">7. Conte o que aconteceu</h2>
  <p>Responda numa mensagem, em poucas palavras:</p>
  <ul class="passos-teste">
    <li>{modelo}</li>
    <li>Conseguiu instalar na Tela de Início?</li>
    <li>Alguma tela ficou cortada, bagunçada ou difícil de tocar? <b>Se puder, mande um print.</b></li>
    <li>A foto e a localização funcionaram? Em que passo travou, se travou?</li>
    <li>O que você achou confuso?</li>
  </ul>
  <div class="btn-linha"><a class="btn btn-primario" href="./">Abrir o KORbuild</a><a class="btn btn-contorno" href="diagnostico.html">Diagnóstico do aparelho</a></div>
</section>

</main>
<script type="module" src="js/roteiro.js"></script>
</body>
</html>
"""

IPHONE = dict(
    nome='iPhone',
    outro='Está com um celular Android? Use o <a href="teste-android.html">roteiro do Android</a>.',
    abrir='    <li>Abra este endereço no <b>Safari</b> (o ícone azul de bússola). Se você veio por um link no WhatsApp ou Instagram, toque nos três pontinhos (ou na bússola) e escolha <b>"Abrir no Safari"</b>.</li>\n    <li>Não use o Chrome do iPhone para este teste: a instalação na Tela de Início só funciona bem pelo Safari.</li>',
    instalar='    <li>Toque em <b>Compartilhar</b> (o quadrado com a seta para cima, embaixo da tela), role e toque em <b>"Adicionar à Tela de Início"</b>, depois em <b>Adicionar</b>.</li>',
    precisa='',
    modelo='Qual iPhone e qual versão do iOS você usa? (Ajustes → Geral → Sobre)',
)
ANDROID = dict(
    nome='Android',
    outro='Está com um iPhone? Use o <a href="teste-iphone.html">roteiro do iPhone</a>.',
    abrir='    <li>Abra este endereço no <b>Chrome</b>. Se você veio por um link no WhatsApp, Instagram ou Facebook, toque nos três pontinhos (⋮) e escolha <b>"Abrir no Chrome"</b> (ou "Abrir no navegador").</li>\n    <li>Se o seu celular usa outro navegador (Samsung Internet, por exemplo), faça o teste no Chrome mesmo e avise no fim.</li>',
    instalar='    <li>No Chrome, toque nos três pontinhos (⋮) e em <b>"Instalar app"</b> (em alguns celulares aparece como <b>"Adicionar à tela inicial"</b>), depois em <b>Instalar</b>.</li>',
    precisa=' (se aparecer "Só desta vez" e "Durante o uso do app", escolha a segunda; se pedir precisão, deixe a <b>localização precisa</b> ligada)',
    modelo='Qual marca e modelo de celular e qual versão do Android você usa? (Configurações → Sobre o telefone)',
)

for arq, d in (('teste-iphone.html', IPHONE), ('teste-android.html', ANDROID)):
    html = CABECA.format(**d) + PASSOS.format(**d)
    open(arq, 'w', encoding='utf-8').write(html)
    print('gerado', arq)
