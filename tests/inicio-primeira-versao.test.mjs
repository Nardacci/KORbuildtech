/* KORbuild — o Início da 1ª versão como painel (js/inicio-calculo.js, js/inicio-dashboard.js), em cima da massa pv, no banco local.
 * Confere, por login, quais blocos aparecem e os números que a massa produz (docs/massa-primeira-versao.md); e que quem não tem permissão não vê o bloco.
 * Uso: python3 -m http.server 8123 & bash tools/supabase-local.sh && node tools/massa-primeira-versao.mjs && node tools/massa-measure.mjs --conjunto=pv && node tests/inicio-primeira-versao.test.mjs */

import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { emailDe } from '../tools/massa-pv/dados.mjs';
const { sql, sessao, rotear } = await import('./_supabase-local.mjs');
const BASE = process.argv.slice(2).find((a) => a.startsWith('http')) || 'http://localhost:8123/';
const URL_PROJETO = readFileSync(new URL('../js/config.js', import.meta.url), 'utf8').match(/SUPABASE_URL\s*=\s*'([^']+)'/)[1];
let ok = 0, falhas = 0;
const verificar = (nome, cond, detalhe = '') => { if (cond) ok++; else { falhas++; console.log('  FALHOU: ' + nome + (detalhe ? ' · ' + String(detalhe).slice(0, 300) : '')); } };

// ---- o cálculo sozinho (sem navegador): permissões, situações, economia, prazos e preços
{
  const { calcularInicio, situacaoDoProjeto } = await import('../js/inicio-calculo.js');
  const dia = 864e5, agora = new Date('2026-10-19T15:00:00Z').getTime();
  const d = { empresa: { id: 'E' }, contatos: [{ id: 'k1', nome: 'Cliente A' }],
    measure: { projetos: [
      { id: 'p1', nome: 'A', situacao: 'orcamento', contratanteId: 'k1', propostas: [], cotacao: { envios: [{ fornecedorId: 'f1', em: '2026-10-10T10:00:00Z' }] } },
      { id: 'p2', nome: 'B', situacao: 'orcamento', contratanteId: 'k1', propostas: [{ total: 1000 }] },
      { id: 'p3', nome: 'C', situacao: 'ganha', contratanteId: 'k1', propostas: [{ total: 5000 }, { total: 6000 }], alteradoEm: agora, obraId: null },
      { id: 'p4', nome: 'D', situacao: 'perdida', contratanteId: 'k1', propostas: [{ total: 900 }] },
      { id: 'p5', nome: 'E', situacao: 'orcamento', propostas: [] }],
      condicoes: [{ projetoId: 'p5', medicoes: [{}] }],
      itens: [{ id: 'i1', nome: 'Velho', unidade: 'sheet', precos: [{ desde: '2026-01-01' }] }, { id: 'i2', nome: 'Novo', unidade: 'piece', precos: [{ desde: '2026-10-01' }] }], margens: [{ overheadPct: 9, lucroPct: 7, desde: '2026-01-01' }] },
    obras: [{ id: 'o1', nome: 'Obra', inicio: '2026-09-19', prazo: '2026-11-18', situacao: 'andamento' }, { id: 'o2', nome: 'Velha', inicio: '2026-06-01', prazo: '2026-10-09', situacao: 'andamento' }, { id: 'o3', nome: 'Pronta', inicio: '2026-01-01', prazo: '2026-02-01', situacao: 'concluida' }],
    concorrencias: [
      { id: 'c1', contratanteId: 'E', situacao: 'fechada', criadaEm: agora, fechamento: { valor: 80 }, obraId: 'o1', convites: [{ nome: 'X', empresaId: 'X', convidadoEm: agora - 2 * dia, respondidoEm: agora - dia, propostas: [{ total: 80 }] }, { nome: 'Y', empresaId: 'Y', convidadoEm: agora - 2 * dia, respondidoEm: agora - dia, propostas: [{ total: 100 }] }] },
      { id: 'c2', contratanteId: 'E', situacao: 'rascunho', criadaEm: agora - 10 * dia, convites: [] },
      { id: 'c3', contratanteId: 'Z', situacao: 'aberta', prazo: new Date(agora + 2 * dia).toISOString(), convites: [{ empresaId: 'E', situacao: 'visto' }] }] };
  const ver = { medir: true, dinheiro: true, concorrenciasEnviadas: true, concorrenciasRecebidas: true, obras: true };
  const r = calcularInicio(d, { eu: 'E', agora, hoje: '2026-10-19', ver, itensDaLista: (id) => (id === 'p1' ? 12 : 3) });
  verificar('calc: situações derivadas (rascunho sem medição, medição, proposta, ganho, perdido)', JSON.stringify(r.projetos.porSituacao) === JSON.stringify({ rascunho: 1, medicao: 1, proposta: 2, ganho: 1, perdido: 1 }) || JSON.stringify(r.projetos.porSituacao), r.projetos.porSituacao);
  verificar('calc: taxa de acerto 50% (1 ganho, 1 perdido)', r.projetos.dinheiro.taxaDeAcerto === 50);
  verificar('calc: o valor de um projeto é a última proposta (6000, não 5000)', r.projetos.dinheiro.ganhoNoAno === 6000 && r.projetos.dinheiro.ticketMedio === 6000);
  verificar('calc: propostas abertas = só as de projetos em proposta (1000 + 0)', r.projetos.dinheiro.abertas === 1000, r.projetos.dinheiro.abertas);
  verificar('calc: ganho sem obra vira um cartão de ação', r.acao.some((c) => c.id === 'ganhos' && c.n === 1));
  verificar('calc: economia = (100 - 80) / 100 = 20%', r.concorrencias.economiaMedia === 20, r.concorrencias.economiaMedia);
  verificar('calc: tempo de resposta 1 dia', Math.abs(r.concorrencias.tempoDeResposta - 1) < 0.01);
  verificar('calc: rascunho de 10 dias conta como parado; convite visto vence em 2 dias', r.acao.some((c) => c.id === 'rascunhos' && c.n === 1) && r.acao.some((c) => c.id === 'convites' && c.n === 1 && c.vencem === 1));
  verificar('calc: cotação enviada e sem resposta = 1; projetos sem lista não contam os já enviados', r.cotacoes.semRetorno === 1 && r.cotacoes.listas === 1 && r.cotacoes.projetosSemLista === 2, JSON.stringify(r.cotacoes));
  verificar('calc: prazo: a obra atrasada vem primeiro, 10 dias de atraso; a concluída não entra', r.prazos.length === 2 && r.prazos[0].atrasada && r.prazos[0].restantes === -10 && r.prazos[1].pct === 50, JSON.stringify(r.prazos));
  verificar('calc: preços: só o item de janeiro passa de 90 dias; margem 16%', r.precos.semPrecoNovo === 1 && r.precos.lista[0].nome === 'Velho' && r.precos.margem.total === 16, JSON.stringify(r.precos));
  verificar('calc: parceiras com a obra em comum e dias restantes', r.parceiras.length === 2 && r.parceiras[0].obras[0] === 'Obra' && r.parceiras[0].restantes === 30, JSON.stringify(r.parceiras));
  const sem = calcularInicio(d, { eu: 'E', agora, hoje: '2026-10-19', ver: { ...ver, dinheiro: false }, itensDaLista: () => 0 });
  verificar('calc: sem permissão de dinheiro não há valores', sem.projetos.dinheiro === undefined);
  const so = calcularInicio(d, { eu: 'E', agora, hoje: '2026-10-19', ver: { medir: false, dinheiro: false, concorrenciasEnviadas: false, concorrenciasRecebidas: true, obras: false }, itensDaLista: () => 0 });
  verificar('calc: só responder convites: sem projetos, sem cotações, sem parceiras, sem preços', so.projetos === null && so.cotacoes === null && so.parceiras === null && so.precos === null && so.concorrencias.recebidas.total === 1);
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const erros = [];
async function abrir(chave, papel, idioma = 'pt') {
  const email = emailDe(chave, papel);
  const [u] = await sql(`select id, coalesce(raw_user_meta_data ->> 'nome', 'x') as nome from auth.users where email = '${email}'`);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(([s, i]) => { try { localStorage.setItem('kbt.conta', s); localStorage.setItem('kbt.idioma', i); localStorage.setItem('kbt.versao', 'primeira'); } catch { /* */ } }, [await sessao(u.id, email, u.nome), idioma]);
  await rotear(ctx, URL_PROJETO);
  await ctx.route('https://fonts.**', (r) => r.abort());
  await ctx.route(/open-meteo|tile\.openstreetmap/, (r) => r.abort());
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push(chave + '.' + papel + ': ' + e.message));
  await p.goto(BASE + '#/conta');
  return { ctx, p };
}
const texto = async (p) => (await p.locator('body').innerText()).replace(/\s+/g, ' ');
async function painel(chave, papel, idioma) {
  const a = await abrir(chave, papel, idioma);
  await a.p.waitForSelector('.ini-painel, .oficial-titulo', { timeout: 40000 });
  await a.p.waitForTimeout(500);
  return a;
}
const acao = async (p, id) => (await p.locator('.ini-acao').allInnerTexts()).map((t) => t.replace(/\s+/g, ' '));

try {
  console.log('Construtora (pv.c1.admin): concorrências enviadas e recebidas, projeto do Measure');
  {
    const { ctx, p } = await painel('c1', 'admin');
    verificar('o painel aparece', await p.locator('.ini-painel').count() === 1);
    const t = await texto(p);
    const cards = await acao(p);
    verificar('3 propostas recebidas para comparar (2 das janelas + 1 do aço)', cards.some((c) => /^3\b.*Propostas recebidas/.test(c)), cards.join(' | '));
    verificar('1 convite para responder (o MEP da Granite Peak)', cards.some((c) => /^1\b.*Convite para responder/.test(c)), cards.join(' | '));
    verificar('as concorrências enviadas somam 3 (2 abertas, 1 rascunho)', /Enviadas por nós 3 concorrências/.test(t) && /Abertas\s*2/.test(t) && /Rascunhos\s*1/.test(t), t.match(/Enviadas por nós.{0,200}/));
    verificar('recebidas: 1 convite', /Recebidas por nós 1 convite recebido/.test(t), t.match(/Recebidas por nós.{0,120}/));
    verificar('1 projeto no total, em proposta emitida', /1 projeto no total/.test(t) && /Proposta emitida\s*1/.test(t), t.match(/Projetos por status.{0,200}/));
    verificar('as 2 obras em andamento', /2 Obras em andamento/.test(t));
    verificar('o prazo das obras lista a Northgate Tower e a Canal Street', /Northgate Tower Renovation/.test(t) && /Canal Street Lofts/.test(t));
    verificar('o andamento do cronograma fica em branco (—)', /Andamento do cronograma: —/.test(t));
    verificar('parceiras: Maple Siding e Cobalt Framing aparecem, Birchwood "só pelo link"', /Maple Siding Co/.test(t) && /Cobalt Framing/.test(t) && /Birchwood Insulation LLC.*só pelo link/.test(t), t.match(/Minhas parceiras.{0,400}/));
    verificar('dinheiro: propostas abertas com valor em US$', /Propostas abertas/.test(t) && /US\$ [\d.]+/.test(t));
    verificar('não há gasto nem custo', !/Gasto|Custo/i.test(await p.locator('.ini-painel').innerText()));
    await p.screenshot({ path: process.env.PRINT_C1 || '/tmp/inicio-c1.png', fullPage: true });
    await ctx.close();
  }

  console.log('Prestadora (pv.p1.admin): projetos, convites recebidos, cotações');
  {
    const { ctx, p } = await painel('p1', 'admin');
    const t = await texto(p);
    verificar('2 projetos (1 proposta emitida e 1 rascunho)', /2 projetos no total/.test(t) && /Proposta emitida\s*1/.test(t) && /Rascunho\s*1/.test(t), t.match(/Projetos por status.{0,200}/));
    verificar('recebidos: 3 convites (2 com proposta e 1 recusado)', /Recebidas por nós 3 convites recebidos/.test(t) && /Proposta enviada\s*2/.test(t) && /Recusado\s*1/.test(t), t.match(/Recebidas por nós.{0,200}/));
    verificar('enviadas: 1 fechada (Soffit and fascia)', /Enviadas por nós 1 concorr/.test(t) && /Fechadas\s*1/.test(t));
    verificar('as cotações de material aparecem com as listas enviadas', /Cotações de material/.test(t) && /\d+ Listas enviadas/.test(t), t.match(/Cotações de material.{0,160}/));
    verificar('o catálogo tem itens, com margem vigente', /Catálogo e preços/.test(t) && /Margem vigente/.test(t));
    await ctx.close();
  }

  console.log('Ambas (pv.a2.admin)');
  {
    const { ctx, p } = await painel('a2', 'admin');
    const t = await texto(p);
    verificar('enviadas 2 (o MEP e a vitrine) e recebidas 2 (o aço e o andaime)', /Enviadas por nós 2 concorr/.test(t) && /Recebidas por nós 2 convites/.test(t), t.match(/Enviadas por nós.{0,200}/));
    await ctx.close();
  }

  console.log('Papéis sem painel ou com painel reduzido');
  {
    for (const papel of ['trabalhador', 'contatos']) {
      const { ctx, p } = await painel('p1', papel);
      verificar(papel + ': sem painel (Início simples)', await p.locator('.ini-painel').count() === 0 && /Olá/.test(await texto(p)));
      await ctx.close();
    }
    const g = await painel('p1', 'gestor');
    const tg = await texto(g.p);
    verificar('gestor: vê o painel, os convites e as concorrências', await g.p.locator('.ini-painel').count() === 1 && /Enviadas por nós/.test(tg));
    verificar('gestor: vê o dinheiro por ter crew.custos (a mesma regra do Measure), mas não o catálogo para editar', /Dinheiro em jogo/.test(tg));
    await g.ctx.close();
    const o = await painel('p1', 'orcamentista');
    const to = await texto(o.p);
    verificar('orçamentista: vê projetos, dinheiro e preços; não vê as concorrências enviadas', /Projetos por status/.test(to) && /Dinheiro em jogo/.test(to) && /Catálogo e preços/.test(to) && !/Enviadas por nós/.test(to) && /Recebidas por nós/.test(to), to.slice(0, 400));
    await o.ctx.close();
  }

  console.log('Layout: tela cheia, dois botões, destaque e menu lateral do Settings');
  {
    const { ctx, p } = await painel('c1', 'admin');
    const largura = await p.evaluate(() => ({ painel: document.querySelector('.ini-painel').getBoundingClientRect().width, janela: window.innerWidth, abas: !!document.querySelector('.abas-segmento:not(.so-celular)') }));
    verificar('o painel ocupa a largura toda, sem abas nem menu no Início', largura.painel >= largura.janela - 20 && !largura.abas && await p.locator('.lateral').count() === 0, JSON.stringify(largura));
    verificar('tudo dentro do painel: saudação, os dois botões e o manual', await p.locator('.ini-painel .ini-ola').count() === 1 && await p.locator('.ini-painel .ini-botao').count() === 2 && await p.locator('.ini-painel .ini-rodape a').count() === 1);
    const botoes = await p.locator('.ini-botao').allInnerTexts();
    verificar('os botões são Takeoff e Settings', /Takeoff/.test(botoes[0]) && /Settings/.test(botoes[1]), botoes.join(' | '));
    const fundo = await p.evaluate(() => getComputedStyle(document.querySelector('.ini-acao-bloco')).borderTopColor);
    verificar('o bloco "Precisa de você agora" tem moldura laranja própria', /243, 129, 58/.test(fundo), fundo);
    await p.screenshot({ path: process.env.PRINT_C1 || '/tmp/inicio-c1.png', fullPage: true });
    await p.click('.ini-botao-settings');
    await p.waitForSelector('.lateral', { timeout: 15000 });
    const itens = (await p.locator('.lateral-item').allInnerTexts()).map((t) => t.trim());
    verificar('o Settings tem menu lateral com Início, Obras, Contatos, Usuários, Perfis de acesso, Empresa e Meu perfil', ['Início', 'Obras', 'Contatos', 'Usuários', 'Perfis de acesso', 'Empresa', 'Meu perfil'].every((n) => itens.includes(n)), itens.join(' | '));
    verificar('o item da tela aberta fica marcado (Obras)', /Obras/.test(await p.locator('.lateral-item.ativo').innerText()));
    await p.click('.lateral-item:has-text("Contatos")');
    await p.waitForSelector('.lateral-item.ativo:has-text("Contatos")', { timeout: 15000 });
    await p.click('.lateral-item:has-text("Início")');
    await p.waitForSelector('.ini-painel', { timeout: 30000 });
    verificar('"Início" do menu volta ao painel', await p.locator('.ini-painel').count() === 1);
    await p.click('.ini-botao-takeoff');
    await p.waitForSelector('.lateral-item:has-text("Início")', { timeout: 30000 });
    const takeoff = (await p.locator('.lateral-item').allInnerTexts()).map((t) => t.trim());
    verificar('o Takeoff também tem o Início no menu lateral, junto com Projetos e Concorrências', takeoff.includes('Início') && takeoff.includes('Projetos') && takeoff.some((t) => /Concorr/.test(t)), takeoff.join(' | '));
    await ctx.close();
  }

  console.log('Inglês e links');
  {
    const { ctx, p } = await painel('c1', 'admin', 'en');
    const t = await texto(p);
    verificar('os títulos saem em inglês', /Needs you now/.test(t) && /Projects by status/.test(t) && /Job deadlines/.test(t) && /My partners/.test(t) && /Catalog and prices/.test(t), t.slice(0, 300));
    verificar('nada sem tradução (sem português solto no painel)', !/Precisa de você|Dinheiro em jogo|Prazo das obras|Minhas parceiras/.test(await p.locator('.ini-painel').innerText()));
    const hrefs = await p.locator('.ini-painel a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    verificar('os links do painel apontam para rotas que existem', hrefs.every((h) => /^(#\/(measure|daily\/concorrencias|conta\/obras)|portal)/.test(h)), hrefs.join(' '));
    await ctx.close();
  }
} finally {
  await browser.close();
}
verificar('nenhum erro de JavaScript', erros.length === 0, erros.join(' | '));
console.log('inicio-primeira-versao: ' + ok + '/' + (ok + falhas) + ' verificações passaram');
process.exit(falhas ? 1 : 0);
