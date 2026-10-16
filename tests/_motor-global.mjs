/* KORbuild — roda os testes de navegador no WebKit (o motor do Safari do iPhone) em vez do Chromium, sem mexer em nenhum teste.
 * KOR_MOTOR=webkit  → WebKit de computador (Safari).
 * KOR_MOTOR=iphone  → WebKit com o iPhone 15 emulado (tela, toque, agente); o que o teste definir (tela, agente) vale por cima.
 * Sem a variável, ou com KOR_MOTOR=chromium, não faz nada. Uso: KOR_MOTOR=iphone node --import ./tests/_motor-global.mjs tests/daily.test.mjs http://localhost:8123/
 * (tools/testar.ps1 -Motor webkit|iphone faz isso). Instalar uma vez: npx playwright install webkit
 * Limites do WebKit no Playwright: só a permissão de localização é suportada (as de área de transferência não); o Playwright não é o iOS de verdade
 * (não cobre instalar na Tela de Início, câmera, teclado nem o armazenamento do iPhone: isso é o relatório do aparelho de pessoas de verdade). */

import { chromium, webkit, devices } from 'playwright';

const motor = process.env.KOR_MOTOR || '';
if (motor === 'webkit' || motor === 'iphone') {
  const aparelho = motor === 'iphone' ? devices['iPhone 15'] : {};
  const PERMISSOES_DO_WEBKIT = new Set(['geolocation']);
  const ajustar = (opcoes = {}) => {
    const o = { ...aparelho, ...opcoes };
    if (Array.isArray(o.permissions)) o.permissions = o.permissions.filter((p) => PERMISSOES_DO_WEBKIT.has(p));
    return o;
  };
  chromium.launch = async (opcoes = {}) => {
    const { executablePath, ...resto } = opcoes;   // o caminho do Chromium não serve ao WebKit
    const browser = await webkit.launch(resto);
    const novoContexto = browser.newContext.bind(browser);
    browser.newContext = (o) => novoContexto(ajustar(o));
    browser.newPage = async (o) => (await novoContexto(ajustar(o))).newPage();
    console.log('Motor de navegador: WebKit' + (motor === 'iphone' ? ' (iPhone 15 emulado)' : ' (computador)'));
    return browser;
  };
}
