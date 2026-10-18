/* KORbuild — roda os testes de navegador no WebKit (o motor do Safari do iPhone) em vez do Chromium, sem mexer em nenhum teste.
 * KOR_MOTOR=webkit  → WebKit de computador (Safari).
 * KOR_MOTOR=iphone  → WebKit com o iPhone 15 emulado (tela, toque, agente); o que o teste definir (tela, agente) vale por cima.
 * Sem a variável, ou com KOR_MOTOR=chromium, não faz nada. Uso: KOR_MOTOR=iphone node --import ./tests/_motor-global.mjs tests/daily.test.mjs http://localhost:8123/
 * (tools/testar.ps1 -Motor webkit|iphone faz isso). Instalar uma vez: npx playwright install webkit
 * Limites do WebKit no Playwright: só a permissão de localização é suportada (as de área de transferência não); o Playwright não é o iOS de verdade
 * (não cobre instalar na Tela de Início, câmera, teclado nem o armazenamento do iPhone: isso é o relatório do aparelho de pessoas de verdade). */

import { chromium, webkit, devices } from 'playwright';

const motor = process.env.KOR_MOTOR || '';
// trava de segurança: nenhum teste de navegador pode passar de KOR_LIMITE_S segundos (padrão 20 min); passou, falha e sai em vez de prender o navegador e a memória
if (motor) setTimeout(() => { console.log('FALHA o teste passou de ' + (process.env.KOR_LIMITE_S || 1200) + ' s e foi interrompido (algum passo ficou esperando)'); process.exit(3); }, Number(process.env.KOR_LIMITE_S || 1200) * 1000).unref();
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
    // o Chromium acrescenta sozinho o CORS às respostas simuladas (route.fulfill); o WebKit não: sem isso a página recusa o clima/rota simulados
    const comCors = (ctx) => {
      const rota = ctx.route.bind(ctx);
      ctx.route = (alvo, tratador, op) => rota(alvo, (r, req) => {
        const cumprir = r.fulfill.bind(r);
        r.fulfill = (o = {}) => cumprir({ ...o, headers: { 'access-control-allow-origin': '*', ...(o.headers || {}) } });
        return tratador(r, req);
      }, op);
      // diagnóstico: o que o navegador recusou ou reclamou (fica na saída do teste, para quem lê sem ver a tela)
      ctx.on('page', (pg) => {
        const curto = (t) => String(t).replace(/\s+/g, ' ').slice(0, 220);
        pg.on('requestfailed', (r) => { if (!/fonts\.|tile\.openstreetmap/.test(r.url())) console.log('      [webkit] requisição falhou: ' + r.method() + ' ' + curto(r.url()) + ' · ' + curto(r.failure() && r.failure().errorText)); });
        pg.on('console', (m) => { if (m.type() === 'error' && !/fonts\.|Failed to load resource/.test(m.text())) console.log('      [webkit] console: ' + curto(m.text())); });
      });
      return ctx;
    };
    browser.newContext = async (o) => comCors(await novoContexto(ajustar(o)));
    browser.newPage = async (o) => (await comCors(await novoContexto(ajustar(o)))).newPage();
    console.log('Motor de navegador: WebKit' + (motor === 'iphone' ? ' (iPhone 15 emulado)' : ' (computador)'));
    return browser;
  };
}
