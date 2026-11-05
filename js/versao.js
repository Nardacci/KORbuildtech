/* KORbuild — qual versão do app está valendo.
 * 1ª versão (lançamento): só o Measure Takeoff e o Settings; Daily, Crew, concorrências, cronograma e o protótipo ficam ocultos.
 * Ela vale no domínio de produção (korbuildtech.com) e na homologação (GitHub Pages: nardacci.github.io); fora deles, com ?versao=primeira no
 * endereço (guardado neste navegador). ?versao=completa mostra o app inteiro (guardado neste navegador, também na homologação), para continuar testando.
 * Só esconde telas: o banco, as regras de acesso e os testes são os mesmos nas duas versões. */

export const HOSTS_PRODUCAO = ['korbuildtech.com', 'www.korbuildtech.com'];

export const HOSTS_HOMOLOGACAO = ['nardacci.github.io'];

export const NO_DOMINIO = (() => { try { return HOSTS_PRODUCAO.includes(location.hostname); } catch { return false; } })();

export const NA_HOMOLOGACAO = (() => { try { return HOSTS_HOMOLOGACAO.includes(location.hostname); } catch { return false; } })();

function preferenciaDoNavegador() {
  try {
    const q = new URLSearchParams(location.search).get('versao');
    if (q === 'primeira') localStorage.setItem('kbt.versao', 'primeira');
    else if (q === 'completa') { if (NA_HOMOLOGACAO) localStorage.setItem('kbt.versao', 'completa'); else localStorage.removeItem('kbt.versao'); }
    const guardada = localStorage.getItem('kbt.versao');
    if (NA_HOMOLOGACAO) return guardada !== 'completa';   // na homologação o padrão é o dashboard; só o ?versao=completa mostra o app inteiro
    return guardada === 'primeira';
  } catch { return NA_HOMOLOGACAO; }
}

export const PRIMEIRA_VERSAO = NO_DOMINIO || preferenciaDoNavegador();

/** Os módulos que a empresa abre nesta versão (o Settings vem em todo plano). */
export const MODULOS_DA_VERSAO = PRIMEIRA_VERSAO ? ['daily', 'measure'] : ['daily', 'crew', 'measure'];   // 1ª versão: Daily (por projeto) + Takeoff; Settings vem sempre

export const NOME_MEASURE = PRIMEIRA_VERSAO ? 'Takeoff' : 'Measure';   // o produto é "KORbuild Takeoff": no topo, o logotipo já traz o KORbuild

try {   // as cores e o título seguem a versão (css/app.css: [data-versao="primeira"])
  document.documentElement.dataset.versao = PRIMEIRA_VERSAO ? 'primeira' : 'completa';
  if (PRIMEIRA_VERSAO && document.title === 'KORbuild') document.title = 'KORbuild Takeoff';
} catch { /* sem documento (testes em Node) */ }
