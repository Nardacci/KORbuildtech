/* KORbuild — liga a medição da política de conteúdo (tests/_csp.mjs) em QUALQUER teste de navegador, inclusive os do protótipo que não passam por rotear().
 * Uso: KOR_CSP=relatorio KOR_CSP_ARQ=.testes/csp.txt node --import ./tests/_csp-global.mjs tests/daily.test.mjs ... */
import { chromium } from 'playwright';
import { ativarCsp } from './_csp.mjs';

const lancar = chromium.launch.bind(chromium);
chromium.launch = async (...args) => {
  const browser = await lancar(...args);
  const novoContexto = browser.newContext.bind(browser);
  browser.newContext = async (...a) => { const c = await novoContexto(...a); await ativarCsp(c); return c; };
  const novaPagina = browser.newPage.bind(browser);
  browser.newPage = async (...a) => {
    const c = await novoContexto(...a);   // newPage() cria um contexto próprio: damos o contexto com a medição
    await ativarCsp(c);
    return c.newPage();
  };
  return browser;
};
