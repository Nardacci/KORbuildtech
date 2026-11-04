/* KORbuild — os dados e os auxiliares dos testes por fluxo (docs/testes/fluxos/README.md), na conta real contra o banco local.
 * A "empresa dos fluxos" nasce do zero a cada rodada, pelas mesmas chamadas do app (criar_empresa e o REST como a pessoa), e é apagada no fim:
 * a rodada começa sempre igual e não deixa resto. Marca: plano.massa = 'fluxo'; logins fluxo.*@example.com (nenhum e-mail sai).
 * Dados fixos (os roteiros citam estes nomes e valores):
 *   Funções: Carpenter US$ 38,00/h e Painter US$ 30,00/h (desde 2026-01-01); encargos 22% (10% + 12%); margens: overhead 9% e lucro 7% (markup)
 *   Itens: FLX-DW Drywall sheet US$ 14,50 · FLX-PT Interior paint US$ 160 · FLX-MO-DW Drywall hanger hour (função Carpenter) · FLX-MO-PT Painter hour (função Painter)
 *   Assemblies: "Fluxo drywall" (FLX-DW MeasuredArea / 32 com 5% de perda + FLX-MO-DW MeasuredArea / 50) e "Fluxo pintura" (FLX-PT / 400 + FLX-MO-PT / 100)
 *   Cliente: Cliente Fluxo LLC. Logins: fluxo.admin (Fábio Fluxo, Administrador) e fluxo.encarregado (Eduardo Encarregado, Encarregado). */

import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

// Por padrão: o banco local (tools/supabase-local.sh). Com --real: o Supabase do js/config.js (precisa de SUPABASE_ACCESS_TOKEN no ambiente).
// No real, a empresa e os logins dos fluxos são criados e apagados no fim (empresa marcada plano.massa = 'fluxo'; logins fluxo.*@example.com).
export const REAL = process.argv.includes('--real');
const local = await import(REAL ? './_supabase-real.mjs' : './_supabase-local.mjs');
export const { sql, sqlExec, rest, sessao, rotear, limparMassa } = local;
export const SENHA_FLUXO = 'Fx1!' + randomUUID().replace(/-/g, '').slice(0, 16);   // nova a cada rodada; só vale para os logins de teste
export const garantirUsuario = (email, nome) => local.garantirUsuario(email, nome, SENHA_FLUXO);
export const AMBIENTE = REAL ? 'conta real, Supabase do projeto, português' : 'conta real, banco local, português';
export const URL_PROJETO = readFileSync(new URL('../js/config.js', import.meta.url), 'utf8').match(/SUPABASE_URL\s*=\s*'([^']+)'/)[1];
export const BASE = (process.argv.slice(2).find((a) => a.startsWith('http')) || 'http://localhost:8123/').replace(/\/?$/, '/');
export const aspas = (t) => String(t).replace(/'/g, "''");
const pad = (n) => String(n).padStart(2, '0');
export const hoje = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
export const somar = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
export const segundaDaSemana = () => { const d = new Date(hoje() + 'T12:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
export const esperarAte = async (fn, ms = 25000, passo = 300) => { const fim = Date.now() + ms; while (Date.now() < fim) { if (await fn()) return true; await new Promise((ok) => setTimeout(ok, passo)); } return false; };
export const texto = async (p, seletor = 'body') => (await p.locator(seletor).innerText()).replace(/\s+/g, ' ');
const rpc = (uid, nome, args) => rest(uid, '/rpc/' + nome, { metodo: 'POST', corpo: args || {} });

export const PESSOAS = {
  admin: { email: 'fluxo.admin@example.com', nome: 'Fábio Fluxo', perfil: 'administrador', cargo: 'Owner' },
  encarregado: { email: 'fluxo.encarregado@example.com', nome: 'Eduardo Encarregado', perfil: 'encarregado', cargo: 'Foreman' },
};
export const NOME_EMPRESA = 'Fluxo QA Prestadora';
/** Quem chega sem empresa no F01 (não entra em PESSOAS: a empresa dos outros fluxos não a conhece). */
export const NOVA = { email: 'fluxo.nova@example.com', nome: 'Nora Nova' };

/** Cria (ou completa) a empresa dos fluxos. Devolve os ids que os testes usam. */
export async function garantirEmpresaFluxo({ catalogo = true } = {}) {
  const ids = {};
  for (const [k, p] of Object.entries(PESSOAS)) ids[k] = await garantirUsuario(p.email, p.nome);
  const adm = ids.admin;
  const [ja] = await sql(`select id from public.empresas where nome = '${aspas(NOME_EMPRESA)}'`);
  const empresaId = ja ? ja.id : await rpc(adm, 'criar_empresa', { p: { nome: NOME_EMPRESA, atuacao: 'prestadora', nome_pessoa: PESSOAS.admin.nome } });
  await sqlExec(`update public.empresas set plano = plano || '{"demo": true, "massa": "fluxo"}'::jsonb where id = '${empresaId}'`);
  // o encarregado entra na empresa com o perfil padrão dele (preenche o diário); o administrador já veio com a empresa
  await sqlExec(`insert into public.membros (empresa_id, user_id, perfil_id, nome, cargo) select '${empresaId}', '${ids.encarregado}', pa.id, '${aspas(PESSOAS.encarregado.nome)}', '${PESSOAS.encarregado.cargo}' from public.perfis_acesso pa where pa.empresa_id = '${empresaId}' and pa.chave = 'encarregado' on conflict do nothing`);
  for (const uid of Object.values(ids)) await sqlExec(`insert into public.notificacao_prefs (user_id, categoria, push, email) select '${uid}', c, true, false from unnest(array['daily','cronograma','concorrencia','crew','conta']) c on conflict (user_id, categoria) do update set email = false`);
  const r = { empresaId, ids, itens: {}, assemblies: {}, funcoes: {} };

  const cli = await rest(adm, '/contatos?select=id&nome=eq.' + encodeURIComponent('Cliente Fluxo LLC'));
  r.clienteId = cli.length ? cli[0].id : (await rest(adm, '/contatos', { metodo: 'POST', corpo: { nome: 'Cliente Fluxo LLC', papeis: ['cliente'], email: 'cliente@fluxo.example.com' } }))[0].id;
  if (!catalogo) return r;

  // encargos e funções com valor hora (docs/funcoes.md)
  if (!(await sql(`select 1 from public.encargos_versoes where empresa_id = '${empresaId}'`)).length) {
    await rest(adm, '/encargos_versoes', { metodo: 'POST', corpo: { desde: segundaDaSemana(), itens: [{ nome: 'Payroll taxes', pct: 10 }, { nome: 'Workers comp', pct: 12 }], motivo: 'Encargos do fluxo' } });
  }
  for (const f of await rest(adm, '/funcoes?select=id,nome')) r.funcoes[f.nome] = f.id;
  for (const [nome, valor] of [['Carpenter', 38], ['Painter', 30]]) {
    if (!(await sql(`select 1 from public.funcao_valores where funcao_id = '${r.funcoes[nome]}'`)).length) await rest(adm, '/funcao_valores', { metodo: 'POST', corpo: { funcao_id: r.funcoes[nome], desde: '2026-01-01', valor, motivo: 'Cadastro do fluxo' } });
  }
  // itens: material com preço digitado; mão de obra ligada à função (o preço vem dela)
  const ITENS = [
    ['FLX-DW', 'Drywall sheet 1/2 in', 'material', 'sheet', '09 29 00 · Gypsum board', 14.5, null],
    ['FLX-PT', 'Interior paint 5 gal', 'material', 'bucket', '09 91 00 · Painting', 160, null],
    ['FLX-MO-DW', 'Drywall hanger hour', 'mao-de-obra', 'hour', '09 29 00 · Gypsum board', null, 'Carpenter'],
    ['FLX-MO-PT', 'Painter hour', 'mao-de-obra', 'hour', '09 91 00 · Painting', null, 'Painter'],
  ];
  for (const [codigo, nome, categoria, unidade, etapa, preco, funcao] of ITENS) {
    let it = (await rest(adm, '/itens?select=id&codigo=eq.' + encodeURIComponent(codigo)))[0];
    if (!it) {
      [it] = await rest(adm, '/itens', { metodo: 'POST', corpo: { codigo, nome, categoria, unidade, etapa, ...(funcao ? { funcao_id: r.funcoes[funcao] } : {}) } });
      if (preco) await rest(adm, '/item_precos', { metodo: 'POST', corpo: { item_id: it.id, desde: somar(hoje(), -30), valor: preco, fonte: 'digitado', por_nome: 'Massa dos fluxos' } });
    }
    r.itens[codigo] = it.id;
  }
  const ASSEMBLIES = [
    ['Fluxo drywall', [['FLX-DW', 'MeasuredArea / 32', 5], ['FLX-MO-DW', 'MeasuredArea / 50', 0]]],
    ['Fluxo pintura', [['FLX-PT', 'MeasuredArea / 400', 0], ['FLX-MO-PT', 'MeasuredArea / 100', 0]]],
  ];
  for (const [nome, linhas] of ASSEMBLIES) {
    let a = (await rest(adm, '/assemblies?select=id&nome=eq.' + encodeURIComponent(nome)))[0];
    if (!a) [a] = await rest(adm, '/assemblies', { metodo: 'POST', corpo: { nome, tipo: 'area', descricao: '', linhas: linhas.map(([c, formula, perda]) => ({ id: randomUUID(), passo: 1, perda, itemId: r.itens[c], formula })) } });
    r.assemblies[nome] = a.id;
  }
  if (!(await sql(`select 1 from public.margens_versoes where empresa_id = '${empresaId}'`)).length) {
    await rest(adm, '/margens_versoes', { metodo: 'POST', corpo: { overhead_pct: 9, lucro_pct: 7, modo: 'markup', imposto_material_pct: 0, desde: segundaDaSemana(), motivo: 'Margens do fluxo' } });
  }
  return r;
}

/** Cria, como o administrador, um projeto já liberado para obra (o gatilho do banco cria a obra). Devolve { projetoId, obraId }. */
export async function criarProjetoLiberado(dados, { nome, tarefas = [], liberado = true } = {}) {
  const [pj] = await rest(dados.ids.admin, '/projetos', { metodo: 'POST', corpo: {
    nome, contratante_id: dados.clienteId, cidade: 'Concord', estado: 'NH', tipo: 'reforma', situacao: 'orcamento',
    cronograma: { tarefas, marcos: [] }, ...(liberado ? { liberado_em: new Date().toISOString(), liberado_por: PESSOAS.admin.nome, inicio_obra: hoje() } : {}) } });   // 0025: o diário é cobrado do início da obra (aqui, hoje), não da primeira tarefa
  const [lido] = await sql(`select id, obra_id from public.projetos where id = '${pj.id}'`);
  return { projetoId: lido.id, obraId: lido.obra_id };
}

/** Apaga a empresa dos fluxos e os logins (a rodada não deixa resto). */
export async function apagarEmpresaFluxo() { await limparMassa('fluxo.%@example.com', "plano ->> 'massa' = 'fluxo'"); }

/** Abre o app, na conta real local, como uma das pessoas. Com campo: true é o celular do canteiro (390 × 844, GPS ligado e clima simulado). */
export async function abrirComo(browser, chave, { idioma = 'pt', larg = 1440, alt = 1100, ir = '#/conta', campo = false, semSessao = false } = {}) {
  const p = typeof chave === 'string' ? PESSOAS[chave] : chave;   // uma pessoa de PESSOAS ou um objeto { email, nome }
  const rotuloErros = typeof chave === 'string' ? chave : 'nova';
  const [u] = await sql(`select id, coalesce(raw_user_meta_data ->> 'nome', 'x') as nome from auth.users where email = '${aspas(p.email)}'`);
  const ctx = await browser.newContext({ viewport: campo ? { width: 390, height: 844 } : { width: larg, height: alt }, ...(campo ? { geolocation: { latitude: 43.2081, longitude: -71.5376, accuracy: 8 }, permissions: ['geolocation'] } : {}) });
  await ctx.addInitScript(([s, i]) => { try { if (s) localStorage.setItem('kbt.conta', s); localStorage.setItem('kbt.idioma', i); localStorage.setItem('kbt.versao', 'primeira'); } catch { /* */ } }, [semSessao ? '' : await sessao(u.id, p.email, u.nome), idioma]);   // semSessao: a pessoa entra pela tela de login
  await rotear(ctx, URL_PROJETO);
  await ctx.route('https://fonts.**', (r) => r.abort());
  await ctx.route('https://tile.openstreetmap.org/**', (r) => r.abort());
  if (campo) {
    await ctx.route('https://api.open-meteo.com/**', (route) => {
      const time = [], weather_code = [], precipitation = [], temperature_2m = [];
      for (let h = 0; h < 24; h++) { time.push(hoje() + 'T' + pad(h) + ':00'); weather_code.push(0); precipitation.push(0); temperature_2m.push(20); }
      route.fulfill({ json: { hourly: { time, weather_code, precipitation, temperature_2m } } });
    });
  } else await ctx.route(/open-meteo/, (r) => r.abort());
  const pagina = await ctx.newPage();
  const erros = [];
  const ruins = [], consoleErros = [];   // diagnóstico: respostas de rede com erro e erros do console (sem cabeçalhos nem chaves)
  pagina.on('response', async (r) => { if (r.status() >= 400 && /supabase\.co|localhost:3001/.test(r.url())) { let corpo = ''; try { corpo = (await r.text()).slice(0, 200); } catch { /* */ } ruins.push(r.request().method() + ' ' + r.url().replace(/^https?:\/\/[^/]+/, '').slice(0, 90) + ' → ' + r.status() + ' ' + corpo); } });
  pagina.on('console', (m) => { if (m.type() === 'error') consoleErros.push(m.text().slice(0, 200)); });
  pagina.on('dialog', (d) => { (d.type() === 'beforeunload' ? d.accept() : d.dismiss()).catch(() => {}); });   // "há alterações não salvas": o teste segue
  pagina.on('pageerror', (e) => erros.push(rotuloErros + ': ' + e.message));
  await pagina.goto(BASE + ir);
  return { ctx, p: pagina, erros, ruins, consoleErros };
}

/** Preenche campos [[seletor, valor, 'texto'|'lista']] e confere que continuam lá meio segundo depois: no Supabase de verdade o app redesenha o
 *  formulário quando os dados do banco chegam e apaga o que foi digitado. Repete até 4 vezes. */
export async function preencher(p, campos) {
  await p.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => { /* a conexão em tempo real pode não aquietar: segue */ });
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    for (const [sel, valor, tipo] of campos) { if (tipo === 'lista') await p.selectOption(sel, valor); else await p.fill(sel, String(valor)); }
    await p.waitForTimeout(600);
    let ok = true;
    for (const [sel, valor] of campos) if ((await p.locator(sel).inputValue().catch(() => null)) !== String(valor)) ok = false;
    if (ok) return true;
  }
  return false;
}

/** Abre uma rota e espera um elemento; com a rede lenta a tela às vezes não redesenha: recarrega uma vez. */
export async function irPara(p, hash, seletor, ms = 40000) {
  await p.goto('about:blank');
  await p.goto(BASE + hash);
  if (await p.waitForSelector(seletor, { timeout: ms }).catch(() => null)) return true;
  await p.reload();
  await p.waitForSelector(seletor, { timeout: ms });
  return true;
}
