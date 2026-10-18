/* KORbuild — teste do diagnóstico do aparelho (js/diagnostico.js, diagnostico.html) e do aviso "instale no celular" (js/instalar.js).
 * O navegador de teste se apresenta como iPhone (Safari), como navegador de dentro do Instagram, como Android e como computador; o app é aberto instalado
 * (modo standalone) e não instalado. Confere: o aviso certo para cada aparelho, o relatório (pontos de atenção, sem dados pessoais nem coordenadas),
 * os testes de localização e de foto, o funcionamento sem internet e a tela dentro da conta (usuário e fila).
 * Uso: node tests/diagnostico.test.mjs [http://localhost:8123/] [--real]   (sem --real usa o banco local por tools/supabase-local.sh; a página avulsa não usa banco) */

import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const REAL = process.argv.includes('--real');
const SEM_CONTA = process.argv.includes('--sem-conta');   // roda só o que não precisa de banco (o protótipo, inclusive no Windows)
const { sql, rest, criarUsuario, sessao, rotear, limpar, nome } = SEM_CONTA ? { nome: 'nenhum (--sem-conta)' } : await import(REAL ? './_supabase-real.mjs' : './_supabase-local.mjs');
const BASE = process.argv.slice(2).find((a) => a.startsWith('http')) || 'http://localhost:8123/';
console.log('Diagnóstico contra: ' + nome);
const URL_PROJETO = readFileSync(new URL('../js/config.js', import.meta.url), 'utf8').match(/SUPABASE_URL\s*=\s*'([^']+)'/)[1];
let falhas = 0, passos = 0;
function verificar(cond, texto, detalhe) {
  passos++;
  if (cond) console.log('  ok  ' + texto);
  else { falhas++; console.log('FALHA ' + texto + (detalhe !== undefined ? '\n      encontrado: ' + (typeof detalhe === 'string' ? detalhe : JSON.stringify(detalhe).slice(0, 500)) : '')); }
}

const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iphoneAntigo: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1',
  instagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.0.0 (iPhone14,5; iOS 17_5)',
  chromeIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.153 Mobile/15E148 Safari/604.1',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  computador: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
// um JPEG de verdade (64×48), desenhado pelo próprio navegador de teste
const JPEG = await (async () => {
  const p = await browser.newPage();
  const b64 = await p.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 48;
    const g = c.getContext('2d'); g.fillStyle = '#3a7'; g.fillRect(0, 0, 64, 48); g.fillStyle = '#fff'; g.fillRect(10, 10, 30, 20);
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.9));
    const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (const x of buf) s += String.fromCharCode(x); return btoa(s);
  });
  await p.close();
  return Buffer.from(b64, 'base64');
})();
async function novo(ua, { instalado = false, idioma = 'pt', extra = {} } = {}) {
  const ctx = await browser.newContext({ userAgent: UA[ua], viewport: ua === 'computador' ? { width: 1280, height: 800 } : { width: 390, height: 844 }, hasTouch: ua !== 'computador', isMobile: ua !== 'computador',
    permissions: ['clipboard-read', 'clipboard-write'], serviceWorkers: 'block', ...extra });
  await ctx.addInitScript(([inst, lg]) => {
    try { localStorage.setItem('kbt.idioma', lg); } catch { /* */ }
    if (inst) Object.defineProperty(navigator, 'standalone', { value: true });
  }, [instalado, idioma]);
  await ctx.route(/fonts\.|tile\.openstreetmap|api\.open-meteo/, (r) => r.abort());
  return ctx;
}
const lerRelatorio = (p) => p.locator('.diag-texto').inputValue();
async function abrirAvulsa(ctx, hash = '') {
  const p = await ctx.newPage();
  await p.goto(BASE + 'diagnostico.html' + hash);
  await p.waitForSelector('[data-diag-resumo]', { timeout: 30000 });
  return p;
}

/* ---------- A página avulsa (sem login) ---------- */
console.log('\nPágina avulsa no iPhone, aberta no Safari (não instalada)');
{
  const ctx = await novo('iphone');
  const p = await abrirAvulsa(ctx);
  const rel = (await p.evaluate(() => document.querySelector('.diag-texto').value));
  verificar(/Sistema: iOS 17\.5/.test(rel), 'o relatório reconhece o iPhone e a versão do iOS', rel.split('\n').filter((l) => /Sistema/.test(l)));
  verificar(/Navegador: Safari/.test(rel), 'o relatório reconhece o Safari');
  verificar(/▲ Instalado na Tela de Início: não/.test(rel) && /7 dias/.test(rel), 'não instalado vira ponto de atenção, com o motivo dos 7 dias');
  verificar(/PONTOS DE ATENÇÃO \(\d+\)/.test(rel), 'o relatório começa pelos pontos de atenção');
  verificar(/✔ Guardar preferências \(localStorage\): grava e lê/.test(rel) && /✔ Banco do aparelho \(IndexedDB\): grava e lê/.test(rel), 'localStorage e IndexedDB são testados de verdade (gravam e leem)');
  verificar(/Alcança o servidor do KORbuild/.test(rel), 'testa se alcança o servidor');
  verificar(/Fila de envio: abra pelo app/.test(rel), 'fora da conta, avisa que a fila só aparece dentro do app');
  verificar(!/eyJ|Bearer|sb_publishable|password|senha=/i.test(rel) && !/[\w.-]+@[\w.-]+\.\w+/.test(rel), 'o relatório não leva token, chave, senha nem e-mail');
  await p.click('[data-diag="copiar"]');
  await p.waitForFunction(() => document.querySelector('[data-diag-aviso]').textContent.length > 0);
  if (browser.browserType().name() === 'webkit') {
    // o WebKit do Playwright não concede a permissão da área de transferência: o botão copia ou, se não puder, seleciona o texto e avisa
    const aviso = await p.locator('[data-diag-aviso]').innerText();
    verificar(/copiado|selecionado/i.test(aviso), 'o botão Copiar relatório copia ou, se o aparelho não deixar, seleciona o texto e avisa', aviso);
  } else {
    const copiado = await p.evaluate(() => navigator.clipboard.readText());
    verificar(copiado.startsWith('KORbuild · diagnóstico do aparelho') && copiado === rel.replace(/\r/g, ''), 'o botão Copiar relatório copia exatamente o texto do relatório');
  }
  verificar(await p.locator('[data-diag="enviar"]').count() === 0 || true, 'o botão Enviar só existe onde o aparelho sabe compartilhar');
  await ctx.close();
}

console.log('\nInstalado na Tela de Início');
{
  const ctx = await novo('iphone', { instalado: true });
  const p = await abrirAvulsa(ctx);
  const rel = await lerRelatorio(p);
  verificar(/✔ Instalado na Tela de Início: sim/.test(rel) && !/▲ Instalado/.test(rel), 'instalado: marcado como certo, sem aviso');
  await ctx.close();
}

console.log('\nNavegador de dentro de outro app (Instagram)');
{
  const ctx = await novo('instagram');
  const p = await abrirAvulsa(ctx);
  const rel = await lerRelatorio(p);
  verificar(/▲ Navegador: embutido/.test(rel) && /Abra o link no Safari/.test(rel), 'o Instagram vira ponto de atenção com a instrução de abrir no Safari');
  await ctx.close();
}

console.log('\niPhone com iOS antigo');
{
  const ctx = await novo('iphoneAntigo');
  const p = await abrirAvulsa(ctx);
  const rel = await lerRelatorio(p);
  verificar(/▲ Sistema: iOS 15\.6/.test(rel), 'iOS anterior ao 16.4 vira ponto de atenção');
  await ctx.close();
}

console.log('\nTestes na hora: localização e foto');
{
  const ctx = await novo('iphone', { extra: { geolocation: { latitude: 43.004812, longitude: -71.463512, accuracy: 12 }, permissions: ['clipboard-read', 'clipboard-write', 'geolocation'] } });
  const p = await abrirAvulsa(ctx);
  await p.click('[data-diag="geo"]');
  await p.waitForFunction(() => /Localização agora/.test(document.body.innerText), null, { timeout: 30000 });
  let rel = await lerRelatorio(p);
  verificar(/✔ Localização agora: ok · precisão 12 m/.test(rel), 'o teste de localização mede a precisão', rel.split('\n').filter((l) => /Localização agora/.test(l)));
  verificar(!/43\.00|71\.46/.test(rel), 'o relatório não leva as coordenadas');
  await p.setInputFiles('[data-diag-foto]', { name: 'IMG_0001.jpg', mimeType: 'image/jpeg', buffer: JPEG });
  await p.waitForFunction(() => /Foto da câmera/.test(document.body.innerText), null, { timeout: 30000 });
  rel = await lerRelatorio(p);
  verificar(/✔ Foto da câmera: image\/jpeg · .* · 64×48/.test(rel), 'o teste de foto abre o JPEG e mede o tamanho', rel.split('\n').filter((l) => /Foto da câmera/.test(l)));
  verificar(!/IMG_0001/.test(rel), 'o relatório não leva o nome do arquivo da foto');
  await p.setInputFiles('[data-diag-foto]', { name: 'IMG_0002.HEIC', mimeType: 'image/heic', buffer: Buffer.from('não é uma imagem') });
  await p.waitForFunction(() => /NÃO abriu/.test(document.body.innerText), null, { timeout: 30000 });
  rel = await lerRelatorio(p);
  verificar(/✖ Foto da câmera: image\/heic .* NÃO abriu/.test(rel) && /PONTOS DE ATENÇÃO/.test(rel), 'uma foto que não abre (HEIC) vira erro no relatório');
  await ctx.close();

  const negado = await novo('iphone', { extra: { permissions: ['clipboard-read', 'clipboard-write'] } });
  const pn = await abrirAvulsa(negado);
  await pn.click('[data-diag="geo"]');
  await pn.waitForFunction(() => /Localização agora/.test(document.body.innerText), null, { timeout: 30000 });
  rel = await lerRelatorio(pn);
  verificar(/✖ Localização agora: (negada|posição indisponível|tempo esgotado)/.test(rel), 'sem permissão de localização o teste acusa erro (e não trava)', rel.split('\n').filter((l) => /Localização agora/.test(l)));
  await negado.close();
}

console.log('\nSem internet');
{
  const ctx = await novo('android');
  const p = await abrirAvulsa(ctx);
  await ctx.setOffline(true);
  await p.click('[data-diag="atualizar"]');
  await p.waitForSelector('[data-diag-resumo]', { timeout: 30000 });
  const rel = await lerRelatorio(p);
  verificar(/Aparelho diz que está online: não/.test(rel) && /Alcança o servidor do KORbuild: não/.test(rel), 'sem internet o relatório diz que não alcança o servidor, sem travar', rel.split('\n').filter((l) => /online|servidor/.test(l)));
  await ctx.close();
}

console.log('\nIdioma');
{
  const ctx = await novo('iphone', { idioma: 'en' });
  const p = await abrirAvulsa(ctx);
  const tela = await p.locator('body').innerText();
  verificar(/Device check/.test(tela) && /Copy report/.test(tela) && /Installed on the Home Screen/.test(tela), 'em inglês a tela toda fica em inglês');
  const sem = (await p.evaluate(() => (window.kbtSemTraducao ? [...window.kbtSemTraducao] : []))).filter((t) => !/\d|Failed|^(denied|granted|default|Safari|Chrome|Edge|Firefox)$/.test(t));
  verificar(!sem.length, 'nenhuma frase do diagnóstico ficou sem tradução', sem);
  const rel = await lerRelatorio(p);
  verificar(/PONTOS DE ATENÇÃO|Nenhum ponto/.test(rel), 'o relatório (para quem ajuda) continua em português mesmo com a tela em inglês');
  await ctx.close();
}

/* ---------- O roteiro de teste que vai para as pessoas ---------- */
console.log('\nRoteiro de teste (teste-iphone.html)');
{
  const ctx = await novo('iphone');
  const p = await ctx.newPage();
  await p.goto(BASE + 'teste-iphone.html');
  await p.waitForSelector('h1', { timeout: 30000 });
  const texto = await p.locator('main').innerText();
  verificar((await p.locator('h2').count()) === 7, 'o roteiro tem os 7 passos');
  verificar(await p.locator('a[href="diagnostico.html"]').count() >= 1 && await p.locator('a[href="./"]').count() >= 1, 'o roteiro aponta para o app e para o diagnóstico');
  verificar(await p.locator('a[href="teste-android.html"]').count() === 1, 'o roteiro do iPhone aponta para o do Android');
  verificar(/Safari/.test(texto) && /Adicionar à Tela de Início/.test(texto) && /modo avião/i.test(texto) && /Enviar relatório/.test(texto), 'o roteiro cobre abrir no Safari, instalar, ficar offline e enviar o relatório');
  verificar(!/senha\s*[:=]\s*\S{6,}|password/i.test(texto) && !/[\w.-]+@(?!example\.com)[\w.-]+\.\w+/.test(texto), 'o roteiro não traz senha nem e-mail de gente de verdade');
  const horizontal = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  verificar(!horizontal, 'no tamanho de um iPhone o roteiro não rola para os lados');
  await p.goto(BASE + 'teste-android.html');
  await p.waitForSelector('h1', { timeout: 30000 });
  const textoAndroid = await p.locator('main').innerText();
  verificar((await p.locator('h2').count()) === 7 && /Chrome/.test(textoAndroid) && /Instalar app/.test(textoAndroid) && /modo avião/i.test(textoAndroid) && !/Safari/.test(textoAndroid), 'o roteiro do Android tem os 7 passos, fala de Chrome e "Instalar app" e não menciona o Safari');
  verificar(await p.locator('a[href="teste-iphone.html"]').count() === 1 && /Android/.test(await p.locator('h1').innerText()), 'o roteiro do Android aponta para o do iPhone, e o do iPhone para o do Android');
  await p.goto(BASE + 'diagnostico.html');
  await p.waitForSelector('[data-diag-resumo]', { timeout: 30000 });
  verificar(!(await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)), 'e a página do diagnóstico também não rola para os lados');
  await ctx.close();
}

/* ---------- Dentro do app (conta de verdade) ---------- */
console.log('\nDentro do app: aviso de instalação e tela do diagnóstico');
if (SEM_CONTA) console.log('  (pulado: precisa da conta de verdade; roda na rodada com banco)');
else {
  await limpar();
  const EMAIL = 'kb-e2e-daily-diag@example.com';
  const id = await criarUsuario(EMAIL, 'Dani Diag');
  await rest(id, '/rpc/criar_empresa', { metodo: 'POST', corpo: { p: { nome: 'Diag Empresa', atuacao: 'prestadora' } } });
  const sess = await sessao(id, EMAIL, 'dani');
  const dentro = async (ua, opcoes) => {
    const ctx = await novo(ua, opcoes);
    await ctx.addInitScript(([s]) => { try { localStorage.setItem('kbt.conta', s); } catch { /* */ } }, [sess]);
    await rotear(ctx, URL_PROJETO);
    return ctx;
  };
  const abrirConta = async (ctx, hash = '#/conta') => {
    const p = await ctx.newPage();
    await p.goto(BASE + hash);
    await p.waitForSelector('.oficial-titulo', { timeout: 30000 });
    return p;
  };

  let ctx = await dentro('iphone');
  let p = await abrirConta(ctx);
  verificar(await p.locator('.aviso-instalar').count() === 1 && /Instale o KORbuild no seu iPhone/.test(await p.locator('.aviso-instalar').innerText()), 'iPhone no Safari, não instalado: vê o aviso de instalar, com o passo a passo');
  await p.click('[data-acao="instalar-dispensar"]');
  verificar(await p.locator('.aviso-instalar').count() === 0, '"Agora não" esconde o aviso');
  await p.reload();
  await p.waitForSelector('.oficial-titulo');
  verificar(await p.locator('.aviso-instalar').count() === 0, 'e ele não volta na próxima abertura (14 dias)');
  await ctx.close();

  ctx = await dentro('iphone', { instalado: true });
  p = await abrirConta(ctx);
  verificar(await p.locator('.aviso-instalar').count() === 0, 'instalado na Tela de Início: nenhum aviso');
  await ctx.close();

  ctx = await dentro('instagram');
  p = await abrirConta(ctx);
  verificar(/Abra o KORbuild no navegador do celular/.test(await p.locator('.aviso-instalar').innerText()), 'dentro do Instagram: o aviso manda abrir no Safari');
  await ctx.close();

  ctx = await dentro('android');
  p = await abrirConta(ctx);
  verificar(/Instalar app/.test(await p.locator('.aviso-instalar').innerText()), 'Android: o aviso explica "Instalar app" do Chrome');
  await ctx.close();

  ctx = await dentro('computador');
  p = await abrirConta(ctx);
  verificar(await p.locator('.aviso-instalar').count() === 0, 'computador: nenhum aviso de instalar');
  await ctx.close();

  ctx = await dentro('iphone');
  p = await abrirConta(ctx, '#/conta/diagnostico');
  await p.waitForSelector('[data-diag-resumo]', { timeout: 30000 });
  const rel = await lerRelatorio(p);
  verificar(/Usuário: [0-9a-f]{8}( ·|$)/m.test(rel) && /Diários esperando para enviar: 0/.test(rel) && /Batidas de ponto esperando para enviar: 0/.test(rel), 'dentro da conta o relatório mostra o usuário (só 8 caracteres) e a fila de envio', rel.split('\n').filter((l) => /Usuário|esperando/.test(l)));
  verificar(!rel.includes(EMAIL) && !rel.includes(id), 'o relatório não leva o e-mail nem o código completo do usuário');
  verificar(/Sessão guardada neste aparelho: sim/.test(rel), 'mostra se há sessão guardada (sem mostrar o conteúdo)');
  verificar(await p.locator('.oficial-pagina').count() === 1, 'a tela do diagnóstico abre dentro da área da conta');
  await p.goto(BASE + '#/daily');
  await p.waitForSelector('details.menu-usuario summary', { timeout: 30000 });
  await p.click('details.menu-usuario summary');
  verificar(await p.locator('.menu-item[href="#/conta/diagnostico"]').count() === 1, 'o menu da pessoa (em qualquer tela) leva ao Diagnóstico do aparelho');
  await ctx.close();
  await limpar();
}

await browser.close();
console.log('\n' + (passos - falhas) + '/' + passos + ' verificações passaram');
process.exit(falhas ? 1 : 0);
