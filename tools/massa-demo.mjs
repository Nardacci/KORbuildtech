/* KORbuild — a massa de dados de demonstração (docs/massa-demo.md).
 * Cria, numa conta de verdade, 3 construtoras, 6 prestadoras que trabalham para elas e 3 prestadoras independentes, com pessoas,
 * funcionários, equipes, obras, 5 semanas de ponto e 3 semanas de diários em vários estados. Usa as MESMAS funções do banco que o app
 * (criar_empresa, criar_funcionario, registrar_batidas, salvar_rdo, enviar_rdo, aprovar_rdo, decidir_semana…), cada uma como a pessoa
 * dona do papel; só o que o app não faz (membros, ligação entre obras, plano) sai por SQL de administrador.
 * Nunca apaga nada. Pode rodar de novo: o que já existe é pulado.
 * Nenhum e-mail sai: os usuários são example.com (reservado) e os avisos deles por e-mail ficam desligados antes de qualquer evento.
 *
 * Uso:
 *   node tools/massa-demo.mjs                      (banco local; tools/supabase-local.sh)
 *   KOR_DEMO_SENHA='…' node tools/massa-demo.mjs --real   (Supabase do projeto; SUPABASE_ACCESS_TOKEN na variável de ambiente)
 *   --fase=estrutura,ponto,diarios,planos   (padrão: todas) */

import { EMPRESAS, nomeNovo, emailDe, SENHA_VARIAVEL } from './massa-demo/dados.mjs';

const REAL = process.argv.includes('--real');
const FASES = ((process.argv.find((a) => a.startsWith('--fase=')) || '').slice(7) || 'estrutura,ponto,diarios,planos').split(',');
const { sql, sqlExec, rest, garantirUsuario } = await import(REAL ? '../tests/_supabase-real.mjs' : '../tests/_supabase-local.mjs');
const SENHA = process.env[SENHA_VARIAVEL] || '';
if (REAL && SENHA.length < 12) { console.error('Defina ' + SENHA_VARIAVEL + ' (pelo menos 12 caracteres) na variável de ambiente; ela nunca vai para o repositório.'); process.exit(2); }
console.log('Massa de demonstração contra: ' + (REAL ? 'Supabase do projeto' : 'Supabase local'));

const rpc = (uid, nome, args) => rest(uid, '/rpc/' + nome, { metodo: 'POST', corpo: args || {} });
const aspas = (t) => String(t).replace(/'/g, "''");
const somar = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const diaDaSemana = (iso) => new Date(iso + 'T12:00:00Z').getUTCDay();   // 0 = domingo

/* Números repetíveis: a mesma empresa e dia dão sempre o mesmo resultado. */
function semente(texto) { let h = 2166136261; for (const c of texto) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function sorteio(texto) { let a = semente(texto); return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* Uma hora do relógio de Nova York (o fuso das empresas) em UTC. */
function nyParaUTC(iso, hhmm) {
  const [y, m, d] = iso.split('-').map(Number); const [hh, mm] = hhmm.split(':').map(Number);
  let alvo = Date.UTC(y, m - 1, d, hh, mm);
  for (let i = 0; i < 2; i++) {
    const partes = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(alvo)).map((p) => [p.type, p.value]));
    const visto = Date.UTC(+partes.year, +partes.month - 1, +partes.day, +partes.hour, +partes.minute);
    alvo -= visto - Date.UTC(y, m - 1, d, hh, mm);
  }
  return new Date(alvo);
}
const hhmm = (min) => String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');

// ---------------------------------------------------------------- a estrutura
const E = {};   // chave → { id, admin, pessoas: { papel: { id, email, nome, membro } }, obras: {nome → id}, contatos: {nome → id}, funcionarios: [{id, nome, funcao}], equipe }
const PERFIL = { admin: 'administrador', gestor: 'gestor', encarregado: 'encarregado', trabalhador: 'trabalhador' };

async function estrutura() {
  console.log('\nEstrutura: usuários, empresas, pessoas, funcionários, equipes e obras');
  for (const c of EMPRESAS) {
    const e = E[c.chave] = { ...c, obras: c.obras.map((o) => ({ ...o })), pessoas: {}, contatos: {}, funcionarios: [] };
    for (const [papel, nome] of c.pessoas) {
      const n = nome || nomeNovo();
      const email = emailDe(c.chave, papel);
      e.pessoas[papel] = { email, nome: n, id: await garantirUsuario(email, n, SENHA) };
    }
    const admin = e.pessoas.admin;
    const ja = await sql(`select id from public.empresas where nome = '${aspas(c.nome)}'`);
    if (ja.length) e.id = ja[0].id;
    else e.id = await rpc(admin.id, 'criar_empresa', { p: { nome: c.nome, atuacao: c.atuacao, nome_pessoa: admin.nome } });
    await rest(admin.id, '/empresas?id=eq.' + e.id, { metodo: 'PATCH', corpo: { razao_social: c.razao, sigla: c.sigla, endereco: c.endereco, cidade: c.cidade, estado: c.estado, zip: c.zip, telefone: c.tel, email: 'office@' + c.chave + '.example.com', especialidades: c.atuacao === 'construtora' ? 'General contracting' : (c.etapas || []).join(', ') } });
    // os outros papéis entram direto como membros (o convite por e-mail mandaria mensagem de verdade)
    for (const [papel, p] of Object.entries(e.pessoas)) {
      if (papel === 'admin') continue;
      await sqlExec(`insert into public.membros (empresa_id, user_id, perfil_id, nome, cargo) select '${e.id}', '${p.id}', pa.id, '${aspas(p.nome)}', '${papel === 'gestor' ? 'Project executive' : papel === 'encarregado' ? 'Foreman' : 'Crew'}' from public.perfis_acesso pa where pa.empresa_id = '${e.id}' and pa.chave = '${PERFIL[papel]}' on conflict (user_id) do nothing`);
    }
    for (const [papel, p] of Object.entries(e.pessoas)) p.membro = (await sql(`select id from public.membros where user_id = '${p.id}'`))[0].id;
    // sem e-mail de aviso para ninguém, antes de qualquer evento
    for (const p of Object.values(e.pessoas)) await sqlExec(`insert into public.notificacao_prefs (user_id, categoria, push, email) select '${p.id}', c, true, false from unnest(array['daily','cronograma','concorrencia','crew','conta']) c on conflict (user_id, categoria) do update set email = false`);
    console.log('  ' + c.nome + ' (' + c.atuacao + ') · ' + Object.keys(e.pessoas).length + ' logins');
  }

  for (const e of Object.values(E)) {
    const admin = e.pessoas.admin;
    // contatos: os clientes da empresa e, nas prestadoras de construtoras, as construtoras
    const contatos = [...(e.clientes || []).map((x) => ({ nome: x.nome, papeis: ['cliente'] }))];
    for (const o of e.obras) if (o.para) { const gc = E[o.para[0]]; if (!contatos.some((x) => x.nome === gc.nome)) contatos.push({ nome: gc.nome, papeis: ['construtora'], email: 'office@' + gc.chave + '.example.com', telefone: gc.tel, cidade: gc.cidade, estado: gc.estado }); }
    const existentes = await rest(admin.id, '/contatos?select=id,nome');
    for (const x of contatos) {
      let c = existentes.find((y) => y.nome === x.nome);
      if (!c) [c] = await rest(admin.id, '/contatos', { metodo: 'POST', corpo: x });
      e.contatos[x.nome] = c.id;
    }

    // funcionários (a pessoa do login e o funcionário dela são a mesma gente)
    const hoje = await rpc(admin.id, 'hoje_da_empresa', { p_empresa: e.id });
    e.hoje = hoje;
    const ja = await rest(admin.id, '/funcionarios?select=id,nome,funcao');
    const nomesDoLogin = { 'Foreman': e.pessoas.encarregado, 'Foreman (journeyman)': e.pessoas.encarregado, 'Project manager': e.pessoas.admin, 'Superintendent': e.pessoas.gestor };
    let k = 0, primeiroTrabalhador = true;
    for (const [funcao, qtd, base] of e.quadro) {
      for (let i = 0; i < qtd; i++, k++) {
        let nome = null, login = null;
        if (nomesDoLogin[funcao] && i === 0) { login = nomesDoLogin[funcao]; nome = login.nome; }
        else if (e.pessoas.trabalhador && primeiroTrabalhador && !nomesDoLogin[funcao]) { login = e.pessoas.trabalhador; nome = login.nome; primeiroTrabalhador = false; }
        else nome = nomeNovo();
        let f = ja.find((x) => x.nome === nome);
        if (!f) {
          const r = sorteio(e.chave + nome);
          const id = await rpc(admin.id, 'criar_funcionario', { p: { nome, funcao, codigo: e.sigla + String(k + 1).padStart(3, '0'), admissao: somar(hoje, -(120 + Math.floor(r() * 700))), classificacao: 'w2', flsa: 'nao-isento', telefone: '(603) 555-' + String(1000 + Math.floor(r() * 8999)), emergencia: '', aviso_gps_em: somar(hoje, -60),
            certificacoes: funcao === 'Laborer' || funcao.includes('tender') ? [] : [{ nome: 'OSHA 10', validade: somar(hoje, 200 + Math.floor(r() * 500)) }] } , p_valor: Math.round((base + (i % 3) * 1.5) * 100) / 100 });
          f = { id, nome, funcao };
        }
        e.funcionarios.push({ ...f, funcao });
        if (login) await sqlExec(`update public.membros set funcionario_id = '${f.id}' where id = '${login.membro}'`);
      }
    }

    // equipe (só as prestadoras batem ponto) e obras
    if (e.atuacao !== 'construtora') {
      const eq = await rest(admin.id, '/equipes?select=id,nome');
      let equipe = eq[0];
      for (const o of e.obras) await criarObra(e, o, admin);
      if (!equipe) [equipe] = await rest(admin.id, '/equipes', { metodo: 'POST', corpo: { nome: 'Crew A', encarregado_id: e.pessoas.encarregado.membro, obra_base_id: e.obras[0].id_ } });
      e.equipe = equipe.id;
      await sqlExec(`update public.funcionarios set equipe_id = '${equipe.id}' where empresa_id = '${e.id}' and equipe_id is null`);
    } else for (const o of e.obras) await criarObra(e, o, admin);
    console.log('  ' + e.nome + ': ' + e.funcionarios.length + ' funcionários, ' + e.obras.length + ' obras');
  }

  // a obra da prestadora ligada à da construtora (quem grava isso, no produto, são as funções das concorrências)
  for (const e of Object.values(E)) for (const o of e.obras) {
    if (!o.para) continue;
    const gc = E[o.para[0]];
    await sqlExec(`update public.obras set vinculo_empresa_id = '${gc.id}', vinculo_obra_id = '${gc.obrasPorNome[o.para[1]]}' where id = '${o.id_}' and vinculo_empresa_id is null`);
  }
}

async function criarObra(e, o, admin) {
  const existentes = await rest(admin.id, '/obras?select=id,nome');
  let x = existentes.find((y) => y.nome === o.nome);
  if (!x) {
    const contratante = o.para ? e.contatos[E[o.para[0]].nome] : e.contatos[o.cliente];
    const corpo = { nome: o.nome, contratante_id: contratante, municipio: o.municipio, estado: o.estado, zip: o.zip, lat: o.lat, lon: o.lon, raio: 150, inicio: somar(e.hoje, o.inicio), prazo: somar(e.hoje, o.inicio + o.prazo), endereco: '' };
    if (e.atuacao !== 'construtora') corpo.responsavel_id = e.pessoas.encarregado.membro;
    [x] = await rest(admin.id, '/obras', { metodo: 'POST', corpo });
  }
  o.id_ = x.id;
  e.obras = e.obras.map((y) => (y === o ? o : y));
  e.obrasPorNome = e.obrasPorNome || {};
  e.obrasPorNome[o.nome] = x.id;
}

// ---------------------------------------------------------------- o ponto
const ETAPA_DE = (e, i) => (e.etapas || [])[i % Math.max(1, (e.etapas || []).length)] || 'General';
async function ponto() {
  console.log('\nPonto: 5 semanas e a semana de hoje');
  for (const e of Object.values(E)) {
    if (e.atuacao === 'construtora') continue;
    const ja = await sql(`select count(*)::int n from public.batidas where empresa_id = '${e.id}'`);
    if (ja[0].n > 0) { console.log('  ' + e.nome + ': já tem ponto, pulei'); continue; }
    const foreman = e.pessoas.encarregado, admin = e.pessoas.admin;
    const segunda = await rpc(admin.id, 'segunda_de', { d: e.hoje });
    const inicioJanela = somar(segunda, -35);
    const agora = Date.now();
    let enviadas = 0, recusadas = 0;
    e.presenca = {};   // dia → [funcionários presentes] (o diário usa a mesma conta)
    for (let dia = inicioJanela; dia <= e.hoje; dia = somar(dia, 1)) {
      const dow = diaDaSemana(dia);
      if (dow === 0 || dow === 6) continue;
      const obra = obraDoDia(e, dia, dow);
      if (!obra) continue;
      const lote = [];
      const presentes = [];
      for (const f of e.funcionarios) {
        const r = sorteio(e.chave + dia + f.nome);
        if (r() < 0.05) continue;   // faltou
        presentes.push(f);
        const dentro = r() > 0.04;
        const pos = () => ({ lat: obra.lat + (dentro ? (r() - 0.5) * 0.0006 : 0.007), lon: obra.lon + (dentro ? (r() - 0.5) * 0.0006 : 0.004), precisao: 6 + Math.floor(r() * 12), fonte_gps: 'gps' });
        const entra = 7 * 60 - 10 + Math.floor(r() * 25), saiu = 15 * 60 + 30 + Math.floor(r() * 120);
        const evs = [['entrada', entra], ['intervalo-inicio', 12 * 60 + Math.floor(r() * 10)], ['intervalo-fim', 12 * 60 + 35 + Math.floor(r() * 10)], ['saida', saiu]];
        for (const [tipo, min] of evs) {
          const em = nyParaUTC(dia, hhmm(min));
          if (em.getTime() > agora - 60000) continue;   // o que ainda não aconteceu hoje não existe
          lote.push({ id: crypto.randomUUID(), funcionario_id: f.id, tipo, obra_id: obra.id_, etapa: ETAPA_DE(e, Math.floor((semente(dia) % 3))), em: em.toISOString(), ...pos() });
        }
      }
      e.presenca[dia] = { obra: obra.id_, presentes };
      for (let i = 0; i < lote.length; i += 80) {
        const res = await rpc(foreman.id, 'registrar_batidas', { p: lote.slice(i, i + 80) });
        enviadas += res.gravadas.length; recusadas += res.recusadas.length;
        if (res.recusadas.length && recusadas <= 3) console.log('    recusada: ' + JSON.stringify(res.recusadas[0]));
      }
    }
    console.log('  ' + e.nome + ': ' + enviadas + ' batidas' + (recusadas ? ' (' + recusadas + ' recusadas)' : ''));
    // semanas fechadas pelo escritório: as 4 mais antigas aprovadas; a passada com uma devolvida e uma ainda a aprovar
    const semanas = [-5, -4, -3, -2, -1].map((n) => somar(segunda, n * 7));
    let aprovados = 0;
    for (const [i, semana] of semanas.entries()) {
      for (const f of e.funcionarios) {
        if (i === 4 && e.funcionarios.indexOf(f) % 4 !== 0) continue;   // na semana passada só parte já foi aprovada
        try {
          if (i === 4 && e.funcionarios.indexOf(f) === 4) await rpc(admin.id, 'decidir_semana', { p_funcionarios: [f.id], p_semana: semana, p_status: 'devolvido', p_motivo: 'Please confirm the lunch punch on Wednesday.' });
          else await rpc(admin.id, 'decidir_semana', { p_funcionarios: [f.id], p_semana: semana, p_status: 'aprovado' });
          aprovados++;
        } catch { /* semana com dia sem saída: fica para o escritório */ }
      }
    }
    console.log('    semanas aprovadas: ' + aprovados);
  }
}
function obraDoDia(e, dia, dow) {
  const ativas = e.obras.filter((o) => somar(e.hoje, o.inicio) <= dia && dia <= somar(e.hoje, o.inicio + o.prazo));
  if (!ativas.length) return null;
  return ativas.length > 1 && dow >= 4 ? ativas[1] : ativas[0];
}

// ---------------------------------------------------------------- os diários
/* Quem bateu entrada em cada dia (para o diário falar das mesmas pessoas que o ponto). */
async function presencaDoBanco(e) {
  const linhas = await sql(`select b.funcionario_id, (b.em at time zone 'America/New_York')::date::text as dia, b.obra_id from public.batidas b where b.empresa_id = '${e.id}' and b.tipo = 'entrada'`);
  const presenca = {};
  for (const l of linhas) {
    const p = presenca[l.dia] = presenca[l.dia] || { obra: l.obra_id, presentes: [] };
    const f = e.funcionarios.find((x) => x.id === l.funcionario_id);
    if (f) p.presentes.push(f);
  }
  return presenca;
}
const TEMPOS = ['sol', 'sol', 'sol', 'nublado', 'nublado', 'chuva'];
let obraGlobal = 0;
async function diarios() {
  console.log('\nDiários: 3 semanas, em vários estados');
  for (const e of Object.values(E)) {
    if (e.atuacao === 'construtora') continue;
    const foreman = e.pessoas.encarregado;
    if (!e.presenca) e.presenca = await presencaDoBanco(e);
    for (const o of e.obras) {
      const oi = obraGlobal++;
      const ja = await sql(`select count(*)::int n from public.rdos where obra_id = '${o.id_}'`);
      if (ja[0].n > 0) { console.log('  ' + o.nome + ': já tem diários, pulei'); continue; }
      const aprovador = o.para ? (E[o.para[0]].pessoas.gestor || E[o.para[0]].pessoas.admin) : e.pessoas.admin;
      const dias = Object.keys(e.presenca).filter((d) => e.presenca[d].obra === o.id_ && d >= somar(e.hoje, -21)).sort();
      const contagem = {};
      for (const [i, dia] of dias.entries()) {
        const passados = dias.filter((d) => d < e.hoje);
        const falta = passados.length - 1 - passados.indexOf(dia);   // 0 = o último dia de trabalho antes de hoje
        const r = sorteio(e.chave + o.nome + dia);
        const manha = TEMPOS[Math.floor(r() * 6)], tarde = TEMPOS[Math.floor(r() * 6)];
        const hoje = dia === e.hoje;
        let estado = hoje ? (oi % 2 === 0 ? 'rascunho' : null) : falta === 0 ? ((oi % 2 === 1 || oi % 5 === 2) ? 'enviado' : 'aprovado') : falta === 1 && oi % 3 === 0 ? 'ajustes' : 'aprovado';
        if (!estado) continue;
        const id = crypto.randomUUID();
        const presentes = e.presenca[dia].presentes;
        const porFuncao = {};
        for (const f of presentes) porFuncao[f.funcao] = (porFuncao[f.funcao] || 0) + 1;
        const faltas = {};
        for (const f of e.funcionarios) if (!presentes.includes(f)) faltas[f.funcao] = (faltas[f.funcao] || 0) + 1;
        const semAtividade = manha === 'chuva' && tarde === 'chuva' && !hoje;
        try {
          if (semAtividade) {
            await rpc(foreman.id, 'dia_sem_atividade', { p: { id, obra_id: o.id_, data: dia, motivo: 'Rain all day: site closed' } });
          } else {
            const conteudo = {
              clima: { manha: { tempo: manha, praticavel: manha !== 'chuva' }, tarde: { tempo: tarde, praticavel: tarde !== 'chuva' }, fonte: 'automatico' },
              equipe: Object.entries(porFuncao).map(([funcao, presentes_]) => ({ funcao, presentes: presentes_, faltas: faltas[funcao] || 0 })),
              equipamentos: e.equip.map(([nome, qtd, st]) => ({ nome, qtd, status: st })),
              atividades: [0, 1].map((k) => ({ id: crypto.randomUUID(), descricao: e.atividades[(i + k) % e.atividades.length], local: e.locais[(i + k) % e.locais.length], situacao: k === 0 && i % 4 === 3 ? 'concluida' : 'andamento' })),
              ocorrencias: r() < 0.18 ? [{ id: crypto.randomUUID(), tipo: ['material', 'equipe', 'visita', 'projeto'][Math.floor(r() * 4)], descricao: ['Delivery arrived two hours late.', 'One crew member left early with a doctor appointment.', 'Owner walked the site with the architect.', 'RFI sent for a detail at the stair opening.'][Math.floor(r() * 4)] }] : [],
              observacoes: '',
            };
            const s = await rpc(foreman.id, 'salvar_rdo', { p: { id, obra_id: o.id_, data: dia, versao: null, conteudo } });
            if (estado !== 'rascunho') await rpc(foreman.id, 'enviar_rdo', { p_id: id, p_versao: s.versao });
          }
          if (estado === 'aprovado' || (semAtividade && estado !== 'enviado' && estado !== 'ajustes')) { await rpc(aprovador.id, 'aprovar_rdo', { p_id: id }); estado = 'aprovado'; }
          else if (estado === 'ajustes') await rpc(aprovador.id, 'pedir_ajustes', { p_id: id, p_motivo: 'Please add a photo of the finished area before approval.' });
          contagem[estado] = (contagem[estado] || 0) + 1;
        } catch (err) {
          contagem.erro = (contagem.erro || 0) + 1;
          if (contagem.erro <= 2) console.log('    ' + dia + ' ' + o.nome + ': ' + String(err.message).slice(0, 200));
        }
      }
      console.log('  ' + o.nome + ': ' + JSON.stringify(contagem));
    }
  }
}

// ---------------------------------------------------------------- planos e acessos
async function planos() {
  console.log('\nPlanos, marca de demonstração e últimos acessos');
  for (const e of Object.values(E)) {
    const p = e.plano;
    await sqlExec(`update public.empresas set plano = jsonb_build_object('nome', '${p.nome}', 'status', '${p.status}', 'demo', true${p.status === 'teste' ? `, 'teste_ate', (current_date + ${p.dias})::text` : ''}) where nome = '${aspas(e.nome)}'`);
    for (const o of e.obras) if (o.concluida) await sqlExec(`update public.obras set situacao = 'concluida' where id = '${o.id_}'`);
    for (const m of Object.values(e.pessoas)) await sqlExec(`update public.membros set ultimo_acesso = now() - (${semente(m.email) % 48} || ' hours')::interval where user_id = '${m.id}'`);
    console.log('  ' + e.nome + ': ' + p.nome + ' · ' + p.status + (p.dias != null ? ' (' + p.dias + ' dias)' : ''));
  }
}

for (const f of ['estrutura', 'ponto', 'diarios', 'planos']) {
  if (!FASES.includes(f)) continue;
  if (f === 'estrutura') await estrutura(); else if (!E.gc1) await estrutura();
  if (f === 'ponto') await ponto();
  if (f === 'diarios') await diarios();
  if (f === 'planos') await planos();
}
console.log('\nPronto. Logins: demo.<empresa>.<papel>@example.com (admin, gestor, encarregado, trabalhador); a senha é a de ' + SENHA_VARIAVEL + '.');
