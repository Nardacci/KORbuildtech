/* KORbuild — teste de SEGURANÇA pela API (o que um atacante de verdade consegue fazer só com o endereço do projeto e a chave pública).
 * Complementa supabase/testes/0011_seguranca.sql (que olha o catálogo do banco): aqui as chamadas saem pelo REST, pelo Auth e pelo Storage, como
 * sairiam de um navegador ou de um script de fora.
 *   1. Sem entrar (anon): nenhuma tabela, nenhuma função do app.
 *   2. Tokens adulterados (assinatura trocada, "alg none", papel service_role escrito à mão, dono trocado): todos recusados.
 *   3. Isolamento entre empresas: quem entrou só vê a própria empresa em TODAS as tabelas; não altera nem apaga a do vizinho.
 *   4. Escalada de privilégio: mudar o próprio plano/módulos, virar administrador da plataforma, trocar de empresa/perfil, escrever avisos.
 *   5. Injeção em filtros e no código do link público.
 *   6. Storage (só com --real): fotos e plantas de outra empresa, upload fora da pasta, tipo e tamanho proibidos, bucket público.
 *   7. Configuração do Auth do projeto (só com --real): confirmação de e-mail, cadastro anônimo, tamanho da senha, rotação de token.
 * Uso: node tests/seguranca.test.mjs [--real]   (local: Supabase local por tools/supabase-local.sh; --real: Supabase do projeto, com SUPABASE_ACCESS_TOKEN)
 * Cria só usuários kb-e2e-daily-sec-… (apagados no fim com as empresas deles). Os ataques que dariam certo SE houvesse falha usam só dados criados aqui;
 * nas empresas da massa de demonstração o teste apenas LÊ. */

import { readFileSync } from 'node:fs';

const REAL = process.argv.includes('--real');
const { sql, rest, criarUsuario, sessao, limpar, nome } = await import(REAL ? './_supabase-real.mjs' : './_supabase-local.mjs');
console.log('Segurança contra: ' + nome);
const CONFIG = readFileSync(new URL('../js/config.js', import.meta.url), 'utf8');
const URL_PROJETO = CONFIG.match(/SUPABASE_URL\s*=\s*'([^']+)'/)[1].replace(/\/$/, '');
const ANON = CONFIG.match(/SUPABASE_ANON_KEY\s*=\s*'([^']+)'/)[1];
const REST = REAL ? URL_PROJETO + '/rest/v1' : (process.env.POSTGREST_URL || 'http://localhost:3001');

let falhas = 0, passos = 0;
function verificar(cond, texto, detalhe) {
  passos++;
  if (cond) console.log('  ok  ' + texto);
  else { falhas++; console.log('FALHA ' + texto + (detalhe !== undefined ? '\n      encontrado: ' + (typeof detalhe === 'string' ? detalhe : JSON.stringify(detalhe).slice(0, 400)) : '')); }
}

/* Um pedido bruto à API, com o token que eu quiser (ou nenhum). Devolve { status, corpo }. */
async function api(token, caminho, { metodo = 'GET', corpo, base = REST, cabecalhos = {}, bruto } = {}) {
  const h = { ...(REAL ? { apikey: ANON } : {}), ...cabecalhos };
  if (token !== null) h.Authorization = 'Bearer ' + token;
  if (corpo !== undefined && !bruto && !h['Content-Type']) h['Content-Type'] = 'application/json';
  if (!h.Prefer && base === REST) h.Prefer = 'return=representation';
  const r = await fetch(base + caminho, { method: metodo, headers: h, body: bruto !== undefined ? bruto : (corpo !== undefined ? JSON.stringify(corpo) : undefined) });
  const t = await r.text();
  let c = t; try { c = t ? JSON.parse(t) : null; } catch { /* texto */ }
  return { status: r.status, corpo: c };
}
const barrado = (r) => r.status >= 400 || (r.status >= 200 && r.status < 300 && (r.corpo === null || (Array.isArray(r.corpo) && r.corpo.length === 0)));
const recusado = (r) => r.status >= 400;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

/* ---------- A cena: duas empresas que não se conhecem e uma terceira pessoa ---------- */
await limpar();
const EM = { a: 'kb-e2e-daily-sec-a@example.com', b: 'kb-e2e-daily-sec-b@example.com', c: 'kb-e2e-daily-sec-c@example.com' };
const idA = await criarUsuario(EM.a, 'Ana Sec'), idB = await criarUsuario(EM.b, 'Beto Sec'), idC = await criarUsuario(EM.c, 'Cris Sec');
const tok = async (id, email) => JSON.parse(await sessao(id, email, 'sec')).access_token;
const tA = await tok(idA, EM.a), tB = await tok(idB, EM.b), tC = await tok(idC, EM.c);
const empA = await rest(idA, '/rpc/criar_empresa', { metodo: 'POST', corpo: { p: { nome: 'Sec Empresa A', atuacao: 'prestadora' } } });
const empB = await rest(idB, '/rpc/criar_empresa', { metodo: 'POST', corpo: { p: { nome: 'Sec Empresa B', atuacao: 'construtora' } } });
// a empresa A tem alguns dados de verdade (um contato e um funcionário), para os ataques terem o que roubar
await rest(idA, '/contatos', { metodo: 'POST', corpo: { empresa_id: empA, nome: 'Cliente Secreto da A', papeis: ['cliente'] } }).catch(() => {});
await rest(idA, '/rpc/criar_funcionario', { metodo: 'POST', corpo: { p: { nome: 'Funcionário Secreto', funcao: 'Carpenter' }, p_valor: 30 } }).catch(() => {});

const tabelas = (await sql(`select c.relname as tabela, exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'empresa_id' and not a.attisdropped) as tem_empresa
                              from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' order by 1`));
const comEmpresa = tabelas.filter((x) => x.tem_empresa).map((x) => x.tabela);
console.log(tabelas.length + ' tabelas no schema public (' + comEmpresa.length + ' com empresa_id)');

/* ---------- 1. Sem entrar ---------- */
console.log('\n1. Sem entrar (anon)');
{
  const vazaram = [];
  for (const { tabela: t } of tabelas) {
    const r = await api(null, '/' + t + '?select=*&limit=5');
    if (!barrado(r)) vazaram.push(t + ' (' + r.status + ')');
  }
  verificar(!vazaram.length, 'anon não lê nenhuma das ' + tabelas.length + ' tabelas', vazaram);
  const escreveu = [];
  for (const { tabela: t } of tabelas) {
    const r = await api(null, '/' + t, { metodo: 'POST', corpo: {} });
    if (r.status < 400) escreveu.push(t + ' (' + r.status + ')');
    const d = await api(null, '/' + t + '?id=not.is.null', { metodo: 'DELETE' });
    if (!barrado(d)) escreveu.push('DELETE ' + t + ' (' + d.status + ')');
  }
  verificar(!escreveu.length, 'anon não insere nem apaga em nenhuma tabela', escreveu);
  for (const [fn, corpo] of [['eh_admin_plataforma', {}], ['minha_empresa', {}], ['ligar_sistema', { ligado: true }], ['criar_empresa', { p: { nome: 'Anon' } }], ['admin_empresas', {}], ['admin_alterar_plano', {}]]) {
    const r = await api(null, '/rpc/' + fn, { metodo: 'POST', corpo });
    verificar(recusado(r), 'anon não chama ' + fn + '()', r);
  }
  const link = await api(null, '/rpc/diario_por_codigo', { metodo: 'POST', corpo: { p_codigo: 'CODIGO-QUE-NAO-EXISTE' } });
  verificar(link.status < 500 && (link.corpo === null || link.status >= 400 || !(link.corpo && (link.corpo.rdo || link.corpo.diario))), 'o link público não devolve diário para um código que não existe', link);
}

/* ---------- 2. Tokens adulterados ---------- */
console.log('\n2. Tokens adulterados');
{
  const [h, p, s] = tB.split('.');
  const carga = JSON.parse(Buffer.from(p, 'base64url').toString());
  const vizinho = (c) => ({ ...carga, ...c });
  const casos = {
    'assinatura de outro token': tB.slice(0, -4) + (tB.endsWith('AAAA') ? 'BBBB' : 'AAAA'),
    'dono trocado (sub de outra pessoa, assinatura do original)': h + '.' + b64(vizinho({ sub: idA })) + '.' + s,
    'papel service_role escrito à mão': h + '.' + b64(vizinho({ role: 'service_role' })) + '.' + s,
    'sem assinatura': h + '.' + p + '.',
    'alg none': b64({ alg: 'none', typ: 'JWT' }) + '.' + b64(vizinho({ sub: idA })) + '.',
    'alg none com papel service_role': b64({ alg: 'none', typ: 'JWT' }) + '.' + b64(vizinho({ role: 'service_role', sub: undefined })) + '.',
    'lixo': 'undefined',
    'token vazio': '',
  };
  for (const [quando, t] of Object.entries(casos)) {
    const r = await api(t, '/membros?select=user_id,empresa_id&limit=50');
    const viuA = Array.isArray(r.corpo) && r.corpo.some((m) => m.empresa_id === empA);
    verificar(!viuA && (r.status === 401 || r.status === 403 || (r.status === 200 && Array.isArray(r.corpo) && r.corpo.length === 0)), 'token com ' + quando + ' não abre nada', { status: r.status, corpo: r.corpo });
  }
  // a chave pública não dá poder de usuário nem de serviço
  const r1 = await api(ANON, '/empresas?select=*&limit=5');
  verificar(barrado(r1), 'a chave pública usada como token não lê empresas', r1);
  const r2 = await api(ANON, '/rpc/admin_empresas', { metodo: 'POST', corpo: {} });
  verificar(recusado(r2), 'a chave pública usada como token não abre o painel da plataforma', r2);
}

/* ---------- 3. Isolamento entre empresas ---------- */
console.log('\n3. Isolamento entre empresas (B tenta ver e mexer na A)');
{
  // B só enxerga linhas dele em tabelas com empresa_id (nenhuma linha de outra empresa vaza, nem por embutir tabelas)
  const vazou = [];
  for (const t of comEmpresa) {
    const r = await api(tB, '/' + t + '?select=empresa_id&limit=1000');
    if (r.status >= 400) continue;
    const estranhas = (r.corpo || []).filter((x) => x.empresa_id && x.empresa_id !== empB);
    if (estranhas.length) vazou.push(t + ': ' + estranhas.length + ' linhas de outra empresa');
  }
  verificar(!vazou.length, 'em nenhuma das ' + comEmpresa.length + ' tabelas B enxerga linha de outra empresa', vazou);
  const procurando = [];
  for (const t of comEmpresa) {
    const r = await api(tB, '/' + t + '?empresa_id=eq.' + empA + '&select=*&limit=5');
    if (r.status < 400 && Array.isArray(r.corpo) && r.corpo.length) procurando.push(t);
  }
  verificar(!procurando.length, 'B não acha nada da A procurando pelo código da empresa em cada tabela', procurando);
  const emb = await api(tB, '/empresas?select=id,nome,membros(user_id),perfis_acesso(id),funcionarios(nome)');
  verificar(emb.status < 400 && emb.corpo.every((e) => e.id === empB) && !JSON.stringify(emb.corpo).includes('Secreto'), 'B não vê a A nem embutindo tabelas na consulta', emb);
  const direto = await api(tB, '/empresas?id=eq.' + empA + '&select=*');
  verificar(barrado(direto), 'B não lê a empresa A pelo código', direto);

  // massa de demonstração (se existir): lê as tabelas de uma empresa independente de verdade
  const [v] = await sql(`select id from public.empresas where plano ->> 'demo' = 'true' and atuacao <> 'construtora' order by nome limit 1`);
  if (v) {
    const dados = [];
    for (const t of comEmpresa) {
      const r = await api(tB, '/' + t + '?empresa_id=eq.' + v.id + '&select=*&limit=3');
      if (r.status < 400 && Array.isArray(r.corpo) && r.corpo.length) dados.push(t);
    }
    verificar(!dados.length, 'B não lê nenhuma tabela de uma empresa da massa de demonstração', dados);
  } else console.log('  (sem massa de demonstração neste banco: pulei a leitura de uma empresa com dados)');

  // escrita: B tenta mudar e apagar a A
  const antes = (await sql(`select (select count(*) from public.membros where empresa_id = '${empA}') as m, (select count(*) from public.perfis_acesso where empresa_id = '${empA}') as p,
                                   (select nome from public.empresas where id = '${empA}') as nome`))[0];
  const ataques = [
    ['PATCH', '/empresas?id=eq.' + empA, { nome: 'Invadida' }],
    ['PATCH', '/membros?empresa_id=eq.' + empA, { ativo: false }],
    ['PATCH', '/perfis_acesso?empresa_id=eq.' + empA, { permissoes: [] }],
    ['DELETE', '/empresas?id=eq.' + empA],
    ['DELETE', '/membros?empresa_id=eq.' + empA],
    ['DELETE', '/perfis_acesso?empresa_id=eq.' + empA],
  ];
  for (const t of comEmpresa) ataques.push(['DELETE', '/' + t + '?empresa_id=eq.' + empA]);
  const passaram = [];
  for (const [metodo, caminho, corpo] of ataques) {
    const r = await api(tB, caminho, { metodo, corpo });
    if (r.status < 400 && Array.isArray(r.corpo) && r.corpo.length) passaram.push(metodo + ' ' + caminho + ' → ' + r.corpo.length + ' linhas');
  }
  verificar(!passaram.length, 'nenhum PATCH/DELETE de B alcança linhas da A (' + ataques.length + ' tentativas)', passaram);
  const depois = (await sql(`select (select count(*) from public.membros where empresa_id = '${empA}') as m, (select count(*) from public.perfis_acesso where empresa_id = '${empA}') as p,
                                    (select nome from public.empresas where id = '${empA}') as nome`))[0];
  verificar(JSON.stringify(antes) === JSON.stringify(depois), 'a empresa A continua igual no banco', { antes, depois });
  const criou = [];
  for (const t of comEmpresa) {
    const r = await api(tB, '/' + t, { metodo: 'POST', corpo: { empresa_id: empA } });
    if (r.status < 400) criou.push(t + ' (' + r.status + ')');
  }
  verificar(!criou.length, 'B não cria linha em nome da empresa A em nenhuma tabela', criou);
}

/* ---------- 4. Escalada de privilégio ---------- */
console.log('\n4. Escalada de privilégio (A é administradora da própria empresa)');
{
  const plano = async (id) => (await sql(`select plano, modulos, atuacao from public.empresas where id = '${id}'`))[0];
  const antes = await plano(empA);
  const subir = [
    ['o plano', { plano: { nome: 'Enterprise', status: 'ativa', limite_obras: 9999, limite_usuarios: 9999 } }],
    ['o fim do teste', { plano: { ...antes.plano, teste_ate: '2099-12-31' } }],
    ['os módulos', { modulos: ['daily', 'crew', 'measure', 'plataforma'] }],
    ['a atuação', { atuacao: 'construtora' }],
    ['a data de criação', { criada_em: '2099-01-01T00:00:00Z' }],
    ['o código da empresa', { id: '00000000-0000-4000-8000-0000000000ff' }],
  ];
  for (const [que, corpo] of subir) {
    const r = await api(tA, '/empresas?id=eq.' + empA, { metodo: 'PATCH', corpo });
    verificar(recusado(r) || (Array.isArray(r.corpo) && !r.corpo.length), 'A não consegue mudar ' + que + ' da própria empresa', r);
  }
  verificar(JSON.stringify(await plano(empA)) === JSON.stringify(antes), 'plano, módulos e atuação da A não mudaram no banco', await plano(empA));
  const ok = await api(tA, '/empresas?id=eq.' + empA, { metodo: 'PATCH', corpo: { telefone: '603-555-0123', cidade: 'Concord' } });
  verificar(ok.status < 300 && ok.corpo && ok.corpo.length === 1 && ok.corpo[0].cidade === 'Concord', 'o perfil da empresa continua editável (telefone, cidade)', ok);

  // empresa criada com plano/módulos de graça no próprio pedido
  const esperto = await rest(idC, '/rpc/criar_empresa', { metodo: 'POST', corpo: { p: { nome: 'Sec Esperta', atuacao: 'prestadora', plano: { nome: 'Enterprise', status: 'ativa' }, modulos: ['daily', 'crew', 'measure', 'plataforma'], licencas: 'x' } } });
  const pe = await plano(esperto);
  verificar(pe.plano.nome !== 'Enterprise' && pe.plano.status === 'teste' && !pe.modulos.includes('plataforma'), 'criar_empresa ignora plano e módulos escritos no pedido', pe);
  const outra = await api(tC, '/rpc/criar_empresa', { metodo: 'POST', corpo: { p: { nome: 'Segunda' } } });
  verificar(recusado(outra), 'quem já tem empresa não cria uma segunda', outra);

  // plataforma
  const adm = await api(tA, '/rpc/eh_admin_plataforma', { metodo: 'POST', corpo: {} });
  verificar(adm.status === 200 && adm.corpo === false, 'A não é administradora da plataforma', adm);
  for (const [fn, corpo] of [['admin_empresas', {}], ['admin_empresa', { p_empresa: empB }], ['admin_resumo_email', {}], ['admin_fila_email', {}], ['admin_administradores', {}], ['admin_valores_padrao', { p_valores: {} }],
                              ['admin_alterar_plano', { p_empresa: empA, p_plano: { nome: 'Enterprise', status: 'ativa' }, p_motivo: 'x' }], ['admin_alterar_modulos', { p_empresa: empA, p_modulos: ['daily'], p_motivo: 'x' }]]) {
    const r = await api(tA, '/rpc/' + fn, { metodo: 'POST', corpo });
    verificar(recusado(r), 'A não chama ' + fn + '()', r);
  }
  const virar = await api(tA, '/admins_plataforma', { metodo: 'POST', corpo: { user_id: idA } });
  verificar(recusado(virar), 'A não se cadastra em admins_plataforma', virar);
  const lerAdm = await api(tA, '/admins_plataforma?select=*');
  verificar(barrado(lerAdm), 'A não lê a lista de administradores da plataforma', lerAdm);
  const log = await api(tA, '/admin_log?select=*&limit=5');
  verificar(barrado(log), 'A não lê o registro da plataforma', log);
  const logW = await api(tA, '/admin_log', { metodo: 'POST', corpo: { admin_id: idA, acao: 'x' } });
  verificar(recusado(logW), 'A não escreve no registro da plataforma', logW);
  const sis = await api(tA, '/rpc/ligar_sistema', { metodo: 'POST', corpo: { ligado: true } });
  verificar(recusado(sis), 'A não liga o "modo sistema" (ligar_sistema)', sis);

  // vínculo e perfil
  const [perfB] = await sql(`select id from public.perfis_acesso where empresa_id = '${empB}' and chave = 'administrador'`);
  const mudarPerfil = await api(tA, '/membros?user_id=eq.' + idA, { metodo: 'PATCH', corpo: { perfil_id: perfB.id } });
  verificar(recusado(mudarPerfil) || (Array.isArray(mudarPerfil.corpo) && !mudarPerfil.corpo.length), 'A não assume um perfil da empresa B', mudarPerfil);
  const mudarEmpresa = await api(tA, '/membros?user_id=eq.' + idA, { metodo: 'PATCH', corpo: { empresa_id: empB } });
  verificar(recusado(mudarEmpresa) || (Array.isArray(mudarEmpresa.corpo) && !mudarEmpresa.corpo.length), 'A não muda o próprio vínculo para a empresa B', mudarEmpresa);
  const [ainda] = await sql(`select empresa_id from public.membros where user_id = '${idA}'`);
  verificar(ainda && ainda.empresa_id === empA, 'o vínculo da A continua na empresa A', ainda);
  const convitesB = await api(tA, '/convites_usuario?empresa_id=eq.' + empB + '&select=*');
  verificar(barrado(convitesB), 'A não lê convites da empresa B', convitesB);

  // avisos e fila de e-mail
  const aviso = await api(tA, '/notificacoes', { metodo: 'POST', corpo: { user_id: idB, categoria: 'daily', titulo: 'Clique aqui' } });
  verificar(recusado(aviso), 'A não escreve aviso para outra pessoa', aviso);
  const avisoProprio = await api(tA, '/notificacoes', { metodo: 'POST', corpo: { user_id: idA, categoria: 'daily', titulo: 'Eu me avisando' } });
  verificar(recusado(avisoProprio), 'ninguém escreve aviso direto na tabela (só o sistema, pelos gatilhos)', avisoProprio);
  const fila = await api(tA, '/fila_email?select=*&limit=5');
  verificar(barrado(fila), 'A não lê a fila de e-mails', fila);
  const filaW = await api(tA, '/fila_email', { metodo: 'POST', corpo: { empresa_id: empA, para_email: 'vitima@example.com', modelo: 'aviso-link' } });
  verificar(recusado(filaW), 'A não escreve na fila de e-mails (ninguém manda e-mail em nome do KORbuild)', filaW);
  const prefs = await api(tA, '/notificacao_prefs?user_id=eq.' + idB, { metodo: 'PATCH', corpo: { email: false } });
  verificar(recusado(prefs) || (Array.isArray(prefs.corpo) && !prefs.corpo.length), 'A não mexe nas preferências de e-mail do B', prefs);
}

/* ---------- 5. Injeção ---------- */
console.log('\n5. Injeção em filtros e no código do link público');
{
  const filtros = ["' or '1'='1", "x) or (true", '*', '%', 'eq.x,or(id.not.is.null)', '1; drop table empresas; --', 'a%27%20or%20%271%27=%271'];
  const achou = [];
  for (const f of filtros) {
    const r = await api(tB, '/empresas?select=id&nome=eq.' + encodeURIComponent(f));
    if (r.status < 300 && Array.isArray(r.corpo) && r.corpo.some((e) => e.id !== empB)) achou.push(f);
    const r2 = await api(tB, '/empresas?select=id&or=(' + encodeURIComponent(f) + ')');
    if (r2.status < 300 && Array.isArray(r2.corpo) && r2.corpo.some((e) => e.id !== empB)) achou.push('or:' + f);
  }
  verificar(!achou.length, 'filtros maliciosos não trazem empresas de outros', achou);
  const codigos = ["' or 1=1 --", '', '%', '*', 'a'.repeat(5000), "x'); select pg_sleep(5); --"];
  const t0 = Date.now(); let vazou = [];
  for (const c of codigos) {
    const r = await api(null, '/rpc/diario_por_codigo', { metodo: 'POST', corpo: { p_codigo: c } });
    if (r.status < 300 && r.corpo && (r.corpo.rdo || r.corpo.diario || r.corpo.obra)) vazou.push(c.slice(0, 30));
  }
  verificar(!vazou.length, 'o código do link público não aceita injeção nem curinga', vazou);
  verificar(Date.now() - t0 < 4500, 'nenhum código do link público executou comando no banco (pg_sleep)', Date.now() - t0);
  const [n] = await sql(`select count(*) as n from public.empresas where id in ('${empA}', '${empB}')`);
  verificar(Number(n.n) === 2, 'as tabelas continuam lá depois das tentativas de injeção', n);
}

/* ---------- 6. Storage ---------- */
console.log('\n6. Storage');
if (!REAL) console.log('  (o Storage do banco local é de mentira: esta parte só roda com --real)');
else {
  const ST = URL_PROJETO + '/storage/v1';
  const jpeg = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k=', 'base64');
  const subir = (token, bucket, caminho, dados, tipo = 'image/jpeg', extra = {}) =>
    api(token, '/object/' + bucket + '/' + caminho, { metodo: 'POST', base: ST, bruto: dados, cabecalhos: { 'Content-Type': tipo, ...extra } });
  const propria = empA + '/seg/a.jpg';
  const r1 = await subir(tA, 'diarios', propria, jpeg);
  verificar(r1.status < 300, 'A sobe uma foto na pasta da própria empresa', r1);
  const r2 = await subir(tB, 'diarios', empA + '/seg/b.jpg', jpeg);
  verificar(recusado(r2), 'B não sobe arquivo na pasta da empresa A', r2);
  const r3 = await subir(tB, 'diarios', propria, jpeg, 'image/jpeg', { 'x-upsert': 'true' });
  verificar(recusado(r3), 'B não sobrescreve a foto da A (upsert)', r3);
  const r4 = await api(tB, '/object/authenticated/diarios/' + propria, { base: ST });
  verificar(recusado(r4), 'B não baixa a foto da A', r4);
  const r5 = await api(tB, '/object/sign/diarios/' + propria, { metodo: 'POST', base: ST, corpo: { expiresIn: 60 } });
  verificar(recusado(r5), 'B não gera link assinado para a foto da A', r5);
  const r6 = await api(tB, '/object/list/diarios', { metodo: 'POST', base: ST, corpo: { prefix: empA + '/', limit: 100 } });
  verificar(recusado(r6) || (Array.isArray(r6.corpo) && !r6.corpo.length), 'B não lista a pasta da A', r6);
  const r7 = await api(tB, '/object/diarios/' + propria, { metodo: 'DELETE', base: ST });
  const [resta] = await sql(`select count(*) as n from storage.objects where bucket_id = 'diarios' and name = '${propria}'`);
  verificar(Number(resta.n) === 1, 'B não apaga a foto da A (o arquivo continua)', { status: r7.status, resta });
  const r8 = await api(null, '/object/public/diarios/' + propria, { base: ST });
  verificar(recusado(r8), 'a foto não abre por link público (o bucket é privado)', r8);
  const r9 = await api(null, '/object/diarios/' + propria, { base: ST });
  verificar(recusado(r9), 'sem entrar, a foto não abre', r9);
  const r10 = await api(null, '/object/list/diarios', { metodo: 'POST', base: ST, corpo: { prefix: '', limit: 100 } });
  verificar(recusado(r10) || (Array.isArray(r10.corpo) && !r10.corpo.length), 'sem entrar, não se lista bucket nenhum', r10);
  const [alheio] = await sql(`select bucket_id, name from storage.objects where bucket_id in ('diarios', 'plantas', 'ponto', 'concorrencias') and name not like '${empA}/%' and name not like '${empB}/%' limit 1`);
  if (alheio) {
    const r11 = await api(tB, '/object/authenticated/' + alheio.bucket_id + '/' + alheio.name, { base: ST });
    const r12 = await api(tB, '/object/sign/' + alheio.bucket_id + '/' + alheio.name, { metodo: 'POST', base: ST, corpo: { expiresIn: 60 } });
    verificar(recusado(r11) && recusado(r12), 'B não alcança um arquivo real de outra empresa (' + alheio.bucket_id + ')', { baixar: r11.status, assinar: r12.status });
  }
  const r13 = await subir(tA, 'diarios', empA + '/seg/pagina.html', Buffer.from('<script>alert(1)</script>'), 'text/html');
  verificar(recusado(r13), 'um arquivo HTML não entra no bucket de fotos (tipo proibido)', r13);
  const r14 = await subir(tA, 'diarios', empA + '/seg/grande.jpg', Buffer.concat([jpeg, Buffer.alloc(6 * 1024 * 1024)]));
  verificar(recusado(r14), 'uma foto maior que 5 MB não entra (limite do bucket)', r14);
  const r15 = await subir(tA, 'plantas', empA + '/seg/foto.jpg', jpeg);
  verificar(recusado(r15), 'imagem não entra no bucket de plantas (só PDF)', r15);
  const r16 = await subir(tA, 'curriculos', empA + '/seg/x.pdf', Buffer.from('%PDF-1.4'), 'application/pdf');
  verificar(recusado(r16), 'o bucket antigo de currículos não aceita arquivo de ninguém', r16);
  const r17 = await subir(tA, 'diarios', '../' + empB + '/seg/fuga.jpg', jpeg);
  verificar(recusado(r17), 'caminho com ".." não escapa da pasta da empresa', r17);
}

/* ---------- 6b. Funções de borda ---------- */
console.log('\n6b. Funções de borda');
if (!REAL) console.log('  (as funções de borda só existem no projeto: esta parte só roda com --real)');
else {
  const FN = URL_PROJETO + '/functions/v1';
  const chamar = (nomeFn, caminho = '', { metodo = 'GET', cabecalhos = {} } = {}) => api(null, '/' + nomeFn + caminho, { metodo, base: FN, cabecalhos: { ...cabecalhos } });
  for (const [quando, cab] of [['sem segredo', {}], ['com segredo errado', { 'x-cron-secret': 'errado-errado-errado-errado' }], ['com a chave pública como segredo', { Authorization: 'Bearer ' + ANON }],
                               ['com segredo vazio', { 'x-cron-secret': '' }], ['com o token de usuário', { Authorization: 'Bearer ' + tA }]]) {
    const r = await chamar('enviar-avisos', '', { metodo: 'POST', cabecalhos: cab });
    verificar(r.status === 401, 'enviar-avisos ' + quando + ' responde 401 (ninguém dispara e-mails de fora)', r);
  }
  const g = await chamar('enviar-avisos', '', { metodo: 'GET' });
  verificar(g.status === 405 || g.status === 401, 'enviar-avisos só aceita POST', g);
  for (const c of ["' or 1=1 --", '0000-0000', 'AAAA-BBBB-CCCC-DDDD', '%', 'a'.repeat(2000)]) {
    const r = await chamar('diario-publico', '?codigo=' + encodeURIComponent(c));
    verificar(r.status === 400 || r.status === 404, 'diario-publico recusa o código «' + c.slice(0, 20) + '» sem erro de servidor', { status: r.status, corpo: r.corpo });
  }
  for (const t of ["' or 1=1 --", 'abc', '0'.repeat(48), 'z'.repeat(48)]) {
    const r = await chamar('convite-publico', '?token=' + encodeURIComponent(t));
    verificar(r.status >= 400 && r.status < 500, 'convite-publico recusa o token «' + t.slice(0, 20) + '» sem erro de servidor', { status: r.status, corpo: r.corpo });
  }
}

/* ---------- 7. Configuração do Auth ---------- */
console.log('\n7. Configuração do Auth');
if (!REAL) console.log('  (só com --real)');
else {
  const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
  const REF = URL_PROJETO.match(/https:\/\/([^.]+)\./)[1];
  const r = await fetch('https://api.supabase.com/v1/projects/' + REF + '/config/auth', { headers: { Authorization: 'Bearer ' + TOKEN } });
  const c = r.ok ? await r.json() : null;
  verificar(!!c, 'lê a configuração do Auth do projeto', r.status);
  if (c) {
    verificar(c.mailer_autoconfirm === false, 'o cadastro exige confirmar o e-mail (mailer_autoconfirm desligado)', c.mailer_autoconfirm);
    verificar(c.external_anonymous_users_enabled === false, 'login anônimo desligado', c.external_anonymous_users_enabled);
    verificar(Number(c.password_min_length) >= 8, 'senha com pelo menos 8 caracteres', c.password_min_length);
    verificar(c.refresh_token_rotation_enabled !== false, 'rotação do token de renovação ligada', c.refresh_token_rotation_enabled);
    verificar(Number(c.jwt_exp) <= 3600, 'o token de acesso dura no máximo 1 hora', c.jwt_exp);
    verificar(c.security_manual_linking_enabled !== true, 'vínculo manual de identidades desligado', c.security_manual_linking_enabled);
    const permitidas = String(c.uri_allow_list || '');
    verificar(!/(^|,)\s*\*+\s*($|,)/.test(permitidas) && !/\*\*/.test(permitidas.replace(/https?:\/\/[^,]*\/\*\*/g, '')), 'a lista de endereços permitidos não tem curinga solto', permitidas);
    if (/localhost|127\.0\.0\.1/.test(permitidas + ' ' + (c.site_url || ''))) console.log('  AVISO  a lista de endereços ou o site_url ainda aponta para localhost: tire antes de abrir ao público (' + (c.site_url || '') + ')');
    if (c.mailer_secure_email_change_enabled === false) console.log('  AVISO  a troca de e-mail não exige confirmar nos dois endereços (mailer_secure_email_change_enabled desligado)');
  }
}

await limpar();
console.log('\n' + (passos - falhas) + '/' + passos + ' verificações passaram');
process.exit(falhas ? 1 : 0);
