/* KORbuild — página avulsa do diagnóstico do aparelho (diagnostico.html): abre sem login, para quando a pessoa nem consegue entrar no app. */
import { esc } from './util.js';
import { tr, htmlSeletorIdioma } from './i18n.js';
import { marca, logotipo } from './icones.js';
import { iniciarDiagnostico } from './diagnostico.js';

const raiz = document.getElementById('app');
raiz.innerHTML = '<header class="oficial-topo"><a class="oficial-marca" href="./">' + marca(28) + logotipo() + '</a><span class="oficial-empresa"></span>' + htmlSeletorIdioma('oficial-idioma') + '</header>' +
  '<main class="pagina pagina-larga oficial-pagina"><section class="cartao"><h1 class="oficial-titulo">' + esc(tr('Diagnóstico do aparelho')) + '</h1>' +
  '<p class="mudo">' + esc(tr('Para quando algo não funciona neste celular: veja o que está errado e mande o relatório para quem está ajudando.')) + '</p>' +
  '<div class="btn-linha"><a class="btn btn-contorno" href="./">' + esc(tr('Voltar ao KORbuild')) + '</a></div></section><div id="diag-raiz"></div></main>';
iniciarDiagnostico(document.getElementById('diag-raiz'));
