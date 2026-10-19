/* KORbuild — o diagnóstico do caminho dos e-mails (docs/banco.md §15), SÓ LEITURA, contra o Supabase do projeto.
 * O caminho: o app/banco grava na fila (fila_email: convite de concorrência para quem não tem conta, convite de usuário, aviso do link) e em notificacoes
 * (quem tem conta) → o job kor-enviar-avisos (pg_cron, a cada 5 min) chama a função de borda enviar-avisos → SMTP. Este script mostra onde parou:
 *   1. a função está publicada? 2. os segredos de SMTP existem (só os NOMES)? 3. o job existe e roda? 4. a fila anda (pendentes, enviados, erros)?
 * Uso (PowerShell, com SUPABASE_ACCESS_TOKEN no ambiente): node tools/diagnostico-email.mjs
 * Nunca imprime segredos nem e-mails inteiros (mostra "ab***@dominio"). Não grava nada. */

import { readFileSync } from 'node:fs';

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!TOKEN) { console.error('Defina SUPABASE_ACCESS_TOKEN no ambiente (nunca em arquivo).'); process.exit(2); }
const URL_SB = readFileSync(new URL('../js/config.js', import.meta.url), 'utf8').match(/SUPABASE_URL\s*=\s*'([^']+)'/)[1];
const REF = process.env.SUPABASE_PROJECT_REF || new URL(URL_SB).hostname.split('.')[0];
const API = 'https://api.supabase.com/v1/projects/' + REF;
const cab = { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' };
const mascara = (e) => String(e || '').replace(/^(.{1,2})[^@]*@/, '$1***@');

async function sql(consulta) {
  if (!/^\s*(select|with)\b/i.test(consulta)) throw new Error('só consultas de leitura');
  const r = await fetch(API + '/database/query', { method: 'POST', headers: cab, body: JSON.stringify({ query: consulta }) });
  const t = await r.text();
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + t.slice(0, 200));
  return JSON.parse(t);
}
async function passo(titulo, fn) {
  console.log('\n' + titulo);
  try { await fn(); } catch (e) { console.log('  indisponível: ' + String(e.message).slice(0, 220)); }
}
const tabela = (linhas) => { if (!linhas.length) console.log('  (nada)'); for (const l of linhas) console.log('  ' + Object.values(l).map((v) => (v == null ? '—' : String(v))).join(' · ')); };

console.log('Diagnóstico dos e-mails — projeto ' + REF);

await passo('1. A função enviar-avisos está publicada?', async () => {
  const r = await fetch(API + '/functions', { headers: cab });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const fs = (await r.json()).filter((f) => /avis|convite|diario/i.test(f.slug));
  tabela(fs.map((f) => ({ funcao: f.slug, situacao: f.status, versao: f.version, atualizada: f.updated_at ? new Date(f.updated_at).toISOString() : '' })));
  if (!fs.some((f) => f.slug === 'enviar-avisos')) console.log('  >> enviar-avisos NÃO está publicada: nenhum e-mail pode sair. (supabase functions deploy enviar-avisos --no-verify-jwt)');
});

await passo('2. Os segredos da função existem? (só os nomes)', async () => {
  const r = await fetch(API + '/secrets', { headers: cab });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const nomes = (await r.json()).map((s) => s.name);
  for (const n of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM', 'SITE_URL', 'CRON_SECRET']) console.log('  ' + (nomes.includes(n) ? 'ok      ' : 'FALTA   ') + n);
});

await passo('3. O job que chama a função (pg_cron) e as últimas execuções', async () => {
  tabela(await sql("select jobid, jobname, schedule, active from cron.job where jobname like 'kor-%' order by jobname"));
  console.log('  últimas execuções:');
  tabela(await sql("select j.jobname, d.status, to_char(d.start_time, 'MM-DD HH24:MI') as inicio, left(coalesce(d.return_message, ''), 120) as mensagem from cron.job_run_details d join cron.job j on j.jobid = d.jobid where j.jobname = 'kor-enviar-avisos' order by d.start_time desc limit 8"));
});

await passo('4. As respostas HTTP que a função devolveu ao job (pg_net)', async () => {
  tabela(await sql("select id, status_code, to_char(created, 'MM-DD HH24:MI') as quando, left(coalesce(content, error_msg, ''), 140) as resposta from net._http_response order by created desc limit 8"));
  console.log('  (200 = rodou; 401 = o segredo do job não bate com o CRON_SECRET; 503 = faltam os segredos de SMTP)');
});

await passo('5. O segredo do job no Vault (só o nome)', async () => {
  tabela(await sql("select name from vault.secrets where name like 'kor_%' order by name"));
});

await passo('6. A fila de e-mails de quem não tem conta (fila_email)', async () => {
  tabela(await sql("select modelo, count(*) filter (where enviado_em is null) as pendentes, count(*) filter (where enviado_em is not null) as enviados, coalesce(max(tentativas), 0) as max_tentativas, to_char(min(criado_em) filter (where enviado_em is null), 'MM-DD HH24:MI') as pendente_mais_antigo from public.fila_email group by modelo order by modelo"));
  console.log('  as 10 mais recentes:');
  const l = await sql("select id, modelo, para_email, to_char(criado_em, 'MM-DD HH24:MI') as criado, to_char(enviado_em, 'MM-DD HH24:MI') as enviado, tentativas, left(coalesce(erro, ''), 140) as erro from public.fila_email order by id desc limit 10");
  tabela(l.map((x) => ({ ...x, para_email: mascara(x.para_email) })));
});

await passo('7. As concorrências mais recentes: foram enviadas? (e-mail só sai de concorrência ENVIADA)', async () => {
  tabela(await sql("select c.servico, c.situacao, to_char(c.enviada_em, 'MM-DD HH24:MI') as enviada_em, (select count(*) from public.concorrencia_convites v where v.concorrencia_id = c.id and v.convidada_id is null) as convidados_sem_conta, (select count(*) from public.concorrencia_convites v where v.concorrencia_id = c.id and v.convidada_id is not null) as com_conta from public.concorrencias c order by c.criada_em desc limit 8"));
});

await passo('8. Os avisos de quem tem conta esperando e-mail (notificacoes)', async () => {
  tabela(await sql("select categoria, count(*) filter (where email_em is null) as sem_email, count(*) as total from public.notificacoes where criado_em > now() - interval '3 days' group by categoria order by categoria"));
});
console.log('\nPronto. Nada foi gravado.');
