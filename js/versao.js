/* KORbuild — qual versão do app está valendo.
 * 1ª versão (lançamento): só o Measure Takeoff e o Settings; Daily, Crew, concorrências, cronograma e o protótipo ficam ocultos.
 * Ela vale no domínio de produção (korbuildtech.com) e, para testar fora dele, com ?versao=primeira no endereço (guardado neste navegador;
 * ?versao=completa volta ao app inteiro). O app inteiro segue na homologação (GitHub Pages) para continuar testando.
 * Só esconde telas: o banco, as regras de acesso e os testes são os mesmos nas duas versões. */

export const HOSTS_PRODUCAO = ['korbuildtech.com', 'www.korbuildtech.com'];

export const NO_DOMINIO = (() => { try { return HOSTS_PRODUCAO.includes(location.hostname); } catch { return false; } })();

function preferenciaDoNavegador() {
  try {
    const q = new URLSearchParams(location.search).get('versao');
    if (q === 'primeira') localStorage.setItem('kbt.versao', 'primeira');
    else if (q === 'completa') localStorage.removeItem('kbt.versao');
    return localStorage.getItem('kbt.versao') === 'primeira';
  } catch { return false; }
}

export const PRIMEIRA_VERSAO = NO_DOMINIO || preferenciaDoNavegador();

/** Os módulos que a empresa abre nesta versão (o Settings vem em todo plano). */
export const MODULOS_DA_VERSAO = PRIMEIRA_VERSAO ? ['measure'] : ['daily', 'crew', 'measure'];

export const NOME_MEASURE = PRIMEIRA_VERSAO ? 'Measure Takeoff' : 'Measure';
