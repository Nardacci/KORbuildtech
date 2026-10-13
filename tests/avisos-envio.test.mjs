/* KORbuild — o envio de e-mails (fatia 8b; docs/banco.md §15): a função de borda enviar-avisos, sem a rede de e-mail de verdade.
 *   1. Os modelos (supabase/functions/enviar-avisos/modelos.ts): os dois idiomas, o link certo, tudo escapado.
 *   2. Uma rodada (rodar.ts) contra o banco: a fila de quem não tem conta e os avisos agrupados de quem tem, lidos e marcados
 *      com a chave de serviço (as funções avisos_pendentes_email / marcar_avisos_enviados e a tabela fila_email); nada é marcado
 *      como enviado quando o envio falha; o token sai da fila depois de enviado; quem tem 5 tentativas não volta.
 *   3. O SMTP de verdade (nodemailer) contra um servidor de mentira na porta local (pulado se o nodemailer não estiver instalado:
 *      npm install --no-save nodemailer@6.9.16).
 * Duas formas de rodar: --local (padrão; tools/supabase-local.sh) ou --real (Supabase do projeto; só mexe nos usuários e nos
 * avisos do próprio teste: os de outras pessoas são filtrados e nunca marcados). Nenhum e-mail real sai em nenhum dos dois.
 * Uso: node tests/avisos-envio.test.mjs [--real] */

import net from 'node:net';

const REAL = process.argv.includes('--real');
const { sql, sqlExec, rest, criarUsuario, servicoRest, limpar, nome } = await import(REAL ? './_supabase-real.mjs' : './_supabase-local.mjs');
const modelos = await import('../supabase/functions/enviar-avisos/modelos.ts');
const { rodar, opcoesSmtp, faltamSegredos } = await import('../supabase/functions/enviar-avisos/rodar.ts');
console.log('Envio de e-mails contra: ' + nome);
let falhas = 0, passos = 0;
function verificar(cond, texto, detalhe) {
  passos++;
  if (cond) console.log('  ok  ' + texto);
  else { falhas++; console.log('FALHA ' + texto + (detalhe !== undefined ? '\n      encontrado: ' + (typeof detalhe === 'string' ? detalhe : JSON.stringify(detalhe)) : '')); }
}
const SITE = 'https://exemplo.test/app/';

try {
  // ---------- 1. Os modelos ----------
  console.log('Modelos');
  const aviso = { id: 1, categoria: 'daily', titulo: 'RDO nº 3 de Obra X aguardando aprovação', chave: 'RDO nº {numero} de {obra} aguardando aprovação', dados: { numero: 3, obra: 'Obra <b>X</b>' }, texto: null, link: '#/daily/painel/rdo/abc', criado_em: '2026-10-13T10:00:00Z' };
  const pt = modelos.montarAvisos({ user_id: 'u', email: 'ana@example.com', nome: 'Ana', idioma: 'pt', avisos: [aviso] }, SITE);
  const en = modelos.montarAvisos({ user_id: 'u', email: 'tom@example.com', nome: 'Tom', idioma: 'en', avisos: [aviso] }, SITE);
  verificar(pt.assunto === 'RDO nº 3 de Obra <b>X</b> aguardando aprovação' && en.assunto === 'Daily report #3 for Obra <b>X</b> is waiting for approval', 'o assunto do aviso, nos dois idiomas', [pt.assunto, en.assunto]);
  verificar(pt.html.includes('Olá, Ana,') && en.html.includes('Hi Tom,') && pt.html.includes('lang="pt-BR"') && en.html.includes('lang="en"'), 'saudação e idioma do documento');
  verificar(!pt.html.includes('<b>X</b>') && pt.html.includes('Obra &lt;b&gt;X&lt;/b&gt;'), 'o que vem de fora é escapado no HTML');
  verificar(pt.html.includes('href="https://exemplo.test/app/#/daily/painel/rdo/abc"') && pt.texto.includes('https://exemplo.test/app/#/daily/painel/rdo/abc'), 'o botão leva à tela do aviso (HTML e texto simples)');
  verificar(modelos.enderecoDoApp('https://x.test', '#/a') === 'https://x.test/#/a' && modelos.enderecoDoApp('https://x.test/', '#/a') === 'https://x.test/#/a', 'o endereço aceita o site com ou sem a barra');
  const dois = modelos.montarAvisos({ user_id: 'u', email: 'a@example.com', nome: '', idioma: 'xx', avisos: [aviso, { ...aviso, id: 2, chave: 'Prazo prorrogado: {servico}', dados: { servico: 'Framing' }, titulo: 'Prazo prorrogado: Framing', link: '#/measure/convite/c1', texto: 'novo prazo' }] }, SITE);
  verificar(dois.assunto === '2 new notices on KORbuild' && dois.html.includes('Bid deadline extended: Framing') && dois.html.includes('novo prazo') && dois.html.includes('Hi,'), 'vários avisos: um e-mail só, inglês quando o idioma é desconhecido', dois.assunto);
  const semChave = modelos.montarAvisos({ user_id: 'u', email: 'a@example.com', nome: 'A', idioma: 'en', avisos: [{ ...aviso, chave: 'Texto que ainda não tem tradução', dados: {}, titulo: 'Texto que ainda não tem tradução' }] }, SITE);
  verificar(semChave.assunto === 'Texto que ainda não tem tradução', 'chave sem tradução: vale o título que o banco gravou');
  const iu = { id: 1, para_email: 'jose@example.com', para_nome: 'José', idioma: 'pt', modelo: 'convite-usuario', dados: { token: 'a'.repeat(48), empresa: 'Prestadora A', perfil: 'Encarregado', por: 'Ana' }, tentativas: 0 };
  const m1 = modelos.montarFila(iu, SITE), m2 = modelos.montarFila({ ...iu, idioma: 'en' }, SITE);
  verificar(m1.assunto === 'Ana convidou você para o KORbuild' && m2.assunto === 'Ana invited you to KORbuild' && m1.html.includes('#/aceitar/' + 'a'.repeat(48)) && m1.html.includes('Prestadora A') && m1.html.includes('Encarregado'), 'convite de usuário: assunto, empresa, perfil e o link de aceitar', [m1.assunto, m2.assunto]);
  const ic = { id: 2, para_email: 'bay@example.com', para_nome: 'Bia', idioma: 'en', modelo: 'convite-concorrencia', dados: { token: 'b'.repeat(48), servico: 'Framing e drywall', contratante: 'Construtora B', prazo: '2026-10-18T21:00:00+00:00' }, tentativas: 0 };
  const m3 = modelos.montarFila(ic, SITE), m4 = modelos.montarFila({ ...ic, idioma: 'pt' }, SITE);
  verificar(m3.assunto === 'Invitation to bid: Framing e drywall · Construtora B' && m4.assunto === 'Convite para cotar: Framing e drywall · Construtora B' && m3.html.includes('#/convite/' + 'b'.repeat(48)) && m3.html.includes('New York time') && m3.html.includes('Oct 18, 2026') && m4.html.includes('horário de Nova York'), 'convite de concorrência: assunto, prazo em horário de Nova York e o link pessoal', m3.assunto);
  const evs = ['prazo', 'adendo', 'mensagem', 'cancelada', 'venceu', 'fechada'].map((ev) => modelos.montarFila({ id: 3, para_email: 'bay@example.com', para_nome: '', idioma: 'pt', modelo: 'aviso-link', dados: { evento: ev, servico: 'Siding', contratante: 'Construtora B', texto: 'Folha A-102', prazo: '2026-10-18T21:00:00Z' }, tentativas: 0 }, SITE));
  verificar(evs.every((m) => m.assunto && !m.html.includes('#/convite/') && m.html.includes('Siding') && m.html.includes('link do convite')), 'avisos para quem está pelo link: seis eventos, sem link novo (o token não existe mais)', evs.map((m) => m.assunto));
  verificar(evs[1].html.includes('Folha A-102') && evs[0].html.includes('18 de out.'), 'o texto do adendo e a data do novo prazo entram');
  let erroModelo = null; try { modelos.montarFila({ ...iu, modelo: 'inexistente' }, SITE); } catch (e) { erroModelo = e.message; }
  verificar(erroModelo && /desconhecido/.test(erroModelo), 'modelo desconhecido: erro (não envia nada)');
  verificar(faltamSegredos({}).join() === 'SMTP_HOST,SMTP_PORT,EMAIL_FROM' && faltamSegredos({ SMTP_HOST: 'h', SMTP_PORT: '587', EMAIL_FROM: 'a' }).length === 0, 'sem os segredos de SMTP a função se recusa a rodar');
  const o465 = opcoesSmtp({ SMTP_HOST: 'h', SMTP_PORT: '465', SMTP_USER: 'u', SMTP_PASS: 'p' }), o587 = opcoesSmtp({ SMTP_HOST: 'h', SMTP_PORT: '587' });
  verificar(o465.secure === true && o465.requireTLS === false && o465.auth.user === 'u' && o587.secure === false && o587.requireTLS === true && !o587.auth, 'opções do SMTP: 465 é TLS direto, 587 exige STARTTLS, sem usuário não autentica');

  // ---------- 2. Uma rodada contra o banco ----------
  console.log('Rodada contra o banco');
  const sufixo = Date.now().toString(36);
  await limpar();
  const EMAIL = { ana: 'kb-e2e-daily-ana-' + sufixo + '@example.com', tom: 'kb-e2e-daily-tom-' + sufixo + '@example.com' };
  const ID = { ana: await criarUsuario(EMAIL.ana, 'Ana Local'), tom: await criarUsuario(EMAIL.tom, 'Tom Local') };
  const A = await rest(ID.ana, '/rpc/criar_empresa', { metodo: 'POST', corpo: { p: { nome: 'Prestadora Local ' + sufixo, atuacao: 'prestadora' } } });
  const B = await rest(ID.tom, '/rpc/criar_empresa', { metodo: 'POST', corpo: { p: { nome: 'Construtora Local ' + sufixo, atuacao: 'construtora' } } });
  await sqlExec(`update auth.users set raw_user_meta_data = raw_user_meta_data || '{"idioma":"pt"}'::jsonb where id = '${ID.ana}'`);
  const aviso1 = (user, emp, link, extra = '') => sqlExec(`select public.notificar('${user}', '${emp}', 'daily', 'RDO nº {numero} de {obra} aguardando aprovação', '{"numero":3,"obra":"Obra X"}'::jsonb, '${link}', null, false, true${extra})`);
  await aviso1(ID.ana, A, '#/daily/painel/rdo/1');
  await sqlExec(`select public.notificar('${ID.ana}', '${A}', 'concorrencia', 'Prazo prorrogado: {servico}', '{"servico":"Framing"}'::jsonb, '#/measure/convite/c1', 'novo prazo', false, true)`);
  await aviso1(ID.tom, B, '#/daily/painel/rdo/2');
  await sqlExec(`select public.notificar('${ID.tom}', '${B}', 'crew', 'Sua semana de {semana} foi aprovada', '{"semana":"10/05"}'::jsonb, '#/crew', null, false, false, false)`);   // só sininho: não vai por e-mail
  const fila = (modelo, para, dados, idioma = 'pt') => sqlExec(`insert into public.fila_email (empresa_id, para_email, para_nome, idioma, modelo, dados) values ('${A}', '${para}', 'Fulano', '${idioma}', '${modelo}', '${JSON.stringify(dados).replace(/'/g, "''")}'::jsonb)`);
  await fila('convite-usuario', EMAIL.ana, { token: 'c'.repeat(48), empresa: 'Prestadora A', perfil: 'Gestor de obras', por: 'Ana' });
  await fila('convite-concorrencia', EMAIL.tom, { token: 'd'.repeat(48), servico: 'Framing', contratante: 'Construtora B', prazo: '2026-10-18T21:00:00Z' }, 'en');
  await fila('aviso-link', EMAIL.tom, { evento: 'adendo', servico: 'Framing', contratante: 'Construtora B', texto: 'Folha A-102' }, 'en');

  const ehDoTeste = (e) => /^kb-e2e-daily-.*@example\.com$/.test(e);   // no banco de verdade, nunca mexe no que é de outras pessoas
  const enviadas = []; let falha = null;
  const dependencias = {
    site: SITE,
    async lerFila(limite) { return (await servicoRest('/fila_email?select=id,para_email,para_nome,idioma,modelo,dados,tentativas&enviado_em=is.null&tentativas=lt.5&order=id&limit=' + limite)).filter((x) => ehDoTeste(x.para_email)); },
    async marcarFila(id, patch) { await servicoRest('/fila_email?id=eq.' + id, { metodo: 'PATCH', corpo: patch }); },
    async lerAvisos(limite) { return (await servicoRest('/rpc/avisos_pendentes_email', { metodo: 'POST', corpo: { p_limite: limite, p_espera_min: 3 } })).filter((x) => ehDoTeste(x.email)); },
    async marcarAvisos(ids) { return servicoRest('/rpc/marcar_avisos_enviados', { metodo: 'POST', corpo: { p_ids: ids } }); },
    async enviar(m) { if (falha) throw new Error(falha); enviadas.push(m); },
  };
  const r1 = await rodar(dependencias);
  verificar(r1.fila.enviados === 3 && r1.fila.erros === 0 && r1.avisos.usuarios === 2 && r1.avisos.avisos === 3 && r1.avisos.erros === 0, 'a primeira rodada: 3 da fila e 2 usuários com 3 avisos', r1);
  const paraAna = enviadas.filter((m) => m.para === EMAIL.ana), paraTom = enviadas.filter((m) => m.para === EMAIL.tom);
  verificar(paraAna.length === 2 && paraTom.length === 3, 'cada um recebeu os seus: Ana 2 e-mails (convite de usuário e avisos), Tom 3 (dois da fila e os avisos)', [paraAna.length, paraTom.length]);
  verificar(paraAna.some((m) => m.assunto === '2 novos avisos no KORbuild') && paraTom.some((m) => m.assunto === 'Daily report #3 for Obra X is waiting for approval'), 'o aviso agrupado sai no idioma de cada um (pt e en) e só com o que vai por e-mail');
  verificar(paraAna.some((m) => m.assunto === 'Ana convidou você para o KORbuild') && paraTom.some((m) => m.assunto === 'Invitation to bid: Framing · Construtora B') && paraTom.some((m) => m.assunto === 'Notice about Framing'), 'a fila saiu: convite de usuário, convite de concorrência e o adendo');
  const linhas = await sql(`select modelo, enviado_em is not null as enviado, dados ? 'token' as tem_token, tentativas, erro from public.fila_email where para_email in ('${EMAIL.ana}', '${EMAIL.tom}') order by id`);
  verificar(linhas.length === 3 && linhas.every((l) => l.enviado && !l.tem_token && l.tentativas === 1 && l.erro === null), 'fila marcada como enviada, sem o token, 1 tentativa', linhas);
  const pend = await sql(`select categoria, email_em is not null as marcado from public.notificacoes where empresa_id in ('${A}', '${B}') order by id`);
  verificar(pend.length === 4 && pend.every((p) => p.marcado), 'os avisos foram marcados como enviados (inclusive o só-sininho, que já nasceu marcado)', pend);
  const antes = enviadas.length;
  const r2 = await rodar(dependencias);
  verificar(r2.fila.enviados === 0 && r2.avisos.usuarios === 0 && enviadas.length === antes, 'a segunda rodada não repete nada');

  // falha no envio: nada é marcado, tenta de novo na rodada seguinte
  await aviso1(ID.ana, A, '#/daily/painel/rdo/9');
  await fila('convite-usuario', EMAIL.ana, { token: 'e'.repeat(48), empresa: 'Prestadora A', perfil: 'Gestor de obras', por: 'Ana' });
  falha = 'SMTP fora do ar';
  const r3 = await rodar(dependencias);
  verificar(r3.fila.erros === 1 && r3.avisos.erros === 1 && r3.fila.enviados === 0 && r3.avisos.usuarios === 0, 'com o SMTP fora do ar: dois erros, nada enviado', r3);
  const f3 = (await sql(`select enviado_em is null as pendente, tentativas, erro, dados ? 'token' as tem_token from public.fila_email where para_email = '${EMAIL.ana}' and tentativas > 0 and enviado_em is null`));
  const n3 = await sql(`select email_em is null as pendente from public.notificacoes where user_id = '${ID.ana}' and link = '#/daily/painel/rdo/9'`);
  verificar(f3.length === 1 && f3[0].tentativas === 1 && /SMTP fora do ar/.test(f3[0].erro) && f3[0].tem_token && n3.length === 1 && n3[0].pendente, 'a fila guarda o erro e o token; o aviso continua pendente', [f3, n3]);
  falha = null;
  const r4 = await rodar(dependencias);
  verificar(r4.fila.enviados === 1 && r4.avisos.usuarios === 1 && r4.erros.length === 0, 'voltando o SMTP, a rodada seguinte envia os dois', r4);

  // cinco tentativas e para
  await fila('convite-usuario', EMAIL.ana, { token: 'f'.repeat(48), empresa: 'P', perfil: 'G', por: 'A' });
  await sqlExec(`update public.fila_email set tentativas = 5, erro = 'x' where para_email = '${EMAIL.ana}' and enviado_em is null`);
  const r5 = await rodar(dependencias);
  verificar(r5.fila.enviados === 0 && r5.fila.erros === 0, 'item com 5 tentativas não é lido de novo');

  // a chave de serviço é a única que lê e marca; o app não
  let negado = false;
  try { await rest(ID.ana, '/rpc/avisos_pendentes_email', { metodo: 'POST', corpo: {} }); } catch (e) { negado = /42501|permission denied|401|403/i.test(e.message); }
  let negado2 = false;
  try { await rest(ID.ana, '/fila_email?select=id'); } catch (e) { negado2 = /42501|permission denied|401|403/i.test(e.message); }
  verificar(negado && negado2, 'o app (usuário logado) não lê os e-mails pendentes nem a fila');

  // ---------- 3. O SMTP de verdade (nodemailer) contra um servidor de mentira ----------
  console.log('SMTP (nodemailer)');
  const nodemailer = await import('nodemailer').then((m) => m.default || m).catch(() => null);
  if (!nodemailer) console.log('  --  pulado: instale com  npm install --no-save nodemailer@6.9.16');
  else {
    const recebidas = [];
    const servidor = net.createServer((s) => {
      let buf = '', emDados = false, de = '', para = [];
      s.write('220 sink ESMTP\r\n');
      s.on('data', (c) => {
        buf += c.toString('utf8');
        for (;;) {
          if (emDados) {
            const fim = buf.indexOf('\r\n.\r\n');
            if (fim < 0) break;
            recebidas.push({ de, para: [...para], corpo: buf.slice(0, fim) }); buf = buf.slice(fim + 5); emDados = false; s.write('250 ok\r\n'); continue;
          }
          const i = buf.indexOf('\r\n');
          if (i < 0) break;
          const linha = buf.slice(0, i); buf = buf.slice(i + 2);
          const c2 = linha.toUpperCase();
          if (c2.startsWith('EHLO') || c2.startsWith('HELO')) s.write('250-sink\r\n250 8BITMIME\r\n');
          else if (c2.startsWith('MAIL FROM')) { de = linha; para = []; s.write('250 ok\r\n'); }
          else if (c2.startsWith('RCPT TO')) { para.push(linha); s.write('250 ok\r\n'); }
          else if (c2 === 'DATA') { emDados = true; s.write('354 go\r\n'); }
          else if (c2 === 'QUIT') { s.write('221 bye\r\n'); s.end(); }
          else s.write('250 ok\r\n');
        }
      });
    });
    await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
    const porta = servidor.address().port;
    const env = { SMTP_HOST: '127.0.0.1', SMTP_PORT: String(porta), SMTP_TLS: 'nao', EMAIL_FROM: 'KORbuild <no-reply@korbuildtech.com>' };
    const transporte = nodemailer.createTransport(opcoesSmtp(env));
    await sqlExec(`update public.fila_email set enviado_em = now() where para_email = '${EMAIL.ana}' and enviado_em is null`);   // o item travado da fase anterior sai do caminho
    await fila('convite-usuario', EMAIL.ana, { token: '1'.repeat(48), empresa: 'Prestadora A', perfil: 'Gestor de obras', por: 'Ana' });
    const comSmtp = { ...dependencias, async enviar(m) { await transporte.sendMail({ from: env.EMAIL_FROM, to: m.para, subject: m.assunto, html: m.html, text: m.texto, headers: { 'Auto-Submitted': 'auto-generated' } }); } };
    const r6 = await rodar(comSmtp);
    const qp = (t) => t.replace(/=\r\n/g, '').replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
    verificar(r6.fila.enviados === 1 && recebidas.length === 1, 'o nodemailer entregou a mensagem ao servidor SMTP', [r6, recebidas.length]);
    const corpo = recebidas[0] ? qp(recebidas[0].corpo) : '';
    verificar(/From: .*no-reply@korbuildtech\.com/.test(corpo) && /To: .*kb-e2e-daily-ana/.test(corpo) && /Auto-Submitted: auto-generated/.test(corpo) && /multipart\/alternative/.test(corpo) && corpo.includes('text/plain') && corpo.includes('text/html') && corpo.includes('#/aceitar/' + '1'.repeat(48)), 'remetente definitivo, destinatário, partes texto e HTML e o link de aceitar', corpo.slice(0, 400));
    const sem = await sql(`select dados ? 'token' as tem from public.fila_email where para_email = '${EMAIL.ana}' and enviado_em is not null order by id desc limit 1`);
    verificar(sem[0] && !sem[0].tem, 'depois do envio pelo SMTP o token saiu da fila');
    await new Promise((ok) => servidor.close(ok));
  }
} catch (e) {
  falhas++;
  console.log('FALHA inesperada: ' + (e && e.stack ? e.stack.split('\n').slice(0, 5).join(' | ') : e));
} finally {
  await limpar();
  if (REAL) {
    const resto = await sql(`select (select count(*) from public.fila_email where para_email like 'kb-e2e-daily-%')::int f, (select count(*) from public.empresas where nome like '%Local %')::int e`);
    verificar(resto[0].f === 0, 'a fila de teste foi apagada junto com as empresas', resto[0]);
  }
}
console.log('\n' + (passos - falhas) + '/' + passos + ' verificações passaram');
process.exit(falhas ? 1 : 0);
