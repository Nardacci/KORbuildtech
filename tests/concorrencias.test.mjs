/* KORbuild — teste do motor das concorrências (docs/concorrencias.md, fatia 1), em português.
 * Contratante e convidadas, o que cada uma vê (CO-04), revisões e prazo (CO-05, CO-10), comparar (CO-12),
 * fechar (CO-06, CO-13), cancelar (CO-15), convidar mais (CO-16) e a prestadora como contratante (CO-19).
 * Uso: suba um servidor na pasta do projeto (python3 -m http.server 8123) e rode
 *   node tests/concorrencias.test.mjs [http://localhost:8123/] */

import { chromium } from 'playwright';

const BASE = (process.argv[2] || 'http://localhost:8123/') + '?demo';
let falhas = 0, passos = 0;
function verificar(cond, texto) {
  passos++;
  if (cond) console.log('  ok  ' + texto);
  else { falhas++; console.log('FALHA ' + texto); }
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
await context.addInitScript(() => { try { if (!localStorage.getItem('kbt.idioma')) localStorage.setItem('kbt.idioma', 'pt'); } catch { /* sem armazenamento */ } });
await context.route('https://api.open-meteo.com/**', (r) => r.fulfill({ json: { hourly: { time: [], weather_code: [], precipitation: [], temperature_2m: [] } } }));
await context.route(/fonts\.|tile\.openstreetmap/, (r) => r.abort());
const page = await context.newPage();
await page.clock.setFixedTime(new Date('2026-10-07T10:00:00')); // quarta-feira
const erros = [];
page.on('pageerror', (e) => erros.push(e.message));

await page.goto(BASE);
await page.waitForSelector('#form-login', { timeout: 30000 });
await page.evaluate(() => localStorage.setItem('kbt.sessao', 'u-ana'));
await page.goto('about:blank');
await page.goto(BASE + '#/inicio');
await page.waitForTimeout(400);

/* Roda uma função no navegador com o motor carregado: (m, a, ajuda) => ... ; ajuda.como(empresa, fn). */
const rodar = (fn, arg) => page.evaluate(async ([codigo, x]) => {
  const m = await import('./js/concorrencias.js');
  const a = await import('./js/armazem.js');
  const ajuda = { como: (id, f) => a.emNomeDaEmpresa(id, f), GC: 'construtora-exemplo', NF: 'prestadora-exemplo', RD: 'prestadora-estrutura' };
  return (0, eval)('(' + codigo + ')')(m, a, ajuda, x);
}, [fn.toString(), arg]);

const AGORA = new Date('2026-10-07T10:00:00').getTime();
const FRAMING = '06 11 00 · Wood framing', DRYWALL = '09 29 00 · Gypsum board';

console.log('Dados de exemplo');
let r = await rodar((m, a, h) => {
  const env = m.enviadas(h.GC);
  const atl = env.find((c) => c.id === 'co-atlantico-framing');
  return { n: env.length, situacoes: env.map((c) => m.situacaoDe(c)), convites: atl.convites.map((v) => [v.nome, v.situacao, !!v.empresaId]) };
});
verificar(r.n === 2 && r.situacoes.join() === 'aberta,fechada', 'a construtora tem 2 concorrências: Atlântico aberta e Jardim fechada');
verificar(r.convites.length === 3 && r.convites[0][2] === true && r.convites[1][2] === false, 'Atlântico: Northfield com conta, Bayside e Pine Ridge pelo link');

console.log('O que cada convidada vê (CO-04)');
r = await rodar((m, a, h) => {
  const nf = h.como(h.NF, () => m.recebidas());
  const rd = h.como(h.RD, () => m.recebidas());
  const atl = nf.find((x) => x.id === 'co-atlantico-framing');
  return { n: nf.length, rd: rd.length, json: JSON.stringify(nf), orc: atl.orcamento, temConvites: 'convites' in atl, fech: 'fechamento' in atl, proprio: atl.convite.nome };
});
verificar(r.n === 2 && r.rd === 0, 'a Northfield recebe os 2 convites; a Ridgeline, nenhum');
verificar(!r.json.includes('Bayside') && !r.json.includes('Pine Ridge') && !r.temConvites, 'a Northfield não vê quem mais foi convidado');
verificar(r.orc.mostrar === 'nao' && !('valor' in r.orc), 'o orçamento da construtora não aparece (não mostrar é o padrão, CO-03)');
verificar(!r.fech && !r.json.includes('fechamento'), 'nem o registro do fechamento (valores) vai para a convidada');
r = await rodar((m) => { const v = m.porToken('lk-cv-atl-bayside'); return v && { nome: v.convite.nome, json: JSON.stringify(v) }; });
verificar(r && r.nome.includes('Bayside') && !r.json.includes('Northfield') && !r.json.includes('121900'), 'pelo link, a Bayside vê só o próprio convite (CO-07)');
verificar(await rodar((m) => m.porToken('lk-inexistente')) === null, 'link desconhecido não abre nada');

console.log('Comparar (CO-12)');
r = await rodar((m, a, h, x) => {
  const c = m.concorrenciaEnviada('co-atlantico-framing', h.GC);
  const cmp = m.comparar(c);
  const col = (n) => cmp.colunas.find((k) => k.nome.includes(n));
  return { cols: cmp.colunas.length, bay: col('Bayside'), nf: col('Northfield'), framing: cmp.linhas.find((l) => l.etapa === x.FRAMING), drywall: cmp.linhas.find((l) => l.etapa === x.DRYWALL) };
}, { FRAMING, DRYWALL });
verificar(r.cols === 2, 'duas propostas na comparação (Pine Ridge não vai participar)');
verificar(r.framing.valores['cv-atl-bayside'] === null && r.bay.naoCotadas.includes(FRAMING), 'etapa sem preço é "não cotada", nunca zero');
verificar(r.drywall.menor === 61500, 'menor valor da linha do drywall: US$ 61.500');
verificar(r.bay.exclusoesNoEscopo.length === 1 && r.nf.exclusoesNoEscopo.length === 0, 'exclusão que está no escopo incluso (andaimes) fica marcada; a que já era excluso, não');

console.log('Rascunho e envio (CO-08)');
r = await rodar((m, a, h, x) => h.como(h.GC, () => {
  const c = m.salvarRascunho(null, { servico: 'Drywall do galpão' }, 'Ana Ribeiro');
  const rasc = m.concorrenciaEnviada(c.id);
  const pend = m.pendenciasDeEnvio(rasc, x.AGORA);
  const antes = m.enviar(c.id, 'Ana Ribeiro', x.AGORA);
  const nf = m.recebidas(h.NF).some((y) => y.id === c.id);
  const ok = m.salvarRascunho(c.id, {
    obraId: 'galpao', servico: 'Drywall do galpão', etapas: [x.DRYWALL], incluso: 'Drywall do escritório\nForro', prazo: '2026-10-20T17:00',
    convidados: ['ct-northfield', 'ct-bayside', 'ct-northfield'], orcamento: { valor: 40000, mostrar: 'total' },
  }, 'Ana Ribeiro');
  const env = m.enviar(c.id, 'Ana Ribeiro', x.AGORA);
  const depois = m.salvarRascunho(c.id, { servico: 'outro' }, 'Ana Ribeiro');
  const s = m.concorrenciaEnviada(c.id);
  return { id: c.id, pend: pend.length, antes: antes.erro, nfAntes: nf, ok: ok.ok, env: env.ok, depois: depois.erro, n: s.convites.length, situacao: s.situacao, tokens: s.convites.every((v) => v.token), aud: a.estado().settings.auditoria[0].descricao };
}), { DRYWALL, AGORA });
const novaId = r.id;
verificar(r.pend >= 4 && r.antes, 'rascunho incompleto não é enviado e diz o que falta');
verificar(!r.nfAntes, 'rascunho não aparece para ninguém');
verificar(r.ok && r.env && r.situacao === 'aberta', 'completo, é enviado e fica aberto');
verificar(r.n === 2, 'a mesma prestadora não entra duas vezes (CO-16)');
verificar(r.depois, 'depois de enviada, não se reescreve (CO-09)');
verificar(r.tokens, 'cada convite tem o seu link pessoal');
verificar(r.aud.includes('Convites enviados'), 'o envio vai para a auditoria da construtora (CO-18)');

console.log('A convidada responde e manda proposta (CO-05, CO-10)');
r = await rodar((m, a, h, x) => h.como(h.NF, () => {
  const v1 = m.marcarVisto(x.id, null, x.AGORA);
  const vi = m.recebida(x.id).convite.situacao;
  const vai = m.responder(x.id, true, '', 'Tom Reilly', null, x.AGORA);
  const fora = m.enviarProposta(x.id, { porEtapa: { [x.FRAMING]: 1000 } }, 'Tom Reilly', null, x.AGORA);
  const soma = m.enviarProposta(x.id, { total: 50000, porEtapa: { [x.DRYWALL]: 38000 } }, 'Tom Reilly', null, x.AGORA);
  const p1 = m.enviarProposta(x.id, { porEtapa: { [x.DRYWALL]: 38000 }, prazoExecucaoDias: 20, exclusoes: 'Forro' }, 'Tom Reilly', null, x.AGORA);
  const p2 = m.enviarProposta(x.id, { total: 36500, porEtapa: { [x.DRYWALL]: 36500 }, prazoExecucaoDias: 20 }, 'Tom Reilly', null, x.AGORA + 3600000);
  const voltar = m.responder(x.id, false, 'mudei de ideia', 'Tom Reilly', null, x.AGORA);
  const vista = m.recebida(x.id);
  return { v1: v1.ok, vi, vai: vai.ok, fora: fora.erro, soma: soma.erro, p1: p1.rev, p2: p2.rev, voltar: voltar.erro, revs: vista.convite.propostas.map((p) => p.total), orc: vista.orcamento };
}), { id: novaId, FRAMING, DRYWALL, AGORA });
verificar(r.v1 && r.vi === 'visto', 'abrir o convite marca como visto');
verificar(r.vai, 'Vou cotar');
verificar(r.fora && r.soma, 'recusa etapa fora da concorrência e total que não bate com a soma');
verificar(r.p1 === 1 && r.p2 === 2 && r.revs.join() === '38000,36500', 'cada envio é uma nova revisão, e a anterior fica (rev. 1 e rev. 2)');
verificar(r.voltar, 'quem já mandou proposta não volta para "não vou participar"');
verificar(r.orc.mostrar === 'total' && r.orc.valor === 40000 && !r.orc.porEtapa, 'orçamento mostrado só como total, como a construtora escolheu (CO-03)');

r = await rodar((m, a, h, x) => {
  const tok = m.concorrenciaEnviada(x.id, h.GC).convites.find((v) => v.nome.includes('Bayside')).token;
  const quem = { token: tok };
  const resp = m.responder(x.id, true, '', 'Ellen Price', quem, x.AGORA);
  const p = m.enviarProposta(x.id, { total: 35900, prazoExecucaoDias: 25, pdf: { nome: 'bayside.pdf' } }, 'Ellen Price', quem, x.AGORA);
  const outro = m.enviarProposta(x.id, { total: 1 }, 'x', { token: 'lk-errado' }, x.AGORA);
  return { resp: resp.ok, p: p.rev, outro: outro.erro };
}, { id: novaId, AGORA });
verificar(r.resp && r.p === 1, 'pelo link, a Bayside responde e manda a proposta (PDF e total)');
verificar(r.outro, 'um link errado não envia nada');

console.log('Prazo e prorrogação (CO-09, CO-10)');
const DEPOIS = new Date('2026-10-21T09:00:00').getTime();
r = await rodar((m, a, h, x) => {
  const c = m.concorrenciaEnviada(x.id, h.GC);
  const s1 = m.situacaoDe(c, x.DEPOIS);
  const tarde = h.como(h.NF, () => m.enviarProposta(x.id, { total: 30000 }, 'Tom Reilly', null, x.DEPOIS));
  const cedo = h.como(h.GC, () => m.prorrogar(x.id, '2026-10-15T17:00', '', 'Ana Ribeiro', x.DEPOIS));
  const ok = h.como(h.GC, () => m.prorrogar(x.id, '2026-10-24T17:00', 'pedido das prestadoras', 'Ana Ribeiro', x.DEPOIS));
  const s2 = m.situacaoDe(c, x.DEPOIS);
  const p3 = h.como(h.NF, () => m.enviarProposta(x.id, { total: 34000 }, 'Tom Reilly', null, x.DEPOIS));
  return { s1, tarde: tarde.erro, cedo: cedo.erro, ok: ok.ok, s2, p3: p3.rev, hist: c.historico.map((y) => y.acao) };
}, { id: novaId, DEPOIS });
verificar(r.s1 === 'para-fechar' && r.tarde, 'com o prazo vencido, fica "para fechar" e não aceita proposta');
verificar(r.cedo && r.ok && r.s2 === 'aberta', 'prorrogar exige um prazo depois do atual; prorrogada, volta a ficar aberta');
verificar(r.p3 === 3, 'com o prazo novo, a Northfield manda a rev. 3');
verificar(r.hist.includes('Prazo prorrogado'), 'a prorrogação fica no histórico');

console.log('Fechar (CO-06, CO-13)');
r = await rodar((m, a, h, x) => h.como(h.GC, () => {
  const c = m.concorrenciaEnviada(x.id);
  const mais = m.convidarMais(x.id, ['ct-northfield'], 'Ana Ribeiro', x.DEPOIS);
  const pine = m.convidarMais(x.id, ['ct-pineridge'], 'Ana Ribeiro', x.DEPOIS);
  const pineId = c.convites.find((v) => v.nome.includes('Pine')).id;
  const semProposta = m.fechar(x.id, pineId, '', 'Ana Ribeiro', x.DEPOIS);
  const nfId = c.convites.find((v) => v.nome.includes('Northfield')).id;
  const ok = m.fechar(x.id, nfId, 'melhor prazo', 'Ana Ribeiro', x.DEPOIS);
  const denovo = m.fechar(x.id, nfId, '', 'Ana Ribeiro', x.DEPOIS);
  const cancelar = m.cancelar(x.id, 'teste', 'Ana Ribeiro', x.DEPOIS);
  const nf = m.recebida(x.id, h.NF);
  const bay = m.porToken(c.convites.find((v) => v.nome.includes('Bayside')).token);
  return {
    mais: mais.erro, pine: pine.ok, semProposta: semProposta.erro, ok: ok.ok, denovo: denovo.erro, cancelar: cancelar.erro,
    fech: c.fechamento, sit: c.convites.map((v) => [v.nome.split(' ')[0], v.situacao]), nf: [nf.situacao, nf.convite.situacao], bay: [bay.situacao, bay.convite.situacao, JSON.stringify(bay).includes('34000')],
  };
}), { id: novaId, DEPOIS });
verificar(r.mais && r.pine, 'convidar de novo quem já está é recusado; convidar mais uma é aceito');
verificar(r.semProposta, 'não fecha com quem não mandou proposta');
verificar(r.ok && r.fech.rev === 3 && r.fech.valor === 34000 && r.fech.por === 'Ana Ribeiro', 'fecha com a Northfield: registra revisão, valor e quem fechou');
verificar(r.sit.find((s) => s[0] === 'Bayside')[1] === 'nao-escolhida' && r.sit.find((s) => s[0] === 'Pine')[1] === 'enviado', 'a Bayside fica "não escolhida"; quem não mandou proposta fica como estava');
verificar(r.denovo && r.cancelar, 'fechada, não fecha de novo nem cancela');
verificar(r.nf.join() === 'fechada,vencedora', 'a Northfield vê que venceu');
verificar(r.bay[0] === 'fechada' && r.bay[1] === 'nao-escolhida' && !r.bay[2], 'a Bayside vê que não foi escolhida, sem o valor da vencedora');

console.log('Cancelar (CO-15)');
r = await rodar((m, a, h, x) => h.como(h.GC, () => {
  const c = m.salvarRascunho(null, { obraId: 'galpao', servico: 'Pintura', etapas: ['09 91 00 · Painting'], incluso: 'Pintura interna', prazo: '2026-10-20T17:00', convidados: ['ct-northfield'] }, 'Ana Ribeiro');
  m.enviar(c.id, 'Ana Ribeiro', x.AGORA);
  const sem = m.cancelar(c.id, '', 'Ana Ribeiro', x.AGORA);
  const ok = m.cancelar(c.id, 'a construtora vai pintar com outra obra', 'Ana Ribeiro', x.AGORA);
  const nf = m.recebida(c.id, h.NF);
  const resp = h.como(h.NF, () => m.responder(c.id, true, '', 'Tom Reilly', null, x.AGORA));
  const r2 = m.salvarRascunho(null, { servico: 'Rascunho para apagar' }, 'Ana Ribeiro');
  const apagado = m.cancelar(r2.id, 'desisti', 'Ana Ribeiro', x.AGORA);
  return { sem: sem.erro, ok: ok.ok, nf: [nf.situacao, nf.convite.situacao], resp: resp.erro, apagado: apagado.excluida && !m.concorrenciaEnviada(r2.id) };
}), { AGORA });
verificar(r.sem && r.ok, 'cancelar exige motivo');
verificar(r.nf.join() === 'cancelada,cancelado' && r.resp, 'a convidada vê o cancelamento e não responde mais');
verificar(r.apagado, 'um rascunho cancelado é só apagado');

console.log('Isolamento e quarteirização (CO-19)');
r = await rodar((m, a, h, x) => {
  const alheia = h.como(h.NF, () => m.concorrenciaEnviada('co-atlantico-framing'));
  const fechar = h.como(h.NF, () => m.fechar('co-atlantico-framing', 'cv-atl-northfield', '', 'Tom Reilly', x.AGORA));
  // a Northfield contrata uma prestadora para parte do serviço dela no Jardim
  return { alheia, fechar: fechar.erro };
}, { AGORA });
verificar(r.alheia === null && r.fechar, 'uma convidada não abre nem fecha a concorrência de outra empresa');
r = await rodar(async (m, a, h) => {
  const { salvarContato } = await import('./js/contatos.js');
  const ct = h.como(h.NF, () => salvarContato(null, { nome: 'Bay State Drywall', email: 'ops@baystate.exemplo.com', papeis: ['prestadora'] }, 'Tom Reilly'));
  return { ct: ct.ok };
});
verificar(r.ct, 'a Northfield cadastra a Bay State Drywall como prestadora nos Contatos');
r = await rodar(async (m, a, h, x) => {
  const { contatos } = await import('./js/contatos.js');
  return h.como(h.NF, () => {
    const bay = contatos().find((c) => c.nome === 'Bay State Drywall');
    const c = m.salvarRascunho(null, { obraId: 'nf-jardim', servico: 'Drywall das casas', etapas: [x.DRYWALL], incluso: 'Drywall nível 4', prazo: '2026-10-16T12:00', convidados: [bay.id], quarteirizacao: 'nao-permitida' }, 'Tom Reilly');
    const env = m.enviar(c.id, 'Tom Reilly', x.AGORA);
    const s = m.concorrenciaEnviada(c.id);
    return { env: env.ok, contratante: s.contratanteId, link: s.convites[0].empresaId === null, minhas: m.enviadas().length, daGc: m.enviadas(h.GC).some((y) => y.id === c.id), obraAlheia: m.salvarRascunho(null, { obraId: 'atlantico', servico: 'x' }, 'Tom Reilly').erro };
  });
}, { DRYWALL, AGORA });
verificar(r.env && r.contratante === 'prestadora-exemplo' && r.minhas === 1, 'a prestadora também abre concorrência (contratante = Northfield)');
verificar(r.link, 'a quarteirizada sem conta recebe pelo link');
verificar(!r.daGc, 'a construtora não vê a concorrência da Northfield');
verificar(r.obraAlheia, 'só dá para abrir concorrência de uma obra da própria empresa');

console.log('Permissões');
r = await rodar(async () => {
  const s = await import('./js/settings.js');
  const ger = s.permissao('concorrencias.gerir'), resp = s.permissao('concorrencias.responder');
  const gestor = s.PERFIS_INICIAIS.find((p) => p.id === 'gestor').permissoes, adm = s.PERFIS_INICIAIS.find((p) => p.id === 'administrador').permissoes;
  const enc = s.PERFIS_INICIAIS.find((p) => p.id === 'encarregado').permissoes;
  return { ok: !!ger && !!resp, requer: resp.requer, gestor: gestor.includes('concorrencias.gerir') && gestor.includes('concorrencias.responder'), adm: adm.includes('concorrencias.gerir') && adm.includes('concorrencias.responder'), enc: enc.some((p) => p.startsWith('concorrencias')) };
});
verificar(r.ok && r.requer.includes('measure.medir'), 'as duas permissões existem; responder inclui medir plantas');
verificar(r.adm && r.gestor && !r.enc, 'administrador e gestor de obras têm as duas; o encarregado, nenhuma');

console.log('Telas da contratante (fatia 2)');
const ir = async (usuario, hash) => {
  await page.evaluate((x) => localStorage.setItem('kbt.sessao', x), usuario);
  await page.goto('about:blank');
  await page.goto(BASE + hash);
  await page.waitForTimeout(400);
};
// dados limpos: refaz a demonstração
await page.evaluate(() => { localStorage.removeItem('kbt.rdo.v1'); localStorage.removeItem('kbt.sessao'); });
await page.goto('about:blank');
await page.goto(BASE);
await page.waitForSelector('#form-login', { timeout: 30000 });
await ir('u-ana', '#/daily/concorrencias');
verificar(await page.locator('nav a[href="#/daily/concorrencias"]').count() > 0, 'Concorrências no menu do Daily da construtora');
verificar(await page.locator('.tabela-concorrencias tbody tr').count() === 1 && (await page.locator('.tabela-concorrencias').innerText()).includes('Framing e drywall'), 'a lista abre nas abertas: Framing e drywall');
await page.locator('.abas-segmento a', { hasText: 'Fechadas' }).click();
await page.waitForTimeout(300);
verificar((await page.locator('.tabela-concorrencias').innerText()).includes('Northfield Framing & Siding'), 'em Fechadas, o siding do Jardim com a vencedora');
await ir('u-ana', '#/daily/concorrencias/co-atlantico-framing');
let txt = await page.locator('main').innerText();
verificar(txt.includes('Pine Ridge Builders') && txt.includes('Agenda cheia até dezembro') && (await page.locator('.tabela-convidados tbody tr').count()) === 3, 'Convidados: as três, com a resposta e o motivo da Pine Ridge');
await page.locator('.abas-segmento a', { hasText: 'Comparar' }).click();
await page.waitForTimeout(300);
verificar(await page.locator('.co-nao-cotada').count() === 1 && await page.locator('.co-menor').count() === 2, 'Comparar: uma etapa não cotada e o menor valor de cada etapa destacado');
verificar((await page.locator('.co-exclusoes .texto-alerta').innerText()).includes('Andaimes'), 'Comparar: a exclusão que está no escopo vem com alerta');
await page.locator('.abas-segmento a', { hasText: 'Detalhes' }).click();
await page.waitForTimeout(300);
txt = await page.locator('main').innerText();
verificar(txt.includes('Andaimes e equipamentos de acesso') && txt.includes('Convites enviados'), 'Detalhes: o escopo e o histórico');

await ir('u-ana', '#/daily/obras/atlantico');
verificar((await page.locator('main').innerText()).includes('Framing e drywall') && await page.locator('a[href="#/daily/concorrencias/nova/atlantico"]').count() === 1, 'a página da obra mostra as concorrências dela e "Nova concorrência"');
await page.locator('a[href="#/daily/concorrencias/nova/atlantico"]').click();
await page.waitForTimeout(400);
verificar(await page.locator('#co-obraId').inputValue() === 'atlantico', 'a nova concorrência já vem com a obra');
await page.fill('#co-servico', 'Pintura das áreas comuns');
await page.locator('[data-acao="co-salvar"][data-enviar]').click();
await page.waitForTimeout(400);
verificar(page.url().includes('#/daily/concorrencias/co-') && (await page.locator('.aviso').innerText()).includes('Rascunho'), 'sem o resto, "Enviar convites" salva o rascunho e diz o que falta');
await page.locator('a', { hasText: 'Editar' }).first().click();
await page.waitForTimeout(400);
await page.fill('#co-outrasEtapas', '09 91 00 · Painting');
await page.fill('#co-incluso', 'Pintura de paredes e tetos\nFundo preparador');
await page.fill('#co-prazoData', '2026-10-15');
await page.fill('#co-orcamento', '42000');
await page.locator('[name="convidados"][value="ct-northfield"]').check();
await page.locator('[name="convidados"][value="ct-pineridge"]').check();
await page.locator('[data-acao="co-salvar"][data-enviar]').click();
await page.waitForTimeout(400);
verificar((await page.locator('main h1, .cabeca h1, h1').first().innerText()).includes('Pintura') && (await page.locator('main').innerText()).includes('Aberta'), 'completo, é enviado: fica aberta');
verificar(await page.locator('.tabela-convidados tbody tr').count() === 2, 'com as duas convidadas');
const novaUrl = page.url();
await page.locator('[data-acao="co-convidar"]').click();
await page.locator('dialog [name="cv-ct-bayside"]').check();
await page.locator('dialog button', { hasText: 'Convidar' }).click();
await page.waitForTimeout(400);
verificar(await page.locator('.tabela-convidados tbody tr').count() === 3, 'Convidar mais: a Bayside entra');
await page.locator('[data-acao="co-prorrogar"]').click();
await page.fill('dialog #pr-data', '2026-10-19');
await page.fill('dialog #pr-motivo', 'visita remarcada');
await page.locator('dialog button', { hasText: 'Prorrogar' }).click();
await page.waitForTimeout(400);
verificar((await page.locator('body').innerText()).includes('19/10/2026 às 17:00'), 'Prorrogar: o novo prazo aparece no topo');
// a Northfield manda proposta (pelo motor; a tela dela é a fatia 3) e a construtora fecha pela tela
await rodar((m, a, h) => h.como(h.NF, () => m.enviarProposta(m.recebidas().find((x) => x.servico.startsWith('Pintura')).id, { porEtapa: { '09 91 00 · Painting': 39800 }, prazoExecucaoDias: 30 }, 'Tom Reilly', null)));
await page.goto(novaUrl + '/comparar');
await page.waitForTimeout(400);
await page.locator('[data-acao="co-fechar"]').first().click();
verificar((await page.locator('dialog').innerText()).includes('39.800,00'), 'Fechar: a confirmação mostra o valor da proposta');
await page.locator('dialog button', { hasText: 'Fechar negócio' }).click();
await page.waitForTimeout(400);
txt = await page.locator('main').innerText();
verificar(page.url() === novaUrl && txt.includes('Fechada com Northfield Framing & Siding') && await page.locator('[data-acao="co-prorrogar"]').count() === 0, 'fechada: o aviso com a vencedora, e não dá mais para prorrogar');

await ir('u-laura', '#/daily/concorrencias');
verificar(page.url().endsWith('#/daily/concorrencias') && await page.locator('.tabela-concorrencias').count() === 1, 'a gestora de obras (Laura) também abre as concorrências');
await ir('u-carlos', '#/daily/concorrencias');
verificar(!page.url().includes('concorrencias') && await page.locator('nav a[href="#/daily/concorrencias"]').count() === 0, 'o encarregado não vê nem abre as concorrências');

console.log('A convidada (fatia 3)');
// a construtora convida a Northfield para um serviço novo
const mezId = await rodar((m, a, h) => h.como(h.GC, () => {
  const c = m.salvarRascunho(null, { obraId: 'galpao', servico: 'Drywall do mezanino', etapas: ['09 29 00 · Gypsum board', '09 91 00 · Painting'], incluso: 'Drywall do mezanino\nPintura das paredes novas', excluso: 'Forro', prazo: '2026-10-20T17:00', convidados: ['ct-northfield', 'ct-bayside'], orcamento: { valor: 50000, mostrar: 'total' } }, 'Ana Ribeiro');
  m.enviar(c.id, 'Ana Ribeiro');
  return c.id;
}));
await ir('u-tom', '#/measure/convites');
verificar(await page.locator('nav a[href="#/measure/convites"]').count() > 0, 'Convites no menu do Measure da prestadora');
txt = await page.locator('.tabela-convites').innerText();
verificar(txt.includes('Drywall do mezanino') && txt.includes('Framing e drywall') && txt.includes('Construtora Exemplo'), 'a lista mostra os convites, com a contratante');
await page.locator('.tabela-convites a', { hasText: 'Drywall do mezanino' }).click();
await page.waitForTimeout(500);
txt = await page.locator('main').innerText();
verificar(txt.includes('Vai cotar?') && txt.includes('Galpão Logístico Rodovia') && txt.includes('50.000,00') && !txt.includes('Bayside'), 'o convite mostra o pacote, o orçamento que a construtora quis mostrar, e nada das outras convidadas');
verificar(await rodar((m, a, h, x) => !!m.concorrenciaEnviada(x, h.GC).convites.find((v) => v.nome.includes('Northfield')).vistoEm, mezId), 'abrir o convite avisa a construtora que foi visto');
await page.locator('[data-acao="cv-vou"]').click();
await page.waitForTimeout(600);
txt = await page.locator('main').innerText();
verificar(page.url().includes('#/measure/projeto/') && txt.includes('Concorrência de Construtora Exemplo') && txt.includes('Drywall do mezanino · Galpão Logístico Rodovia'), '"Vou cotar" cria o projeto no Measure, com a faixa da concorrência');
const pjId = page.url().split('/projeto/')[1];
r = await rodar((m, a, h, x) => {
  const v = m.concorrenciaEnviada(x.mez, h.GC).convites.find((y) => y.nome.includes('Northfield'));
  const pj = h.como(h.NF, () => a.estado().measure.projetos.find((p) => p.id === x.pj));
  return { sit: v.situacao, pj: v.projetoId === x.pj, ct: pj.contratanteId, prazo: pj.prazoProposta, cid: pj.concorrencia.id === x.mez };
}, { mez: mezId, pj: pjId });
verificar(r.sit === 'vai-cotar' && r.pj && r.cid, 'o convite fica "vai cotar", ligado ao projeto');
verificar(r.ct === 'ct-construtora' && r.prazo === '2026-10-20', 'o projeto já vem com a contratante (dos Contatos) e o prazo da proposta');
// a proposta emitida no Measure (as linhas viriam da medição; aqui, uma emissão pronta)
await rodar((m, a, h, x) => h.como(h.NF, () => {
  const p = a.estado().measure.projetos.find((y) => y.id === x);
  p.propostas = [{ numero: 'P-2026-090', emitidaEm: new Date().toISOString(), por: 'Tom Reilly', total: 31500, dados: { linhas: [{ titulo: 'Gypsum board', codigo: '09 29 00', valor: 30000, materiais: [] }], extras: [{ descricao: 'Mobilização', valor: 1500 }] } }];
  a.salvar();
}), pjId);
await ir('u-tom', '#/measure/projeto/' + pjId + '/proposta');
await page.locator('[data-acao="cv-plataforma"]').click();
txt = await page.locator('dialog').innerText();
verificar(txt.includes('30.000,00') && txt.includes('1.500,00') && txt.includes('não cotada'), 'Enviar pela plataforma: drywall por etapa, mobilização em outros itens, pintura não cotada');
await page.fill('dialog #cv-prazo', '20');
await page.locator('dialog button', { hasText: 'Enviar' }).click();
await page.waitForTimeout(500);
verificar(await page.locator('.prop-versoes .etiqueta', { hasText: 'Enviada pela plataforma' }).count() === 1, 'a proposta emitida fica marcada como enviada');
r = await rodar((m, a, h, x) => {
  const c = m.concorrenciaEnviada(x, h.GC);
  const col = m.comparar(c).colunas.find((k) => k.nome.includes('Northfield'));
  return { total: col.total, outros: col.outros, nao: col.naoCotadas.length, numero: col.numero, prazo: col.prazoExecucaoDias, excl: col.exclusoes };
}, mezId);
verificar(r.total === 31500 && r.outros === 1500 && r.nao === 1 && r.numero === 'P-2026-090' && r.prazo === 20 && r.excl.includes('Forro'), 'a construtora recebe a rev. 1: total, outros itens, etapa não cotada, número e prazo');

await ir('u-ana', '#/daily/concorrencias/' + mezId + '/comparar');
verificar((await page.locator('.tabela-comparar').innerText()).includes('Outros itens (fora das etapas)'), 'Comparar mostra a linha de outros itens');
await page.locator('[data-acao="co-fechar"]').first().click();
await page.locator('dialog button', { hasText: 'Fechar negócio' }).click();
await page.waitForTimeout(400);
r = await rodar((m, a, h, x) => h.como(h.NF, () => { const p = a.estado().measure.projetos.find((y) => y.id === x); return { sit: p.situacao, vinc: p.concorrencia.vinculo }; }), pjId);
verificar(r.sit === 'ganha' && r.vinc.empresaId === 'construtora-exemplo' && r.vinc.obraId === 'galpao', 'fechada: o projeto da Northfield vira Ganha, com a ligação à obra da construtora');

await ir('u-tom', '#/measure/convite/' + mezId);
txt = await page.locator('main').innerText();
verificar(txt.includes('Você venceu esta concorrência.') && await page.locator('a[href="#/settings/obra/nova/' + pjId + '"]').count() === 1, 'a Northfield vê que venceu, com "Criar obra a partir deste projeto"');
await page.locator('a[href="#/settings/obra/nova/' + pjId + '"]').click();
await page.waitForTimeout(800);
await page.fill('#ob-lat', '43.0016');
await page.fill('#ob-lon', '-71.4521');
await page.fill('#ob-inicio', '2026-11-02');
await page.fill('#ob-prazo', '2026-12-18');
await page.selectOption('#ob-responsavelId', { index: 1 });
for (const d of ['1', '2', '3', '4', '5']) await page.locator('[name="diasTrabalho"][value="' + d + '"]').check();
await page.locator('[data-acao="obra-salvar"]').click();
await page.waitForTimeout(600);
r = await rodar((m, a, h, x) => h.como(h.NF, () => { const o = a.estado().obras.find((y) => y.projetoId === x); return o && { vinc: o.vinculo, cid: o.concorrenciaId }; }), pjId);
verificar(r && r.vinc && r.vinc.empresaId === 'construtora-exemplo' && r.vinc.obraId === 'galpao' && r.cid === mezId, 'a obra da Northfield nasce ligada ao Galpão da construtora (CO-14)');
await ir('u-ana', '#/daily/obras/galpao');
verificar((await page.locator('main').innerText()).includes('Northfield Framing & Siding'), 'e a Northfield passa a aparecer na obra da construtora');

// recusar outro convite, com motivo
const outroId = await rodar((m, a, h) => h.como(h.GC, () => {
  const c = m.salvarRascunho(null, { obraId: 'atlantico', servico: 'Siding da fachada', etapas: ['07 46 33 · Plastic siding'], incluso: 'Siding', prazo: '2026-10-22T17:00', convidados: ['ct-northfield'] }, 'Ana Ribeiro');
  m.enviar(c.id, 'Ana Ribeiro');
  return c.id;
}));
await ir('u-tom', '#/measure/convite/' + outroId);
await page.locator('[data-acao="cv-nao"]').click();
await page.fill('dialog #cv-motivo', 'equipe toda no Jardim');
await page.locator('dialog button', { hasText: 'Não vou participar' }).click();
await page.waitForTimeout(400);
verificar((await page.locator('main').innerText()).includes('equipe toda no Jardim'), '"Não vou participar" com motivo');
await ir('u-ana', '#/daily/concorrencias/' + outroId);
verificar((await page.locator('.tabela-convidados').innerText()).includes('equipe toda no Jardim'), 'a construtora vê a recusa e o motivo');
await ir('u-rita', '#/measure/convites');
verificar(page.url().endsWith('#/measure/convites'), 'a estimadora (gestora de obras) também vê os convites');

console.log('Canal e sininho (fatia 4)');
await page.evaluate(() => { localStorage.removeItem('kbt.rdo.v1'); localStorage.removeItem('kbt.sessao'); });
await page.goto('about:blank');
await page.goto(BASE);
await page.waitForSelector('#form-login', { timeout: 30000 });
r = await rodar((m, a, h) => {
  const nf = m.canalRecebido('co-atlantico-framing', h.NF);
  const pine = h.como(h.GC, () => m.canalDaContratante(m.concorrenciaEnviada('co-atlantico-framing'), 'cv-atl-pineridge'));
  const bay = m.porToken('lk-cv-atl-bayside');
  return { nf: nf.map((x) => [x.autor, x.texto.slice(0, 12), x.minha]), pine: pine.length };
});
verificar(r.nf.length === 4 && r.nf.some((x) => x[0] === 'Pergunta de um convidado') && !JSON.stringify(r.nf).includes('Bayside'), 'a Northfield vê a pergunta respondida para todos sem saber de quem é, e a própria conversa');
verificar(r.pine === 0, 'a resposta só para a Northfield não aparece na conversa da Pine Ridge');
r = await rodar((m, a, h) => {
  const vazio = h.como(h.NF, () => m.escreverComoConvidada('co-atlantico-framing', '  ', 'Tom Reilly'));
  const p1 = h.como(h.NF, () => m.escreverComoConvidada('co-atlantico-framing', 'O drywall do 2º pavimento é resistente à umidade?', 'Tom Reilly'));
  const c = m.concorrenciaEnviada('co-atlantico-framing', h.GC);
  const pend = m.perguntasSemResposta(c).map((x) => x.id);
  const resp = h.como(h.GC, () => m.escreverComoContratante('co-atlantico-framing', { respostaDe: p1.id, paraTodos: true, texto: 'Sim, nos banheiros e na copa.' }, 'Ana Ribeiro'));
  const aviso = h.como(h.GC, () => m.escreverComoContratante('co-atlantico-framing', { texto: 'Adendo nº 1: a folha A-102 foi revisada.' }, 'Ana Ribeiro'));
  const bay = m.porToken('lk-cv-atl-bayside');
  const canalBay = (() => { const cc = m.concorrenciaEnviada('co-atlantico-framing', h.GC); return m.canalDaConvidada(cc, 'cv-atl-bayside'); })();
  return { vazio: vazio.erro, pend: pend.includes(p1.id), resp: resp.ok, aviso: aviso.ok, depois: m.perguntasSemResposta(c).some((x) => x.id === p1.id), bay: canalBay.map((x) => x.autor + '|' + x.texto), hist: c.historico.some((x) => x.acao === 'Aviso a todos') };
});
verificar(r.vazio && r.pend, 'mensagem vazia é recusada; a pergunta nova fica "sem resposta" para a construtora');
verificar(r.resp && !r.depois && r.bay.some((x) => x.startsWith('Pergunta de um convidado|O drywall')) && r.bay.some((x) => x.includes('Sim, nos banheiros')), 'respondida para todos, a Bayside vê a pergunta (sem o autor) e a resposta');
verificar(r.aviso && r.hist && r.bay.some((x) => x.includes('Adendo nº 1')), 'o aviso a todos chega a todas e fica no histórico');
r = await rodar((m, a, h) => {
  const perdedora = h.como(h.GC, () => m.escreverComoContratante('co-jardim-siding', { conviteId: 'cv-jar-pineridge', texto: 'oi' }, 'Ana Ribeiro'));
  const avisoFechada = h.como(h.GC, () => m.escreverComoContratante('co-jardim-siding', { texto: 'a todos' }, 'Ana Ribeiro'));
  const obra = h.como(h.GC, () => m.escreverComoContratante('co-jardim-siding', { conviteId: 'cv-jar-northfield', texto: 'Caçamba chega quinta.' }, 'Ana Ribeiro'));
  const nf = h.como(h.NF, () => m.escreverComoConvidada('co-jardim-siding', 'Combinado.', 'Tom Reilly'));
  return { perdedora: perdedora.erro, avisoFechada: avisoFechada.erro, obra: obra.ok, nf: nf.ok };
});
verificar(r.perdedora && r.avisoFechada, 'depois do fechamento, não se conversa com quem perdeu nem se avisa a todos');
verificar(r.obra && r.nf, 'com a vencedora, o canal continua (conversa da obra)');

await ir('u-ana', '#/daily/concorrencias/co-atlantico-framing/perguntas');
txt = await page.locator('main').innerText();
verificar(txt.includes('Podemos começar pelo 6º pavimento') && txt.includes('Os andaimes ficam por conta de quem?') && await page.locator('[data-acao="co-aviso"]').count() === 1, 'Perguntas: uma conversa por convidada e o aviso a todos');
await ir('u-tom', '#/measure/convite/co-atlantico-framing');
await page.locator('.co-escrever textarea').fill('Qual o pé-direito do 6º pavimento?');
await page.locator('[data-acao="cv-escrever"]').click();
await page.waitForTimeout(400);
verificar((await page.locator('.co-mensagens').innerText()).includes('Qual o pé-direito'), 'a prestadora pergunta pela tela do convite');
await ir('u-ana', '#/daily/concorrencias/co-atlantico-framing/perguntas');
verificar((await page.locator('.abas-segmento .co-pendente').innerText()).trim() === '1', 'a aba Perguntas mostra 1 sem resposta');
await page.locator('[data-acao="co-responder"]').first().click();
await page.fill('dialog #rs-texto', '2,70 m em todos os pavimentos.');
await page.locator('dialog [name="para"][value="um"]').check();
await page.locator('dialog button', { hasText: 'Responder' }).click();
await page.waitForTimeout(400);
r = await rodar((m) => m.porToken('lk-cv-atl-bayside'));
verificar(await page.locator('.abas-segmento .co-pendente').count() === 0, 'respondida, sai das pendentes');
verificar(await rodar((m, a, h) => !m.canalDaConvidada(m.concorrenciaEnviada('co-atlantico-framing', h.GC), 'cv-atl-bayside').some((x) => x.texto.includes('2,70'))), 'a resposta só para quem perguntou não chega à Bayside');
await ir('u-ana', '#/daily/obras/jardim');
txt = await page.locator('main').innerText();
verificar(txt.includes('Canal com Northfield Framing & Siding') && txt.includes('Combinado.'), 'na obra da construtora, o canal com a contratada');
await ir('u-tom', '#/daily/obras/nf-jardim');
await page.locator('.co-escrever textarea').fill('Entramos segunda às 7h.');
await page.locator('[data-acao="cv-escrever"]').click();
await page.waitForTimeout(400);
verificar((await page.locator('main').innerText()).includes('Canal com Construtora Exemplo') && (await page.locator('.co-mensagens').innerText()).includes('Entramos segunda'), 'na obra da prestadora, o mesmo canal, para escrever');
r = await rodar(async (m, a, h) => {
  const gc = h.como(h.GC, () => m.avisosDaContratante()).map((n) => n.titulo);
  const nf = h.como(h.NF, () => m.avisosDaConvidada()).map((n) => n.titulo);
  return { gc, nf };
});
verificar(r.gc.some((t) => t.startsWith('Proposta de Northfield')) && r.gc.some((t) => t.includes('não vai participar')) && r.gc.some((t) => t.startsWith('Mensagem de')), 'sininho da construtora: propostas, recusas e mensagens');
verificar(r.nf.some((t) => t.startsWith('Convite para cotar')) && r.nf.some((t) => t.startsWith('Você venceu')) && r.nf.some((t) => t.startsWith('Aviso a todos')), 'sininho da prestadora: convite, resultado e avisos');
await ir('u-tom', '#/measure/convites');
await page.locator('details.sino summary').click();
await page.waitForTimeout(300);
verificar((await page.locator('.painel-notificacoes').innerText()).includes('Convite para cotar'), 'e aparece no sininho da tela');

verificar(erros.length === 0, 'sem erros na página' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
await browser.close();
console.log('\n' + (passos - falhas) + '/' + passos + ' verificações passaram');
process.exit(falhas ? 1 : 0);
