/* KORbuild — telas da página oficial com um Supabase FALSO em memória (sem rede).
 * Confere que as telas dos cadastros (fatia 2) desenham, que os formulários mandam o que o banco espera e que nada
 * quebra na página. As regras de acesso de verdade são testadas no banco (supabase/testes/, tools/banco-local.sh)
 * e contra o Supabase (tests/conta.test.mjs).
 * Uso: suba um servidor na pasta do projeto (python3 -m http.server 8123) e rode
 *   node tests/oficial-simulado.test.mjs [http://localhost:8123/] */

import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:8123/';
let falhas = 0, passos = 0;
function verificar(cond, texto, detalhe) {
  passos++;
  if (cond) console.log('  ok  ' + texto);
  else { falhas++; console.log('FALHA ' + texto + (detalhe !== undefined ? '\n      encontrado: ' + JSON.stringify(detalhe) : '')); }
}

/* O cliente falso: tabelas em memória, o encadeamento que js/conta.js e js/cadastros.js usam, e um registro das gravações. */
const FALSO = `
(() => {
  const user = { id: 'u-ana', email: 'ana@example.com', user_metadata: { nome: 'Ana', idioma: 'pt' } };
  let seq = 1;
  const id = () => 'id-' + (seq++);
  const db = window.__db = {
    membros: [{ id: 'm-ana', empresa_id: 'e1', user_id: 'u-ana', perfil_id: 'p-adm', nome: 'Ana Ribeiro', telefone: '', ativo: true, criado_em: '1' },
              { id: 'm-joe', empresa_id: 'e1', user_id: 'u-joe', perfil_id: 'p-enc', nome: 'Joe Foreman', telefone: '', ativo: true, criado_em: '2' }],
    empresas: [{ id: 'e1', nome: 'Northfield Framing', atuacao: 'prestadora', modulos: ['daily','crew','measure'], plano: { nome: 'Teste' } }],
    perfis_acesso: [
      { id: 'p-adm', nome: 'Administrador', chave: 'administrador', sistema: true, criado_em: '1', permissoes: ['settings.acesso','settings.conta','settings.funcionarios','settings.regras','settings.contatos','settings.obras','crew.custos'] },
      { id: 'p-enc', nome: 'Encarregado', chave: 'encarregado', sistema: false, criado_em: '2', permissoes: ['daily.preencher','crew.ponto.equipe'] }],
    convites_usuario: [], funcionarios: [], funcionario_valores: [], encargos_versoes: [], regras_jornada_versoes: [],
    contatos: [], obras: [], alocacoes: [], modelos_cronograma: [], auditoria: [],
  };
  const gravacoes = window.__gravacoes = [];
  const agora = () => new Date().toISOString();
  function consulta(t) {
    let filtro = null, op = 'select', dados = null, umSo = false;
    const q = {
      select() { return q; }, order() { return q; },
      eq(c, v) { filtro = [c, v]; return q; },
      insert(d) { op = 'insert'; dados = d; return q; },
      update(d) { op = 'update'; dados = d; return q; },
      delete() { op = 'delete'; return q; },
      single() { umSo = true; return q; }, maybeSingle() { umSo = true; return q; },
      then(ok, falha) { return Promise.resolve(exec()).then(ok, falha); },
    };
    function exec() {
      const lista = db[t] = db[t] || [];
      const casa = (r) => !filtro || r[filtro[0]] === filtro[1];
      if (op === 'select') {
        // simula uma leitura que falha no meio (rede, troca de token): a tela não pode "perder" as permissões
        if (window.__falharUmaVez === t) { window.__falharUmaVez = null; return { data: null, error: { message: 'Failed to fetch' } }; }
        const r = lista.filter(casa); return { data: umSo ? r[0] || null : r, error: null };
      }
      gravacoes.push({ t, op, dados, filtro });
      if (op === 'insert') {
        const linhas = (Array.isArray(dados) ? dados : [dados]).map((d) => ({ id: id(), empresa_id: 'e1', criado_em: agora(), em: agora(), por: 'u-ana', ...d }));
        lista.push(...linhas);
        return { data: umSo ? linhas[0] : linhas, error: null };
      }
      if (op === 'update') { lista.filter(casa).forEach((r) => Object.assign(r, dados)); return { data: null, error: null }; }
      if (op === 'delete') { db[t] = lista.filter((r) => !casa(r)); return { data: null, error: null }; }
    }
    return q;
  }
  window.supabase = { createClient() { return {
    auth: { onAuthStateChange() {}, getSession: async () => ({ data: { session: { user } } }), updateUser: async () => ({ data: { user }, error: null }), signOut: async () => ({}) },
    from: consulta,
    rpc: async (nome, a) => {
      gravacoes.push({ t: 'rpc', op: nome, dados: a });
      if (nome === 'criar_funcionario') {
        const f = { id: id(), empresa_id: 'e1', ...a.p };
        db.funcionarios.push(f);
        db.funcionario_valores.push({ id: id(), funcionario_id: f.id, desde: a.p.admissao, valor: a.p_valor, motivo: 'Admissão', por: 'u-ana', em: agora() });
        return { data: f.id, error: null };
      }
      return { data: null, error: null };
    },
  }; } };
})();`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const erros = [];
async function pagina(idioma, largura) {
  const ctx = await browser.newContext({ viewport: { width: largura || 1280, height: 900 } });
  await ctx.addInitScript((i) => { try { localStorage.setItem('kbt.idioma', i); } catch { /* */ } }, idioma);
  await ctx.route('**/vendor/supabase/supabase.js', (r) => r.fulfill({ contentType: 'text/javascript', body: FALSO }));
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push(e.message));
  return p;
}
const ir = async (p, hash, seletor) => { await p.goto(BASE + hash); await p.waitForSelector(seletor, { timeout: 15000 }).catch(() => null); };
const gravou = (p, t, op) => p.evaluate(([t, op]) => window.__gravacoes.filter((g) => g.t === t && g.op === op).map((g) => g.dados), [t, op]);
const esperarToast = (p) => p.waitForTimeout(400);

try {
  const a = await pagina('pt');
  console.log('Abas');
  await ir(a, '#/conta', '.abas-segmento');
  const abas = await a.locator('.oficial-pagina > .abas-segmento a').allInnerTexts();
  verificar(['Obras', 'Funcionários', 'Contatos', 'Regras', 'Usuários'].every((x) => abas.includes(x)), 'o Administrador vê as abas dos cadastros', abas);

  console.log('Leitura que falha no meio');
  await ir(a, '#/conta/perfis', '.perfil-cartao');
  await a.evaluate(() => { window.__falharUmaVez = 'perfis_acesso'; });
  await a.fill('#np-nome', 'Perfil X'); await a.selectOption('#np-base', { label: 'Encarregado' });
  await a.click('[data-acao="of-novo-perfil"]'); await a.waitForTimeout(800);
  verificar(a.url().endsWith('#/conta/perfis') && await a.locator('.perfil-cartao').count() >= 2, 'uma leitura que falha não tira o Administrador da aba Perfis', a.url());
  verificar((await a.locator('.oficial-pagina > .abas-segmento a').allInnerTexts()).includes('Usuários'), 'nem esconde as abas de quem cuida dos acessos');

  console.log('Contatos');
  await ir(a, '#/conta/contatos/novo', '#form-contato');
  await a.fill('#ct-nome', 'Granite Builders'); await a.check('input[name="papeis"][value="construtora"]');
  await a.click('[data-acao="cad-salvar-contato"]'); await a.waitForSelector('a[href^="#/conta/contatos/id-"]', { timeout: 5000 }).catch(() => null);
  const ct = await gravou(a, 'contatos', 'insert');
  verificar(ct.length === 1 && ct[0].nome === 'Granite Builders' && ct[0].papeis.join() === 'construtora' && ct[0].etapas.length === 0, 'contato novo gravado com o marcador', ct);
  verificar((await a.locator('body').innerText()).includes('Granite Builders'), 'o contato aparece na lista');
  await ir(a, '#/conta/contatos/novo', '#form-contato');
  await a.fill('#ct-nome', 'Sem marcador'); await a.click('[data-acao="cad-salvar-contato"]'); await esperarToast(a);
  verificar((await gravou(a, 'contatos', 'insert')).length === 1, 'contato sem marcador não vai para o banco');

  console.log('Obras');
  await ir(a, '#/conta/obras/nova', '#form-obra');
  verificar(await a.locator('#ob-responsavelId option', { hasText: 'Joe Foreman' }).count() === 1 && await a.locator('#ob-responsavelId option', { hasText: 'Ana Ribeiro' }).count() === 0,
    'quem preenche o diário: só quem tem a permissão (o Encarregado)');
  await a.fill('#ob-nome', 'Atlantic Ave'); await a.selectOption('#ob-contratanteId', { label: 'Granite Builders' });
  await a.fill('#ob-municipio', 'Manchester'); await a.fill('#ob-estado', 'nh'); await a.fill('#ob-lat', '42.99'); await a.fill('#ob-lon', '-71.46');
  await a.fill('#ob-inicio', '2026-10-01'); await a.fill('#ob-prazo', '2026-12-15'); await a.selectOption('#ob-responsavelId', { label: 'Joe Foreman' });
  await a.click('[data-acao="cad-salvar-obra"]'); await a.waitForSelector('#equipe-obra', { timeout: 5000 }).catch(() => null);
  const ob = (await gravou(a, 'obras', 'insert'))[0] || {};
  verificar(ob.nome === 'Atlantic Ave' && ob.estado === 'NH' && ob.lat === 42.99 && ob.raio === 150 && ob.dias_trabalho.join() === '1,2,3,4,5' && ob.responsavel_id === 'm-joe' && !('empresa_id' in ob) && !('vinculo_empresa_id' in ob),
    'obra gravada com o que o banco espera (sem empresa nem ligação entre obras)', ob);
  verificar(a.url().includes('#/conta/obras/id-'), 'depois de criar, abre a obra com a equipe', a.url());
  await a.selectOption('#al-quem', { label: 'Joe Foreman · usuário' }); await a.fill('#al-papel', 'Encarregado');
  await a.click('[data-acao="cad-alocar"]'); await a.waitForTimeout(500);
  const al = await gravou(a, 'alocacoes', 'insert');
  verificar(al.length === 1 && al[0].membro_id === 'm-joe' && al[0].papel === 'Encarregado', 'pessoa incluída na obra', al);
  verificar(await a.locator('#equipe-obra li').count() === 1, 'a equipe da obra mostra quem foi incluído');

  console.log('Funcionários e valor hora');
  await ir(a, '#/conta/funcionarios/novo', '#form-func');
  await a.fill('#ff-nome', 'Carlos Mendes'); await a.fill('#ff-funcao', 'Carpenter'); await a.fill('#ff-admissao', '2026-01-05'); await a.fill('#ff-valorHora', '32.5');
  await a.fill('input[name="cert-nome-0"]', 'OSHA 10'); await a.fill('input[name="cert-validade-0"]', '2027-01-01');
  await a.click('[data-acao="cad-salvar-func"]'); await a.waitForSelector('#form-valor-hora', { timeout: 5000 }).catch(() => null);
  const cf = (await gravou(a, 'rpc', 'criar_funcionario'))[0] || {};
  verificar(cf.p_valor === 32.5 && cf.p && cf.p.nome === 'Carlos Mendes' && cf.p.certificacoes.length === 1 && cf.p.desligamento === null, 'funcionário cadastrado com o valor da admissão e a certificação', cf);
  verificar((await a.locator('body').innerText()).includes('OSHA 10'), 'a página do funcionário mostra a certificação');
  await a.fill('#vh-valor', '34'); await a.fill('#vh-motivo', 'Reajuste'); await a.click('[data-acao="cad-valor-hora"]'); await a.waitForTimeout(500);
  const vh = await gravou(a, 'funcionario_valores', 'insert');
  verificar(vh.length === 1 && vh[0].valor === 34 && vh[0].motivo === 'Reajuste', 'novo valor hora gravado como versão nova', vh);
  verificar(await a.locator('.tabela-valores tbody tr').count() === 2, 'o histórico mostra os dois valores');

  console.log('Regras');
  await ir(a, '#/conta/regras/encargos', '#form-encargos');
  verificar(await a.locator('#form-encargos input[name="nome-0"]').inputValue() !== '', 'a primeira versão dos encargos já vem preenchida com os comuns');
  await a.fill('#enc-motivo', 'Tabela 2026'); await a.click('[data-acao="cad-salvar-encargos"]'); await a.waitForSelector('.lista-regras, .tabela', { timeout: 5000 }).catch(() => null);
  const en = (await gravou(a, 'encargos_versoes', 'insert'))[0] || {};
  verificar(en.itens && en.itens.length === 5 && en.motivo === 'Tabela 2026', 'encargos gravados como versão', en);
  await ir(a, '#/conta/regras/jornada', '#form-regra');
  await a.click('[data-acao="settings-modelo"][data-modelo="diaria"]');
  await a.fill('#rg-motivo', 'Regra inicial'); await a.click('[data-acao="cad-salvar-regra"]'); await a.waitForTimeout(600);
  const rg = (await gravou(a, 'regras_jornada_versoes', 'insert'))[0] || {};
  verificar(rg.diaria && rg.diaria.ativo === true && rg.semanal.limite === 40 && rg.motivo === 'Regra inicial', 'regra de jornada gravada a partir do modelo', rg);
  verificar(a.url().endsWith('#/conta/regras') && (await a.locator('body').innerText()).includes('Total sobre o salário'), 'a página de regras mostra a versão vigente');

  console.log('Modelos de etapas');
  await ir(a, '#/conta/obras/modelos/novo', '#form-modelo');
  await a.fill('#md-nome', 'Casa'); await a.fill('#md-linhas [name="etapaNome"]', 'Framing'); await a.fill('#md-linhas [name="etapaPct"]', '60');
  await a.click('[data-acao="modelo-nova-linha"]');
  await a.locator('#md-linhas [name="etapaNome"]').nth(1).fill('Siding'); await a.locator('#md-linhas [name="etapaPct"]').nth(1).fill('40');
  await a.click('[data-acao="cad-salvar-modelo"]'); await a.waitForTimeout(500);
  const md = (await gravou(a, 'modelos_cronograma', 'insert'))[0] || {};
  verificar(md.nome === 'Casa' && md.etapas && md.etapas.length === 2 && md.etapas[1].pct === 40, 'modelo de etapas gravado', md);

  console.log('Inglês e celular');
  const b = await pagina('en', 390);
  await ir(b, '#/conta/obras/nova', '#form-obra');
  const txt = await b.locator('body').innerText();
  verificar(txt.includes('Job name') || txt.includes('Job'), 'a tela da obra em inglês', txt.slice(0, 200));
  verificar(await b.evaluate(() => document.documentElement.scrollWidth) <= 390, 'no celular a página não passa da largura da tela', await b.evaluate(() => document.documentElement.scrollWidth));
  verificar(erros.length === 0, 'sem erros na página' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
} finally {
  await browser.close();
}
console.log('\n' + (passos - falhas) + '/' + passos + ' verificações passaram');
process.exit(falhas ? 1 : 0);
