// KORbuild — o link do convite sem conta (docs/banco.md §14.5, CO-07): a prestadora que não tem KORbuild vê o convite,
// responde, pergunta e manda a proposta (PDF) por um link pessoal, sem login. Só esta função fala com o banco por ela,
// com a chave de serviço (variável que o Supabase já injeta), chamando as funções *_por_token, que só o service_role executa.
// Publicar: supabase functions deploy convite-publico --no-verify-jwt
// Uso:  GET  /functions/v1/convite-publico?token=…                 → a visão do convite (marca como visto); desenhos assinados por 1 h
//       POST /functions/v1/convite-publico  {token, acao, dados}    → acao: responder {vai, motivo} · escrever {texto, por} · proposta {total, porEtapa, outros, prazoExecucaoDias, exclusoes}
//            (a proposta com PDF vai em multipart: campos token, acao, dados (JSON) e pdf)

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const TOKEN = /^[0-9a-f]{48}$/;

// 60 chamadas por minuto por token (uma instância; suficiente contra tentativa e erro)
const chamadas = new Map<string, number[]>();
function dentroDoLimite(token: string) {
  const agora = Date.now();
  const lista = (chamadas.get(token) || []).filter((t) => agora - t < 60_000);
  lista.push(agora);
  chamadas.set(token, lista);
  return lista.length <= 60;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  if (req.method === 'GET') {
    const token = (new URL(req.url).searchParams.get('token') || '').trim();
    if (!TOKEN.test(token)) return resposta({ erro: 'token' }, 400);
    if (!dentroDoLimite(token)) return resposta({ erro: 'limite' }, 429);
    await sb.rpc('visto_por_token', { p_token: token });   // "visto" no primeiro acesso; os erros aqui não importam
    const { data: x, error } = await sb.rpc('convite_por_token', { p_token: token });
    if (error) return resposta({ erro: 'servidor' }, 500);
    if (!x) return resposta({ erro: 'nao-encontrado' }, 404);
    // desenhos e os próprios PDFs: caminhos viram links temporários (o caminho em si não sai)
    const desenhos = (x.desenhos || []) as Array<Record<string, unknown>>;
    const propostas = ((x.convite || {}).propostas || []) as Array<Record<string, unknown>>;
    const caminhos = [...desenhos.map((d) => d.path), ...propostas.map((p) => p.pdf)].filter((p): p is string => typeof p === 'string' && p !== '');
    const links = new Map<string, string>();
    if (caminhos.length) {
      const { data: assinados } = await sb.storage.from('concorrencias').createSignedUrls(caminhos, 3600);
      for (const a of assinados || []) if (a.path && a.signedUrl) links.set(a.path, a.signedUrl);
    }
    x.desenhos = desenhos.map(({ path, ...resto }) => ({ ...resto, url: links.get(path as string) || null }));
    x.convite.propostas = propostas.map(({ pdf, ...resto }) => ({ ...resto, pdf: null, pdfUrl: links.get(pdf as string) || null }));
    return resposta(x);
  }

  if (req.method !== 'POST') return resposta({ erro: 'metodo' }, 405);
  let token = '', acao = '', dados: Record<string, unknown> = {}, pdf: File | null = null;
  const tipo = req.headers.get('content-type') || '';
  if (tipo.startsWith('multipart/form-data')) {
    const fd = await req.formData();
    token = String(fd.get('token') || ''); acao = String(fd.get('acao') || '');
    try { dados = JSON.parse(String(fd.get('dados') || '{}')); } catch { dados = {}; }
    const f = fd.get('pdf'); if (f instanceof File) pdf = f;
  } else {
    const corpo = await req.json().catch(() => ({}));
    token = String(corpo.token || ''); acao = String(corpo.acao || ''); dados = corpo.dados || {};
  }
  if (!TOKEN.test(token)) return resposta({ erro: 'token' }, 400);
  if (!dentroDoLimite(token)) return resposta({ erro: 'limite' }, 429);
  // só as mensagens escritas de propósito nas funções do banco (raise exception, código P0001) chegam a quem chamou;
  // erro interno do Postgres (coluna, restrição, tipo) vira "servidor" e fica só no log da função
  const erroDoBanco = (e: { message?: string; code?: string } | null) => {
    if (e && e.code !== 'P0001') console.error('convite-publico', e.code, e.message);
    return resposta({ erro: e && e.code === 'P0001' && e.message ? e.message : 'servidor' }, 400);
  };

  if (acao === 'visto') { const { error } = await sb.rpc('visto_por_token', { p_token: token }); return error ? erroDoBanco(error) : resposta({ ok: true }); }
  if (acao === 'responder') {
    const { error } = await sb.rpc('responder_por_token', { p_token: token, p_vai: !!dados.vai, p_motivo: String(dados.motivo || '') });
    return error ? erroDoBanco(error) : resposta({ ok: true });
  }
  if (acao === 'escrever') {
    const { data, error } = await sb.rpc('escrever_por_token', { p_token: token, p_texto: String(dados.texto || ''), p_por: String(dados.por || '') });
    return error ? erroDoBanco(error) : resposta({ ok: true, id: data });
  }
  if (acao === 'proposta') {
    const p: Record<string, unknown> = { total: dados.total, porEtapa: dados.porEtapa || {}, outros: dados.outros, prazoExecucaoDias: dados.prazoExecucaoDias, exclusoes: dados.exclusoes || [], por: dados.por || '' };
    if (pdf) {
      if (pdf.type && pdf.type !== 'application/pdf') return resposta({ erro: 'Envie a proposta em PDF.' }, 400);
      const { data: x } = await sb.rpc('convite_por_token', { p_token: token });
      if (!x) return resposta({ erro: 'nao-encontrado' }, 404);
      const rev = ((x.convite || {}).propostas || []).length + 1;
      const path = x.contratanteId + '/' + x.id + '/propostas/' + x.convite.id + '/rev-' + rev + '.pdf';
      const up = await sb.storage.from('concorrencias').upload(path, pdf, { contentType: 'application/pdf', upsert: true });
      if (up.error) { console.error('convite-publico: envio do PDF', up.error.message); return resposta({ erro: 'Não foi possível guardar o PDF. Tente de novo.' }, 400); }
      p.pdfPath = path;
    }
    const { data, error } = await sb.rpc('proposta_por_token', { p_token: token, p });
    return error ? erroDoBanco(error) : resposta({ ok: true, rev: data });
  }
  return resposta({ erro: 'acao' }, 400);
});
