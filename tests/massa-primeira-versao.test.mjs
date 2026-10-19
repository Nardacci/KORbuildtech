/* KORbuild — a simulação da 1ª versão em cima da massa (tools/massa-primeira-versao.mjs), no banco local: cada papel, cada par de empresas, cada estado.
 * Confere, pelas MESMAS regras de acesso do app (REST como a pessoa), o que cada login pode e não pode fazer. Não muda o esquema; só grava dados de teste.
 * Uso: bash tools/supabase-local.sh && node tests/massa-primeira-versao.test.mjs */

import { execFileSync } from 'node:child_process';
import { emailDe } from '../tools/massa-pv/dados.mjs';
const L = await import('./_supabase-local.mjs');
const { sql, rest } = L;

execFileSync('node', ['tools/massa-primeira-versao.mjs'], { encoding: 'utf8', cwd: new URL('..', import.meta.url).pathname, stdio: 'pipe' });
let ok = 0, falhas = 0;
const confere = (nome, cond, detalhe = '') => { if (cond) ok++; else { falhas++; console.log('  FALHOU: ' + nome + (detalhe ? ' · ' + detalhe : '')); } };
const id = async (chave, papel) => (await sql(`select id from auth.users where email = '${emailDe(chave, papel)}'`))[0].id;
const tenta = async (uid, caminho, metodo = 'GET', corpo) => { try { return { ok: true, dados: await rest(uid, caminho, { metodo, corpo }) }; } catch (e) { return { ok: false, erro: String(e.message) }; } };
const nega = (r) => !r.ok || (Array.isArray(r.dados) && r.dados.length === 0);
const serv = async (uid, nome) => (await tenta(uid, '/concorrencias?select=id,servico,situacao&servico=eq.' + encodeURIComponent(nome))).dados || [];
const convitesDe = async (uid, nome) => { const [c] = await serv(uid, nome); return c ? (await tenta(uid, '/concorrencia_convites?select=situacao,nome&concorrencia_id=eq.' + c.id)).dados || [] : null; };

// ---- a estrutura
const contagem = (await sql(`select (select count(*) from public.empresas where plano ->> 'massa' = 'pv')::int e, (select count(*) from public.membros m join public.empresas e on e.id = m.empresa_id where e.plano ->> 'massa' = 'pv')::int m`))[0];
confere('10 empresas e 50 logins', contagem.e === 10 && contagem.m === 50, JSON.stringify(contagem));
const tipos = await sql(`select atuacao, count(*)::int n from public.empresas where plano ->> 'massa' = 'pv' group by 1 order by 1`);
confere('2 construtoras, 2 ambas, 6 prestadoras', JSON.stringify(tipos) === JSON.stringify([{ atuacao: 'ambas', n: 2 }, { atuacao: 'construtora', n: 2 }, { atuacao: 'prestadora', n: 6 }]), JSON.stringify(tipos));
const sem = await sql(`select u.email from auth.users u where u.email like 'pv.%@example.com' and not exists (select 1 from public.membros m where m.user_id = u.id)`);
confere('todo login pv tem empresa', sem.length === 0, JSON.stringify(sem));

// ---- convites para cotar: cada par chegou a quem devia
const c1 = await id('c1', 'admin'), c2 = await id('c2', 'admin'), a1 = await id('a1', 'admin'), a2 = await id('a2', 'admin');
const p1 = await id('p1', 'admin'), p2 = await id('p2', 'admin'), p3 = await id('p3', 'admin'), p4 = await id('p4', 'admin'), p5 = await id('p5', 'admin'), p6 = await id('p6', 'admin');
/* quem pediu lê as tabelas; quem foi convidada só lê pela função concorrencias_recebidas (nunca as tabelas) */
const recebidas = async (uid) => (await tenta(uid, '/rpc/concorrencias_recebidas', 'POST', {})).dados || [];
const veA = async (uid, servico) => (await recebidas(uid)).some((x) => JSON.stringify(x).includes('"' + servico + '"')) || (await serv(uid, servico)).length === 1;
confere('c→p: a prestadora convidada vê o convite', await veA(p1, 'Exterior windows and doors') && await veA(p2, 'Exterior windows and doors'));
confere('c→p: quem NÃO foi convidada não vê', !(await veA(p3, 'Exterior windows and doors')) && !(await veA(p6, 'Exterior windows and doors')));
confere('c→c: a outra construtora recebe o convite', await veA(c2, 'Structural steel package'));
confere('c→a: a "ambas" recebe o convite', await veA(a1, 'Site concrete and curbs'));
confere('p→p: prestadora convida prestadora', await veA(p5, 'Metal stud framing — levels 2 and 3') && await veA(p6, 'Metal stud framing — levels 2 and 3'));
confere('p→a: prestadora convida "ambas"', await veA(a2, 'Temporary protection and scaffolding'));
confere('a→p: "ambas" convida prestadora', await veA(p4, 'Gutters and downspouts'));
confere('a→c: "ambas" convida construtora', await veA(c1, 'Mechanical, electrical and plumbing package'));
confere('rascunho NÃO chega às convidadas', !(await veA(p5, 'Final cleaning')) && !(await veA(p6, 'Final cleaning')));
confere('o rascunho aparece para quem o criou', (await serv(c1, 'Final cleaning')).length === 1);

// ---- estados e propostas, do ponto de vista de quem pediu
const cv = await convitesDe(c1, 'Exterior windows and doors');
confere('janelas: 3 convidadas (2 com conta + 1 só com o link)', cv && cv.length === 3, JSON.stringify(cv));
confere('janelas: 2 propostas recebidas', cv && cv.filter((x) => x.situacao === 'proposta').length === 2);
const vit = await convitesDe(c2, 'Interior drywall and finishing');
confere('drywall: 1 vencedora e 1 não escolhida', vit && vit.filter((x) => x.situacao === 'vencedora').length === 1 && vit.filter((x) => x.situacao === 'nao-escolhida').length === 1, JSON.stringify(vit));
const concreto = await convitesDe(c2, 'Site concrete and curbs');
confere('concreto: uma recusou e uma enviou proposta', concreto && concreto.some((x) => x.situacao === 'nao-vai') && concreto.some((x) => x.situacao === 'proposta'), JSON.stringify(concreto));
const [canc] = await serv(c2, 'Landscaping');
confere('landscaping: cancelada', canc && canc.situacao === 'cancelada');
const [glazing] = await serv(a2, 'Storefront glazing');
confere('glazing: aberta com 3 propostas para comparar', glazing && ((await convitesDe(a2, 'Storefront glazing')) || []).filter((x) => x.situacao === 'proposta').length === 3);
// vencedora vs. perdedora
confere('a vencedora e a perdedora veem o resultado do fechamento', await veA(p6, 'Interior drywall and finishing') && await veA(p2, 'Interior drywall and finishing'));
confere('a vencedora já pode criar a obra a partir do convite (função do banco existe)', (await sql(`select count(*)::int n from pg_proc where proname = 'criar_obra_da_concorrencia'`))[0].n === 1);

// ---- perguntas e respostas
const msgs = await sql(`select count(*)::int n from public.concorrencia_mensagens m join public.concorrencias c on c.id = m.concorrencia_id where c.servico = 'Exterior windows and doors'`);
confere('janelas: pergunta e resposta registradas', msgs[0].n >= 2, JSON.stringify(msgs));

// ---- isolamento entre empresas
const obrasDe = async (uid) => (await tenta(uid, '/obras?select=nome')).dados || [];
const o1 = await obrasDe(c1), o2 = await obrasDe(c2);
confere('cada empresa só vê as próprias obras', o1.length === 2 && o2.length === 2 && !o1.some((x) => o2.some((y) => y.nome === x.nome)), JSON.stringify([o1.length, o2.length]));
const contatosP3 = (await tenta(p3, '/contatos?select=nome')).dados || [];
confere('os contatos de uma empresa não vazam para outra', !contatosP3.some((x) => /Larkin|Church/.test(x.nome)));

// ---- papéis (permissões do Settings), com o MESMO banco do app
const empresaDe = async (uid) => (await sql(`select empresa_id from public.membros where user_id = '${uid}'`))[0].empresa_id;
const gestor = await id('c1', 'gestor'), orc = await id('p1', 'orcamentista'), soContatos = await id('p1', 'contatos'), trab = await id('p1', 'trabalhador'), gestorP = await id('p1', 'gestor');
const ncPorPapel = async (uid) => (await tenta(uid, '/concorrencias?select=id')).dados;
confere('administrador vê as concorrências da empresa', (await ncPorPapel(c1)).length >= 3);
confere('gestor (concorrencias.gerir) vê as concorrências', (await ncPorPapel(gestor)).length >= 3);
confere('trabalhador não vê concorrências', nega(await tenta(trab, '/concorrencias?select=id')));
confere('só-contatos não vê concorrências', nega(await tenta(soContatos, '/concorrencias?select=id')));
confere('só-contatos cria contato', (await tenta(soContatos, '/contatos', 'POST', { nome: 'Teste Contato PV ' + Date.now(), papeis: ['cliente'] })).ok);
confere('trabalhador NÃO cria contato', !(await tenta(trab, '/contatos', 'POST', { nome: 'Contato do Trabalhador', papeis: ['cliente'] })).ok);
confere('só-contatos NÃO cria item no catálogo', !(await tenta(soContatos, '/itens', 'POST', { empresa_id: await empresaDe(soContatos), nome: 'x', codigo: 'X-1', unidade: 'each' })).ok);
confere('orçamentista cria item no catálogo', (await tenta(orc, '/itens', 'POST', { empresa_id: await empresaDe(orc), nome: 'Item do orçamentista', codigo: 'ORC-' + Date.now() % 100000, unidade: 'each', categoria: 'material', etapa: 'Teste' })).ok);
confere('gestor NÃO cria item no catálogo (sem measure.catalogo)', !(await tenta(gestorP, '/itens', 'POST', { empresa_id: await empresaDe(gestorP), nome: 'Item do gestor', codigo: 'GST-' + Date.now() % 100000, unidade: 'each', categoria: 'material', etapa: 'Teste' })).ok);
confere('trabalhador não vê o catálogo', nega(await tenta(trab, '/itens?select=id')));
confere('orçamentista NÃO envia concorrência (sem concorrencias.gerir)', !(await tenta(orc, '/rpc/enviar_concorrencia', 'POST', { p_id: '00000000-0000-0000-0000-000000000000' })).ok);

// ---- a construtora no Measure (migração 0015): usa o da própria empresa
const itemConstrutora = await tenta(c1, '/itens', 'POST', { empresa_id: await empresaDe(c1), nome: 'Item da construtora', codigo: 'GC-' + Date.now() % 100000, unidade: 'each', categoria: 'material', etapa: 'Teste' });
confere('construtora grava item no Measure', itemConstrutora.ok, itemConstrutora.erro);
confere('construtora não lê itens de outra empresa', ((await tenta(c1, '/itens?select=empresa_id')).dados || []).every((x) => x.empresa_id === itemConstrutora.dados[0].empresa_id));
const itemAmbas = await tenta(a1, '/itens?select=id');
confere('a "ambas" usa o Measure normalmente', itemAmbas.ok, JSON.stringify(itemAmbas).slice(0, 120));

console.log('massa-primeira-versao: ' + ok + '/' + (ok + falhas) + ' verificações passaram');
process.exit(falhas ? 1 : 0);
