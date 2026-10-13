// KORbuild — o envio dos avisos por e-mail (docs/banco.md §15). Chamada pelo job kor-enviar-avisos (pg_cron, a cada 5 minutos).
// Dois trabalhos: (1) a fila de quem ainda não tem conta (convite de usuário, convite de concorrência, avisos do link) e
// (2) os avisos agrupados de quem tem (notificacoes). A lógica está em rodar.ts e modelos.ts (testadas no Node);
// aqui só se liga o Supabase (chave de serviço) e o SMTP. Sem os segredos de SMTP a função responde 503 e NÃO mexe em nada.
//
// Segredos (supabase secrets set): SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM (KORbuild <no-reply@korbuildtech.com>),
// SITE_URL (endereço do app, com a barra no fim) e CRON_SECRET (quem chama). SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY o Supabase já injeta.
// Publicar: supabase functions deploy enviar-avisos --no-verify-jwt   (o job manda o CRON_SECRET, não um JWT)
// Chamar:   POST /functions/v1/enviar-avisos   com o cabeçalho  x-cron-secret: <CRON_SECRET>   (ou  Authorization: Bearer <CRON_SECRET>)

import { createClient } from 'jsr:@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6.9.16';
import { rodar, opcoesSmtp, faltamSegredos } from './rodar.ts';
import type { Dependencias } from './rodar.ts';
import { REMETENTE_PADRAO, SITE_PADRAO } from './modelos.ts';

const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

// compara sem vazar nada pelo tempo
function igual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return resposta({ erro: 'metodo' }, 405);
  const segredo = Deno.env.get('CRON_SECRET') || '';
  const chamada = req.headers.get('x-cron-secret') || (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!igual(chamada, segredo)) return resposta({ erro: 'nao-autorizado' }, 401);

  const env: Record<string, string | undefined> = {
    SMTP_HOST: Deno.env.get('SMTP_HOST'), SMTP_PORT: Deno.env.get('SMTP_PORT'), SMTP_USER: Deno.env.get('SMTP_USER'), SMTP_PASS: Deno.env.get('SMTP_PASS'),
    EMAIL_FROM: Deno.env.get('EMAIL_FROM') || REMETENTE_PADRAO,
  };
  const faltam = faltamSegredos(env);
  if (faltam.length) return resposta({ erro: 'smtp-nao-configurado', faltam }, 503);

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const transporte = nodemailer.createTransport(opcoesSmtp(env));
  const dependencias: Dependencias = {
    site: Deno.env.get('SITE_URL') || SITE_PADRAO,
    async lerFila(limite) {
      const { data, error } = await sb.from('fila_email').select('id, para_email, para_nome, idioma, modelo, dados, tentativas').is('enviado_em', null).lt('tentativas', 5).order('id').limit(limite);
      if (error) throw error;
      return data || [];
    },
    async marcarFila(id, patch) {
      const { error } = await sb.from('fila_email').update(patch).eq('id', id);
      if (error) throw error;
    },
    async lerAvisos(limite) {
      const { data, error } = await sb.rpc('avisos_pendentes_email', { p_limite: limite, p_espera_min: 3 });
      if (error) throw error;
      return data || [];
    },
    async marcarAvisos(ids) {
      const { data, error } = await sb.rpc('marcar_avisos_enviados', { p_ids: ids });
      if (error) throw error;
      return data as number;
    },
    async enviar(m) {
      await transporte.sendMail({
        from: env.EMAIL_FROM, to: m.para, subject: m.assunto, html: m.html, text: m.texto,
        headers: { 'Auto-Submitted': 'auto-generated', 'X-Auto-Response-Suppress': 'All' },
      });
    },
  };
  try {
    return resposta(await rodar(dependencias));
  } catch (e) {
    return resposta({ erro: 'servidor', detalhe: String((e as Error)?.message || e).slice(0, 300) }, 500);
  }
});
