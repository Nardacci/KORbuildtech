/* KORbuild — o app em inglês (o padrão): percorre as telas de cada perfil e acusa texto em português.
 * Uso: suba um servidor na pasta do projeto (python3 -m http.server 8123) e rode
 *   node tests/ingles.test.mjs [http://localhost:8123/] [--relatorio]
 * Com --relatorio, lista tudo o que achou em português (sem falhar). */

import { chromium } from 'playwright';

const BASE = process.argv.find((a) => a.startsWith('http')) || 'http://localhost:8123/';
const RELATORIO = process.argv.includes('--relatorio');
let falhas = 0, passos = 0;
function verificar(cond, texto) {
  passos++;
  if (cond) console.log('  ok  ' + texto);
  else { falhas++; console.log('FALHA ' + texto); }
}

// Palavras e grafias que não existem em inglês. Nomes próprios de exemplo ficam de fora (PERMITIDO).
const PORTUGUES = /[ãõçâêôáéíóú]|\b(de|da|dos|das|não|para|com|que|em|nos|nas|uma|ou|obra|obras|hoje|ontem|semana|horas|equipe|ponto|preço|preços|projeto|projetos|você|está|são|até|sem|por|pelo|pela|ao|aos|novo|nova|salvar|editar|excluir|voltar|enviar|entrada|saída|intervalo|funcionário|funcionários|usuário|usuários|perfil|relatório|relatórios|aprovar|ajustes|etapa|mês|dia|dias|pessoa|pessoas|trabalhando|fora|ainda|desde|cada|quando|também|aqui|agora|então|foto|fotos|faltam|falta|feito|feita|nenhum|nenhuma|todos|todas|está|estão|ser|tem|vai|após|antes|depois|sobre|entre|seu|sua|seus|suas|isso|este|esta|esse|essa|mais|menos|muito|só|já|outro|outra|valor|custo|prazo|lista|folha|escala|medida|condição|tirar|incluir|criar|ver|abrir|fechar|salvo|salva|registrado|registrada|aguardando|pendente|aberto|fechado)\b/i;
const PERMITIDO = /\S+@\S+|to-dos|Márcia|Antônio|João|José|André|Português|KORbuild|Northfield/g;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const context = await browser.newContext({
  viewport: { width: 1366, height: 900 },
  geolocation: { latitude: 43.00411, longitude: -71.46353, accuracy: 8 }, permissions: ['geolocation'],
});
await context.route('https://api.open-meteo.com/**', (r) => r.fulfill({ json: { hourly: { time: [], weather_code: [], precipitation: [], temperature_2m: [] } } }));
await context.route('https://fonts.**', (r) => r.abort());
await context.route(/tile\.openstreetmap|router\.project-osrm|nominatim/, (r) => r.abort());
const page = await context.newPage();
await page.clock.setFixedTime(new Date('2026-10-07T16:30:00'));
const erros = [];
page.on('pageerror', (e) => erros.push(e.message));

await page.goto(BASE);
await page.waitForSelector('#form-login', { timeout: 30000 });
verificar(await page.evaluate(() => document.documentElement.lang === 'en'), 'sem escolha, o app abre em inglês');
verificar((await page.textContent('#form-login h2')).trim() === 'Sign in', 'tela de entrada em inglês');

const achados = new Map(); // linha → { telas }
const semTraducao = new Set();

async function coletar(rota) {
  const r = await page.evaluate(() => {
    const linhas = document.body.innerText.split('\n').map((s) => s.trim()).filter(Boolean);
    const attrs = [...document.querySelectorAll('[title],[aria-label],[placeholder]')]
      .flatMap((el) => ['title', 'aria-label', 'placeholder'].map((a) => el.getAttribute(a)).filter(Boolean));
    return { linhas: linhas.concat(attrs), falta: [...(window.kbtSemTraducao || [])] };
  });
  for (const l of r.linhas) {
    if (!PORTUGUES.test(l.replace(PERMITIDO, ''))) continue;
    const a = achados.get(l) || new Set();
    a.add(rota);
    achados.set(l, a);
  }
  r.falta.forEach((f) => semTraducao.add(f));
}

/* Percorre os links internos a partir do início, até um limite por usuário. */
async function percorrer(usuario, limite) {
  await page.evaluate((id) => localStorage.setItem('kbt.sessao', id), usuario);
  const fila = ['#/inicio'];
  const vistas = new Set();
  while (fila.length && vistas.size < limite) {
    const rota = fila.shift();
    if (vistas.has(rota)) continue;
    vistas.add(rota);
    await page.goto(BASE + rota);
    await page.waitForTimeout(250);
    await coletar(rota);
    const links = await page.evaluate(() => [...document.querySelectorAll('a[href^="#/"]')].map((a) => a.getAttribute('href')));
    for (const l of links) {
      // pula variações sem fim (semanas e meses anteriores, imprimir)
      if (/\/(\d{4}-\d{2}(-\d{2})?)\/?$/.test(l) && vistas.size > 5 && [...vistas].some((v) => v.replace(/\d{4}-\d{2}(-\d{2})?/, '') === l.replace(/\d{4}-\d{2}(-\d{2})?/, ''))) continue;
      if (!vistas.has(l) && !fila.includes(l)) fila.push(l);
    }
  }
  return vistas.size;
}

for (const [u, limite] of [['u-ana', 90], ['u-carlos', 40], ['u-diego', 10], ['u-tom', 90], ['u-rita', 20]]) {
  const n = await percorrer(u, limite);
  console.log('  ' + u + ': ' + n + ' telas');
}

verificar(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
verificar(semTraducao.size === 0, 'toda frase marcada tem inglês (' + semTraducao.size + ' sem tradução)');
verificar(achados.size === 0, 'nenhum texto em português nas telas (' + achados.size + ' linhas)');
if (RELATORIO || falhas) {
  if (semTraducao.size) console.log('\nSem tradução:\n' + [...semTraducao].map((s) => '  ' + JSON.stringify(s)).join('\n'));
  if (achados.size) console.log('\nEm português na tela:\n' + [...achados].map(([l, telas]) => '  ' + l.slice(0, 160) + '   ← ' + [...telas].slice(0, 2).join(', ')).join('\n'));
}

await browser.close();
console.log('\n' + (passos - falhas) + '/' + passos + ' verificações passaram');
process.exit(falhas ? 1 : 0);
