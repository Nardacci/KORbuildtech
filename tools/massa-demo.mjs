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
import { iniciarFotos } from './massa-demo/fotos.mjs';

const REAL = process.argv.includes('--real');
const FASES = ((process.argv.find((a) => a.startsWith('--fase=')) || '').slice(7) || 'estrutura,ponto,diarios,cronograma,concorrencias,planos').split(',');
const { sql, sqlExec, rest, garantirUsuario, subirArquivo } = await import(REAL ? '../tests/_supabase-real.mjs' : '../tests/_supabase-local.mjs');
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
    await sqlExec(`update public.empresas set plano = plano || '{"demo": true}'::jsonb where id = '${e.id}'`);   // a marca de demonstração vale desde o começo
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
      const ativas = obrasAtivas(e, dia);
      if (!ativas.length) continue;
      const lote = [];
      const presentes = {};   // obra → quem foi para ela neste dia
      for (const [fi, f] of e.funcionarios.entries()) {
        const r = sorteio(e.chave + dia + f.nome);
        if (r() < 0.05) continue;   // faltou
        // com duas obras no ar a equipe se divide: 3 de cada 5 ficam na primeira, o resto vai para a outra
        const obra = ativas.length > 1 && fi % 5 >= 3 ? ativas[1] : ativas[0];
        (presentes[obra.id_] = presentes[obra.id_] || []).push(f);
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
      for (const [oid, quem] of Object.entries(presentes)) e.presenca[dia + '|' + oid] = { obra: oid, presentes: quem };
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
const obrasAtivas = (e, dia) => e.obras.filter((o) => somar(e.hoje, o.inicio) <= dia && dia <= somar(e.hoje, o.inicio + o.prazo));

// ---------------------------------------------------------------- os diários
/* Quem bateu entrada em cada dia (para o diário falar das mesmas pessoas que o ponto). */
async function presencaDoBanco(e) {
  const linhas = await sql(`select b.funcionario_id, (b.em at time zone 'America/New_York')::date::text as dia, b.obra_id from public.batidas b where b.empresa_id = '${e.id}' and b.tipo = 'entrada'`);
  const presenca = {};
  for (const l of linhas) {
    const p = presenca[l.dia + '|' + l.obra_id] = presenca[l.dia + '|' + l.obra_id] || { obra: l.obra_id, presentes: [] };
    const f = e.funcionarios.find((x) => x.id === l.funcionario_id);
    if (f) p.presentes.push(f);
  }
  return presenca;
}
const TEMPOS = ['sol', 'sol', 'sol', 'nublado', 'nublado', 'chuva'];
const CENA = { s1: 'galpao', s2: 'estrutura', s3: 'concreto', s4: 'galpao', s5: 'estrutura', s6: 'estrutura', i1: 'galpao', i2: 'alvenaria', i3: 'estrutura' };
const LEGENDAS = ['Overview of the work area', 'Detail of the finished work', 'Material delivery'];
let obraGlobal = 0;
async function diarios() {
  console.log('\nDiários: 3 semanas, em vários estados (com fotos nos últimos 10 dias)');
  const geradorDeFotos = await iniciarFotos();
  for (const e of Object.values(E)) {
    if (e.atuacao === 'construtora') continue;
    const foreman = e.pessoas.encarregado;
    if (!e.presenca) e.presenca = await presencaDoBanco(e);
    for (const o of e.obras) {
      const oi = obraGlobal++;
      const ja = await sql(`select count(*)::int n from public.rdos where obra_id = '${o.id_}'`);
      if (ja[0].n > 0) { console.log('  ' + o.nome + ': já tem diários, pulei'); continue; }
      const aprovador = o.para ? (E[o.para[0]].pessoas.gestor || E[o.para[0]].pessoas.admin) : e.pessoas.admin;
      const dias = Object.keys(e.presenca).filter((k) => e.presenca[k].obra === o.id_).map((k) => k.split('|')[0]).filter((d) => d >= somar(e.hoje, -21)).sort();
      const contagem = {};
      for (const [i, dia] of dias.entries()) {
        const passados = dias.filter((d) => d < e.hoje);
        const falta = passados.length - 1 - passados.indexOf(dia);   // 0 = o último dia de trabalho antes de hoje
        const r = sorteio(e.chave + o.nome + dia);
        const manha = TEMPOS[Math.floor(r() * 6)], tarde = TEMPOS[Math.floor(r() * 6)];
        const hoje = dia === e.hoje;
        if (oi % 7 === 3 && !hoje && falta <= 1) continue;   // uma obra de propósito sem relatório nos dois últimos dias (o painel mostra o atraso)
        let estado = hoje ? (oi % 2 === 0 ? 'rascunho' : null) : falta === 0 ? ((oi % 2 === 1 || oi % 5 === 2) ? 'enviado' : 'aprovado') : falta === 1 && oi % 3 === 0 ? 'ajustes' : 'aprovado';
        if (!estado) continue;
        const id = crypto.randomUUID();
        const presentes = e.presenca[dia + '|' + o.id_].presentes;
        const porFuncao = {};
        for (const f of presentes) porFuncao[f.funcao] = (porFuncao[f.funcao] || 0) + 1;
        const faltas = {};
        const doDia = new Set(Object.entries(e.presenca).filter(([k]) => k.startsWith(dia + '|')).flatMap(([, v]) => v.presentes));
        if (o === obrasAtivas(e, dia)[0]) for (const f of e.funcionarios) if (!doDia.has(f)) faltas[f.funcao] = (faltas[f.funcao] || 0) + 1;   // quem faltou o dia todo entra no diário da primeira obra
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
            // fotos dos últimos 10 dias: 2 por diário, 3 nos mais recentes
            const fotos = [];
            if (dia >= somar(e.hoje, -10)) {
              const qtd = dia >= somar(e.hoje, -3) ? 3 : 2;
              for (let k = 0; k < qtd; k++) {
                const fid = crypto.randomUUID();
                const quando = nyParaUTC(dia, hhmm(9 * 60 + 40 + k * 130));
                const g = await geradorDeFotos.gerar({ cena: CENA[e.chave] || 'estrutura', obraNome: o.nome, lat: o.lat, lon: o.lon, quando: quando.getTime(), semente: semente(id + k) % 9000 + 1 });
                const base = e.id + '/' + o.id_ + '/' + id + '/' + fid;
                await subirArquivo(foreman.id, 'diarios', base + '.jpg', g.foto);
                await subirArquivo(foreman.id, 'diarios', base + '-mini.jpg', g.mini);
                fotos.push({ id: fid, path: base + '.jpg', path_mini: base + '-mini.jpg', legenda: LEGENDAS[k], tirada_em: quando.toISOString(), lat: o.lat, lon: o.lon, fonte_gps: 'gps', precisao: 6, largura: g.largura, altura: g.altura, tamanho: g.foto.length, hash_original: g.hash });
              }
            }
            const s = await rpc(foreman.id, 'salvar_rdo', { p: { id, obra_id: o.id_, data: dia, versao: null, conteudo, fotos } });
            if (estado !== 'rascunho') await rpc(foreman.id, 'enviar_rdo', { p_id: id, p_versao: s.versao });
          }
          if (estado === 'aprovado' || (semAtividade && estado !== 'enviado' && estado !== 'ajustes')) { await rpc(aprovador.id, 'aprovar_rdo', { p_id: id }); estado = 'aprovado'; }
          else if (estado === 'ajustes') await rpc(aprovador.id, 'pedir_ajustes', { p_id: id, p_motivo: 'Please detail the quantities installed and the area completed.' });
          contagem[estado] = (contagem[estado] || 0) + 1;
        } catch (err) {
          contagem.erro = (contagem.erro || 0) + 1;
          if (contagem.erro <= 2) console.log('    ' + dia + ' ' + o.nome + ': ' + String(err.message).slice(0, 200));
        }
      }
      console.log('  ' + o.nome + ': ' + JSON.stringify(contagem));
    }
  }
  await geradorDeFotos.fechar();
}

// ---------------------------------------------------------------- o cronograma
let cronGlobal = 0;
async function cronograma() {
  console.log('\nCronograma: etapas, avanços, atrasos, linhas de base e publicação para as construtoras');
  for (const e of Object.values(E)) {
    if (e.atuacao === 'construtora') continue;
    const admin = e.pessoas.admin;
    for (const o of e.obras) {
      const oi = cronGlobal++;
      const ja = await sql(`select count(*)::int n from public.cronograma_etapas where obra_id = '${o.id_}'`);
      if (ja[0].n > 0) { console.log('  ' + o.nome + ': já tem cronograma, pulei'); continue; }
      const nomes = [...(e.etapas.length ? e.etapas : ['Work']), 'Punch list and closeout'];
      const n = nomes.length, total = o.prazo;
      const etapas = nomes.map((nome, k) => ({ nome, ini: Math.floor((k * total) / n), fim: Math.floor(((k + 1) * total) / n) - 1 }));
      const ids = [];
      for (const [k, et] of etapas.entries()) {
        ids.push(await rpc(admin.id, 'salvar_etapa', { p: { obra_id: o.id_, nome: et.nome, inicio: somar(e.hoje, o.inicio + et.ini), fim: somar(e.hoje, o.inicio + et.fim), responsavel_id: e.pessoas.encarregado.membro } }));
      }
      // avanços até hoje (a obra atrasada, 1 em cada 3, anda 25 pontos abaixo do esperado)
      const atrasada = oi % 3 === 1;
      for (const [k, et] of etapas.entries()) {
        const ini = somar(e.hoje, o.inicio + et.ini), fim = somar(e.hoje, o.inicio + et.fim), tam = et.fim - et.ini + 1;
        const marcos = [];
        if (fim < e.hoje || o.concluida) marcos.push([somar(ini, Math.floor(tam / 3)), 40], [somar(ini, Math.floor((2 * tam) / 3)), 80], [fim, 100]);
        else if (ini <= e.hoje) {
          const f = Math.min(0.9, (diasEntre(ini, e.hoje) + 1) / tam);
          const alvo = Math.max(5, Math.round((f * 100 - (atrasada ? 25 : 0)) / 5) * 5);
          marcos.push([somar(ini, Math.min(3, Math.floor(tam / 4))), Math.min(25, alvo)]);
          if (alvo > 25) marcos.push([somar(e.hoje, -1), alvo]);
        }
        for (const [data, pct] of marcos) {
          if (data > e.hoje) continue;
          try { await rpc(admin.id, 'registrar_avanco', { p_etapa: ids[k], p_pct: pct, p_data: data }); } catch (err) { console.log('    avanço ' + et.nome + ': ' + String(err.message).slice(0, 120)); }
        }
      }
      // atraso visível contra a linha de base: a etapa em andamento ganha dias e as seguintes andam junto
      if (atrasada && !o.concluida) {
        const atual = etapas.findIndex((et) => somar(e.hoje, o.inicio + et.fim) >= e.hoje);
        if (atual >= 0) {
          for (let k = atual; k < etapas.length; k++) await rpc(admin.id, 'salvar_etapa', { p: { id: ids[k], obra_id: o.id_, nome: etapas[k].nome, inicio: somar(e.hoje, o.inicio + etapas[k].ini + (k === atual ? 0 : 6)), fim: somar(e.hoje, o.inicio + etapas[k].fim + 6), responsavel_id: e.pessoas.encarregado.membro } });
          if (oi % 2 === 1) await rpc(admin.id, 'nova_linha_base', { p_obra: o.id_, p_motivo: 'Material lead time pushed the remaining stages by six days.' });
        }
      }
      let publicado = 0;
      if (o.para) { await rpc(admin.id, 'publicar_cronograma', { p_obra: o.id_ }); publicado = 1; if (atrasada) { await rpc(admin.id, 'publicar_cronograma', { p_obra: o.id_ }); publicado = 2; } }
      console.log('  ' + o.nome + ': ' + etapas.length + ' etapas' + (atrasada ? ', atrasada' : '') + (publicado ? ', publicada ' + publicado + 'x' : ''));
    }
  }
}
const diasEntre = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 86400000);

// ---------------------------------------------------------------- as concorrências
/* Concorrências entre as construtoras e as prestadoras ligadas a elas, em quatro estados: aberta com propostas e perguntas, fechada com vencedora
 * (a vencedora ainda não criou a obra: a tela dela mostra "Você venceu"), aberta aguardando respostas e rascunho. Só entre empresas com conta
 * (nada vai por e-mail) e só entre as ligadas; as independentes ficam de fora, como o resto da massa. */
const CONCORRENCIAS = [
  { gc: 'gc1', obra: 'Riverside Medical Office', servico: 'Exterior windows and doors', etapas: ['08 51 13', '08 11 13'], incluso: ['Supply and install aluminum windows', 'Supply and install hollow metal doors', 'Flashing and sealants'], excluso: ['Interior finish trim', 'Glazing of the lobby storefront'],
    obs: 'Install after the weather barrier inspection. Dumpster on site.', dias: 6, convites: ['s1', 's2'], mostrar: 'nao', estado: 'aberta',
    propostas: { s1: { porEtapa: { '08 51 13': 31200, '08 11 13': 17300 }, dias: 18, excl: ['Painting of metal doors'] }, s2: { porEtapa: { '08 51 13': 34100, '08 11 13': 18800 }, dias: 21, excl: [] } },
    pergunta: { de: 's1', texto: 'Are the door frames furnished by the owner or by the contractor?', resposta: 'Frames are furnished by the contractor; hardware is by the owner.' } },
  { gc: 'gc2', obra: 'Seacoast Library Addition', servico: 'Exterior trim and millwork', etapas: ['06 20 00'], incluso: ['Cornice, rakes and fascia', 'Window and door casings', 'Primed cellular PVC trim'], excluso: ['Painting'],
    obs: 'Coordinate with the roofer on drip edge before trim goes up.', dias: 9, convites: ['s2', 's1'], mostrar: 'total', estado: 'fechada', vencedora: 's2',
    propostas: { s2: { porEtapa: { '06 20 00': 26400 }, dias: 14, excl: [] }, s1: { porEtapa: { '06 20 00': 28950 }, dias: 16, excl: ['Scaffold rental'] } } },
  { gc: 'gc3', obra: 'Oak Hollow Residences', servico: 'Gutters and downspouts', etapas: ['07 71 23'], incluso: ['Seamless aluminum gutters', 'Downspouts and boots', 'Splash blocks'], excluso: ['Underground drainage'],
    obs: '', dias: 1, convites: ['s4', 's6'], mostrar: 'nao', estado: 'aberta', recusa: { de: 's6', motivo: 'Outside our scope of work.' }, propostas: {} },
  { gc: 'gc1', obra: 'Elm Street Townhomes', servico: 'Final cleaning', etapas: ['01 74 23'], incluso: ['Construction final clean, all units'], excluso: [], obs: '', dias: 20, convites: ['s5', 's6'], mostrar: 'nao', estado: 'rascunho', propostas: {} },
];
async function concorrencias() {
  console.log('\nConcorrências: aberta com propostas, fechada com vencedora, aguardando respostas e rascunho');
  for (const c of CONCORRENCIAS) {
    const gc = E[c.gc], admin = gc.pessoas.admin;
    const ja = await rest(admin.id, '/concorrencias?select=id&servico=eq.' + encodeURIComponent(c.servico));
    if (ja.length) { console.log('  ' + c.servico + ': já existe, pulei'); continue; }
    const obraId = gc.obrasPorNome[c.obra];
    const prazo = new Date(Date.now() + c.dias * 86400000).toISOString();
    const [conc] = await rest(admin.id, '/concorrencias', { metodo: 'POST', corpo: { obra_id: obraId, servico: c.servico, etapas: c.etapas, incluso: c.incluso, excluso: c.excluso, observacoes: c.obs, prazo, quarteirizacao: 'com-aprovacao', orcamento: { mostrar: c.mostrar, ...(c.mostrar === 'total' ? { valor: 30000 } : {}) } } });
    const convites = {};
    const contatos = await rest(admin.id, '/contatos?select=id,nome');
    for (const k of c.convites) {
      const sub = E[k];
      let ct = contatos.find((x) => x.nome === sub.nome);
      if (!ct) [ct] = await rest(admin.id, '/contatos', { metodo: 'POST', corpo: { nome: sub.nome, papeis: ['prestadora'], email: 'office@' + sub.chave + '.example.com', telefone: sub.tel, cidade: sub.cidade, estado: sub.estado } });
      await sqlExec(`update public.contatos set conta_empresa_id = '${sub.id}' where id = '${ct.id}' and conta_empresa_id is null`);
      const [cv] = await rest(admin.id, '/concorrencia_convites', { metodo: 'POST', corpo: { concorrencia_id: conc.id, contato_id: ct.id } });
      convites[k] = cv.id;
    }
    if (c.estado === 'rascunho') { console.log('  ' + c.servico + ' (' + gc.nome + '): rascunho com ' + c.convites.length + ' convidadas'); continue; }
    await rpc(admin.id, 'enviar_concorrencia', { p_id: conc.id });
    for (const k of c.convites) {
      const sub = E[k], subAdmin = sub.pessoas.admin;
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
    if (c.estado === 'fechada') await rpc(admin.id, 'fechar_concorrencia', { p_id: conc.id, p_convite: convites[c.vencedora], p_observacao: 'Best price and the shortest schedule.' });
    console.log('  ' + c.servico + ' (' + gc.nome + '): ' + c.estado + (c.vencedora ? ', vencedora ' + E[c.vencedora].nome : ''));
  }
}

// ---------------------------------------------------------------- horários do passado (só a massa de demonstração)
/* As funções do banco gravam "agora" em tudo (envio, aprovação). Numa massa que quer parecer 3 semanas de uso, todo diário antigo
 * ficaria "enviado hoje, fora do prazo". Este passo, FEITO SÓ NAS EMPRESAS DE DEMONSTRAÇÃO (plano.demo), acerta os horários para o dia certo
 * (envio no fim da tarde do próprio dia, aprovação na manhã seguinte; uns poucos atrasados de propósito) e REFAZ o selo (hash e código) de
 * cada diário aprovado com a mesma conta da função aprovar_rdo, então a verificação do lacre continua passando.
 * Para isso desliga, dentro de UMA transação, as travas que impedem mexer em diário lacrado, e religa no fim. Por isso só roda quando pedido
 * (--fase=retroagir) e o SQL está aqui, à vista. */
const SQL_RETROAGIR = `
begin;
alter table public.rdos disable trigger rdos_guarda;
alter table public.rdo_historico disable trigger rdo_historico_guarda;
create temp table _demo_rdos on commit drop as
  select r.id, r.data, ((hashtext(r.id::text) & 2147483647) % 100) as sorte
    from public.rdos r join public.empresas e on e.id = r.empresa_id where e.plano ->> 'demo' = 'true' and r.status <> 'rascunho';
update public.rdos r set
  criado_em = ((a.data + time '07:20') at time zone 'America/New_York'), criado_no_aparelho_em = ((a.data + time '07:20') at time zone 'America/New_York'),
  primeiro_envio_em = x.env, enviado_em = x.env
  from _demo_rdos a cross join lateral (select (((a.data + time '16:35') + make_interval(mins => a.sorte % 75)) at time zone 'America/New_York') + case when a.sorte >= 94 then interval '15 hours' else interval '0' end as env) x
 where r.id = a.id;
update public.rdos r set aprovado_em = greatest(r.enviado_em + interval '14 hours',
    ((r.data + case extract(dow from r.data)::int when 5 then 3 when 6 then 2 else 1 end) + time '08:10' + make_interval(mins => (hashtext(r.id::text) & 2147483647) % 90)) at time zone 'America/New_York')
 where r.id in (select id from _demo_rdos) and r.status = 'aprovado';
update public.rdos r set hash_documento = h.v, codigo = upper(substr(h.v, 1, 4) || '-' || substr(h.v, 5, 4) || '-' || substr(h.v, 9, 4))
  from (select rr.id, encode(extensions.digest(public.texto_do_lacre(rr), 'sha256'), 'hex') as v from public.rdos rr where rr.id in (select id from _demo_rdos) and rr.status = 'aprovado') h
 where r.id = h.id;
update public.rdo_historico h set em = r.enviado_em from public.rdos r where h.rdo_id = r.id and r.id in (select id from _demo_rdos) and h.acao = 'Enviou para aprovação';
update public.rdo_historico h set em = r.aprovado_em, acao = 'Aprovou · código ' || r.codigo || coalesce(substring(h.acao from ' \\(.*\\)$'), '')
  from public.rdos r where h.rdo_id = r.id and r.id in (select id from _demo_rdos) and h.acao like 'Aprovou · código %' and r.status = 'aprovado';
update public.rdo_historico h set em = r.enviado_em + interval '17 hours' from public.rdos r where h.rdo_id = r.id and r.id in (select id from _demo_rdos) and h.acao like 'Pediu ajustes%';
alter table public.rdos enable trigger rdos_guarda;
alter table public.rdo_historico enable trigger rdo_historico_guarda;
commit;
`;
async function retroagir() {
  console.log('\nHorários do passado nos diários de demonstração (selo refeito)');
  await sqlExec(SQL_RETROAGIR);
  const r = await sql(`select count(*)::int as aprovados, count(*) filter (where public.lacre_confere(r.id))::int as conferem from public.rdos r join public.empresas e on e.id = r.empresa_id where e.plano ->> 'demo' = 'true' and r.status = 'aprovado'`);
  console.log('  diários aprovados: ' + r[0].aprovados + ' · lacre confere: ' + r[0].conferem);
  const t = await sql(`select count(*)::int n from pg_trigger where tgname in ('rdos_guarda', 'rdo_historico_guarda') and tgenabled = 'O'`);
  console.log('  travas ligadas de novo: ' + t[0].n + ' de 2');
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

/* Empresa suspensa não grava (é o que a administração faz): para completar a massa numa conta que já passou pela fase "planos",
 * libera as suspensas antes e a fase "planos" roda de novo no fim para suspender como antes. */
const gravando = FASES.some((f) => f !== 'planos');
if (gravando) await sqlExec(`update public.empresas set plano = jsonb_set(plano, '{status}', '"ativa"') where plano ->> 'demo' = 'true' and plano ->> 'status' = 'suspensa'`);
if (gravando && !FASES.includes('planos')) FASES.push('planos');
for (const f of ['estrutura', 'ponto', 'diarios', 'cronograma', 'concorrencias', 'retroagir', 'planos']) {
  if (!FASES.includes(f)) continue;
  if (f === 'estrutura') await estrutura(); else if (!E.gc1) await estrutura();
  if (f === 'ponto') await ponto();
  if (f === 'diarios') await diarios();
  if (f === 'cronograma') await cronograma();
  if (f === 'concorrencias') await concorrencias();
  if (f === 'retroagir') await retroagir();
  if (f === 'planos') await planos();
}
console.log('\nPronto. Logins: demo.<empresa>.<papel>@example.com (admin, gestor, encarregado, trabalhador); a senha é a de ' + SENHA_VARIAVEL + '.');
