/* KORbuild — a massa de testes da 1ª versão (Measure Takeoff, Concorrências e Settings; docs/massa-primeira-versao.md).
 * Cria, numa conta de verdade, 10 empresas (2 construtoras, 2 "ambas", 6 prestadoras) com 5 logins cada (administrador, gestor, orçamentista,
 * só-contatos, trabalhador), contatos, 2 obras por empresa e convites para cotar em TODOS os pares (construtora/prestadora/ambas → qualquer uma,
 * mais convidados sem conta, só com o link) em vários estados: rascunho, aberta com propostas e perguntas, recusa, prorrogada, fechada com vencedora e cancelada.
 * Usa as MESMAS funções do banco que o app (criar_empresa, enviar_concorrencia, responder_convite, enviar_proposta_concorrencia…), cada uma como a pessoa
 * dona do papel; só o que o app não faz (membros, perfis só da massa, ligação entre obras, marca) sai por SQL de administrador.
 * NÃO muda o esquema do banco: só grava dados. Nunca apaga nada. Pode rodar de novo: o que já existe é pulado.
 * Nenhum e-mail sai: os usuários são example.com (reservado) e os avisos por e-mail ficam desligados antes de qualquer evento.
 * O Measure (catálogo, projetos, medição, propostas) é montado depois, pelas telas: node tools/massa-measure.mjs --conjunto=pv.
 *
 * Uso:
 *   node tools/massa-primeira-versao.mjs                       (banco local; tools/supabase-local.sh)
 *   KOR_DEMO_SENHA='…' node tools/massa-primeira-versao.mjs --real   (Supabase do projeto; SUPABASE_ACCESS_TOKEN no ambiente)
 *   --fase=estrutura,concorrencias   (padrão: as duas)
 *   --limpar   (só MOSTRA o SQL da limpeza das empresas plano.massa = 'pv'; para apagar de verdade: --limpar --apagar, que pede a frase de aprovação) */

import { EMPRESAS, EXTERNAS, CONCORRENCIAS, PAPEIS, PERFIS_EXTRA, emailDe, SENHA_VARIAVEL } from './massa-pv/dados.mjs';

const REAL = process.argv.includes('--real');
const FASES = ((process.argv.find((a) => a.startsWith('--fase=')) || '').slice(7) || 'estrutura,concorrencias').split(',');
const { sql, sqlExec, rest, garantirUsuario } = await import(REAL ? '../tests/_supabase-real.mjs' : '../tests/_supabase-local.mjs');
const SENHA = process.env[SENHA_VARIAVEL] || (REAL ? '' : 'Kb1!local-massa-pv');
if (REAL && SENHA.length < 12) { console.error('Defina ' + SENHA_VARIAVEL + ' (pelo menos 12 caracteres) na variável de ambiente; ela nunca vai para o repositório.'); process.exit(2); }
console.log('Massa da 1ª versão contra: ' + (REAL ? 'Supabase do projeto' : 'Supabase local'));

const rpc = (uid, nome, args) => rest(uid, '/rpc/' + nome, { metodo: 'POST', corpo: args || {} });
const aspas = (t) => String(t).replace(/'/g, "''");
const somar = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
function semente(texto) { let h = 2166136261; for (const c of texto) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

// ---------------------------------------------------------------- a limpeza (só mostra, a menos que peçam e confirmem)
const SQL_LIMPAR = `-- só as empresas desta massa (plano.massa = 'pv'); os dados delas saem em cascata
delete from public.empresas where plano ->> 'massa' = 'pv';
-- os arquivos dos buckets (plantas, concorrencias) e os usuários pv.*@example.com saem pela API de administração, não por SQL`;
if (process.argv.includes('--limpar')) {
  const alvo = await sql(`select e.nome from public.empresas e where e.plano ->> 'massa' = 'pv' order by e.nome`);
  console.log('\nEmpresas que a limpeza apagaria (' + alvo.length + '):\n  ' + alvo.map((x) => x.nome).join('\n  '));
  console.log('\nSQL:\n' + SQL_LIMPAR);
  const usuarios = await sql(`select count(*)::int n from auth.users where email like 'pv.%@example.com'`);
  console.log('\nUsuários pv.*@example.com: ' + usuarios[0].n);
  if (!process.argv.includes('--apagar')) { console.log('\nNada foi apagado. Para apagar: --limpar --apagar (e digitar a frase de aprovação).'); process.exit(0); }
  if (process.env.KOR_APROVACAO !== 'pode apagar a massa pv') { console.error('\nAprovação ausente: o usuário precisa digitar, no terminal dele, KOR_APROVACAO="pode apagar a massa pv". Nada foi apagado.'); process.exit(3); }
  const { limparMassa } = await import(REAL ? '../tests/_supabase-real.mjs' : '../tests/_supabase-local.mjs');
  if (typeof limparMassa !== 'function') { console.error('Este adaptador não tem limparMassa.'); process.exit(4); }
  await limparMassa('pv.%@example.com', "plano ->> 'massa' = 'pv'");
  console.log('Massa pv apagada.');
  process.exit(0);
}

// ---------------------------------------------------------------- a estrutura
const E = {};   // chave → { id, pessoas: { papel: { id, email, nome, membro } }, obras: {nome → id}, contatos: {nome → id} }

async function estrutura() {
  console.log('\nEstrutura: usuários, empresas, perfis, contatos e obras');
  for (const c of EMPRESAS) {
    const e = E[c.chave] = { ...c, pessoas: {}, contatos: {}, obrasPorNome: {} };
    for (const [papel, nome] of Object.entries(c.pessoas)) e.pessoas[papel] = { papel, nome, email: emailDe(c.chave, papel), id: await garantirUsuario(emailDe(c.chave, papel), nome, SENHA) };
    const admin = e.pessoas.admin;
    const ja = await sql(`select id from public.empresas where nome = '${aspas(c.nome)}'`);
    if (ja.length) e.id = ja[0].id;
    else e.id = await rpc(admin.id, 'criar_empresa', { p: { nome: c.nome, atuacao: c.atuacao, nome_pessoa: admin.nome } });
    await rest(admin.id, '/empresas?id=eq.' + e.id, { metodo: 'PATCH', corpo: { razao_social: c.nome + ', LLC', sigla: c.sigla, endereco: c.endereco, cidade: c.cidade, estado: 'NH', zip: c.zip, telefone: c.tel, email: 'office@' + c.chave + '.example.com' } });
    await sqlExec(`update public.empresas set plano = plano || '{"demo": true, "massa": "pv"}'::jsonb where id = '${e.id}'`);
    // perfis só da massa (o Administrador, o Gestor e o Trabalhador já vêm com a empresa)
    for (const [nome, p] of Object.entries(PERFIS_EXTRA)) {
      await sqlExec(`insert into public.perfis_acesso (empresa_id, chave, nome, descricao, sistema, permissoes) values ('${e.id}', null, '${aspas(nome)}', '${aspas(p.descricao)}', false, array[${p.permissoes.map((x) => "'" + x + "'").join(', ')}]) on conflict (empresa_id, nome) do nothing`);
    }
    for (const [papel, p] of Object.entries(e.pessoas)) {
      if (papel === 'admin') continue;
      const cfg = PAPEIS[papel];
      const perfil = PERFIS_EXTRA[cfg.perfil] ? `pa.nome = '${aspas(cfg.perfil)}'` : `pa.chave = '${cfg.perfil}'`;
      await sqlExec(`insert into public.membros (empresa_id, user_id, perfil_id, nome, cargo) select '${e.id}', '${p.id}', pa.id, '${aspas(p.nome)}', '${aspas(cfg.cargo)}' from public.perfis_acesso pa where pa.empresa_id = '${e.id}' and ${perfil} on conflict (user_id) do nothing`);
    }
    for (const p of Object.values(e.pessoas)) p.membro = (await sql(`select id from public.membros where user_id = '${p.id}'`))[0].id;
    for (const p of Object.values(e.pessoas)) await sqlExec(`insert into public.notificacao_prefs (user_id, categoria, push, email) select '${p.id}', c, true, false from unnest(array['daily','cronograma','concorrencia','crew','conta']) c on conflict (user_id, categoria) do update set email = false`);
    console.log('  ' + c.nome + ' (' + c.atuacao + ') · ' + Object.keys(e.pessoas).length + ' logins');
  }

  for (const e of Object.values(E)) {
    const admin = e.pessoas.admin;
    const existentes = await rest(admin.id, '/contatos?select=id,nome');
    const quer = [];
    for (const k of e.clientes || []) quer.push({ nome: k, papeis: ['cliente'] });
    for (const o of e.obras) if (!o.para && !o.cliente) { o.cliente = o.nome + ' Owner LLC'; quer.push({ nome: o.cliente, papeis: ['cliente'] }); }   // obra própria: o dono é o contratante
    for (const o of e.obras) if (o.para) { const gc = E[o.para[0]]; if (!quer.some((x) => x.nome === gc.nome)) quer.push({ nome: gc.nome, papeis: ['construtora'], conta: gc.id, email: 'office@' + gc.chave + '.example.com', telefone: gc.tel, cidade: gc.cidade, estado: 'NH' }); }
    for (const x of quer) {
      let ct = existentes.find((y) => y.nome === x.nome);
      if (!ct) { const { conta, ...corpo } = x; [ct] = await rest(admin.id, '/contatos', { metodo: 'POST', corpo }); }
      if (x.conta) await sqlExec(`update public.contatos set conta_empresa_id = '${x.conta}' where id = '${ct.id}' and conta_empresa_id is null`);
      e.contatos[x.nome] = ct.id;
    }
    const hoje = await rpc(admin.id, 'hoje_da_empresa', { p_empresa: e.id });
    e.hoje = hoje;
    const obrasJa = await rest(admin.id, '/obras?select=id,nome');
    for (const o of e.obras) {
      let x = obrasJa.find((y) => y.nome === o.nome);
      if (!x) {
        const corpo = { nome: o.nome, contratante_id: o.para ? e.contatos[E[o.para[0]].nome] : e.contatos[o.cliente], municipio: o.municipio, estado: o.estado, zip: o.zip, lat: o.lat, lon: o.lon, raio: 150, inicio: somar(hoje, o.inicio), prazo: somar(hoje, o.inicio + o.prazo), endereco: '' };
        if (e.atuacao !== 'construtora') corpo.responsavel_id = admin.membro;
        [x] = await rest(admin.id, '/obras', { metodo: 'POST', corpo });
      }
      e.obrasPorNome[o.nome] = x.id;
    }
    console.log('  ' + e.nome + ': ' + e.obras.length + ' obras, ' + Object.keys(e.contatos).length + ' contatos');
  }
  // a obra da prestadora ligada à da contratante (quem grava isso, no produto, são as funções das concorrências)
  for (const e of Object.values(E)) for (const o of e.obras) {
    if (!o.para) continue;
    const gc = E[o.para[0]];
    await sqlExec(`update public.obras set vinculo_empresa_id = '${gc.id}', vinculo_obra_id = '${gc.obrasPorNome[o.para[1]]}' where id = '${e.obrasPorNome[o.nome]}' and vinculo_empresa_id is null`);
  }
}

// ---------------------------------------------------------------- as concorrências
async function concorrencias() {
  console.log('\nConcorrências (convites para cotar) em todos os pares e estados');
  const contagem = {};
  for (const c of CONCORRENCIAS) {
    const de = E[c.de], admin = de.pessoas.admin;
    const ja = await rest(admin.id, '/concorrencias?select=id&servico=eq.' + encodeURIComponent(c.servico));
    if (ja.length) { console.log('  ' + c.servico + ': já existe, pulei'); continue; }
    const prazo = new Date(Date.now() + c.dias * 86400000).toISOString();
    const [conc] = await rest(admin.id, '/concorrencias', { metodo: 'POST', corpo: { obra_id: de.obrasPorNome[c.obra], servico: c.servico, etapas: c.etapas, incluso: c.incluso, excluso: c.excluso, observacoes: c.obs, prazo, quarteirizacao: 'com-aprovacao', orcamento: { mostrar: c.mostrar, ...(c.mostrar === 'total' ? { valor: 100000 } : {}) } } });
    const contatos = await rest(admin.id, '/contatos?select=id,nome');
    for (const k of c.convites) {
      const ext = EXTERNAS.find((x) => x.chave === k), sub = E[k];
      const nome = ext ? ext.nome : sub.nome;
      let ct = contatos.find((x) => x.nome === nome);
      if (!ct) [ct] = await rest(admin.id, '/contatos', { metodo: 'POST', corpo: ext
        ? { nome, papeis: ['prestadora'], email: 'office@' + ext.chave + '.example.com', telefone: ext.tel, cidade: ext.cidade, estado: ext.estado }
        : { nome, papeis: [sub.atuacao === 'construtora' ? 'construtora' : 'prestadora'], email: 'office@' + sub.chave + '.example.com', telefone: sub.tel, cidade: sub.cidade, estado: 'NH' } });
      if (sub) await sqlExec(`update public.contatos set conta_empresa_id = '${sub.id}' where id = '${ct.id}' and conta_empresa_id is null`);
      await rest(admin.id, '/concorrencia_convites', { metodo: 'POST', corpo: { concorrencia_id: conc.id, contato_id: ct.id } });
    }
    if (c.estado === 'rascunho') { console.log('  [' + c.par + '] ' + c.servico + ' (' + de.nome + '): rascunho'); contagem[c.estado] = (contagem[c.estado] || 0) + 1; continue; }
    await rpc(admin.id, 'enviar_concorrencia', { p_id: conc.id });
    const convites = {};
    for (const k of c.convites) {
      const sub = E[k];
      if (!sub) continue;   // convidada sem conta: só tem o link; ninguém responde por ela aqui
      const subAdmin = sub.pessoas.admin;
      const convite = (await sql(`select id from public.concorrencia_convites where concorrencia_id = '${conc.id}' and convidada_id = '${sub.id}'`))[0].id;
      convites[k] = convite;
      if (c.recusa && c.recusa.de === k) { await rpc(subAdmin.id, 'responder_convite', { p_convite: convite, p_vai: false, p_motivo: c.recusa.motivo }); continue; }
      await rpc(subAdmin.id, 'marcar_visto', { p_convite: convite });
      const prop = c.propostas[k];
      if (!prop) continue;
      await rpc(subAdmin.id, 'responder_convite', { p_convite: convite, p_vai: true, p_motivo: '' });
      await rpc(subAdmin.id, 'enviar_proposta_concorrencia', { p_convite: convite, p: { porEtapa: prop.porEtapa, prazoExecucaoDias: prop.dias, exclusoes: prop.excl, numero: sub.sigla + '-' + (1000 + (semente(sub.chave + c.servico) % 900)) } });
    }
    if (c.pergunta) {
      const subAdmin = E[c.pergunta.de].pessoas.admin;
      await rpc(subAdmin.id, 'escrever_como_convidada', { p_convite: convites[c.pergunta.de], p_texto: c.pergunta.texto });
      const msg = (await sql(`select id from public.concorrencia_mensagens where concorrencia_id = '${conc.id}' order by em desc limit 1`))[0].id;
      await rpc(admin.id, 'escrever_como_contratante', { p_id: conc.id, p_convite: convites[c.pergunta.de], p_resposta_de: msg, p_para_todos: true, p_texto: c.pergunta.resposta });
    }
    if (c.prorroga) await rpc(admin.id, 'prorrogar_concorrencia', { p_id: conc.id, p_prazo: new Date(Date.now() + (c.dias + c.prorroga) * 86400000).toISOString(), p_motivo: 'More time to price the extras.' });
    if (c.estado === 'fechada') await rpc(admin.id, 'fechar_concorrencia', { p_id: conc.id, p_convite: convites[c.vencedora], p_observacao: 'Best price and the shortest schedule.' });
    if (c.estado === 'cancelada') await rpc(admin.id, 'cancelar_concorrencia', { p_id: conc.id, p_motivo: c.motivoCancelar });
    contagem[c.estado] = (contagem[c.estado] || 0) + 1;
    console.log('  [' + c.par + '] ' + c.servico + ' (' + de.nome + '): ' + c.estado + (c.vencedora ? ', vencedora ' + E[c.vencedora].nome : ''));
  }
  console.log('  resumo: ' + JSON.stringify(contagem));
}

for (const f of ['estrutura', 'concorrencias']) {
  if (!FASES.includes(f)) continue;
  if (f === 'estrutura' || !E.c1) await estrutura();
  if (f === 'concorrencias') await concorrencias();
}
console.log('\nPronto. Logins: pv.<empresa>.<papel>@example.com (admin, gestor, orcamentista, contatos, trabalhador); a senha é a de ' + SENHA_VARIAVEL + '.');
