// KORbuild — uma rodada de envio (docs/banco.md §15): a fila de quem não tem conta e os avisos agrupados de quem tem.
// Não conhece Supabase nem SMTP: recebe o que precisa (dependências) e por isso roda igual na função de borda e no teste.
// Regra de ouro: nada é marcado como enviado sem o SMTP ter aceitado a mensagem; se falhar, fica para a próxima rodada.

import { montarAvisos, montarFila } from './modelos.ts';
import type { Destinatario, ItemFila, Mensagem } from './modelos.ts';

export interface PatchFila { enviado_em?: string; dados?: Record<string, unknown>; tentativas?: number; erro?: string | null }
export interface Dependencias {
  site: string;
  lerFila(limite: number): Promise<ItemFila[]>;
  marcarFila(id: number, patch: PatchFila): Promise<void>;
  lerAvisos(limite: number): Promise<Destinatario[]>;
  marcarAvisos(ids: number[]): Promise<number>;
  enviar(m: Mensagem): Promise<void>;
  agora?: () => Date;
}
export interface Resultado { fila: { enviados: number; erros: number }; avisos: { usuarios: number; avisos: number; erros: number }; erros: string[] }

/** As opções do nodemailer a partir dos segredos (porta 465 = TLS direto; as outras sobem para STARTTLS, que é exigido).
 *  SMTP_TLS = 'nao' desliga o TLS: só para o teste local com um servidor de mentira; nunca no projeto. */
export function opcoesSmtp(env: Record<string, string | undefined>) {
  const porta = Number(env.SMTP_PORT || 587);
  const semTls = env.SMTP_TLS === 'nao';
  return {
    host: env.SMTP_HOST, port: porta, secure: !semTls && porta === 465, requireTLS: !semTls && porta !== 465 && porta !== 25, ignoreTLS: semTls,
    ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS || '' } } : {}),
    connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000,
  };
}
export const faltamSegredos = (env: Record<string, string | undefined>): string[] => ['SMTP_HOST', 'SMTP_PORT', 'EMAIL_FROM'].filter((k) => !env[k]);

const mensagemDoErro = (e: unknown): string => String((e as Error)?.message || e).slice(0, 300);

export async function rodar(d: Dependencias, limites = { fila: 50, avisos: 50 }): Promise<Resultado> {
  const r: Resultado = { fila: { enviados: 0, erros: 0 }, avisos: { usuarios: 0, avisos: 0, erros: 0 }, erros: [] };
  const agora = d.agora || (() => new Date());

  for (const item of await d.lerFila(limites.fila)) {
    try {
      const m = montarFila(item, d.site);
      await d.enviar(m);
      // enviado: o token do link não precisa mais ficar guardado (o registro do envio fica)
      const dados = { ...item.dados }; delete dados.token;
      await d.marcarFila(item.id, { enviado_em: agora().toISOString(), dados, tentativas: item.tentativas + 1, erro: null });
      r.fila.enviados++;
    } catch (e) {
      r.fila.erros++; r.erros.push('fila ' + item.id + ': ' + mensagemDoErro(e));
      await d.marcarFila(item.id, { tentativas: item.tentativas + 1, erro: mensagemDoErro(e) }).catch(() => {});
    }
  }

  for (const dest of await d.lerAvisos(limites.avisos)) {
    try {
      await d.enviar(montarAvisos(dest, d.site));
      await d.marcarAvisos(dest.avisos.map((a) => a.id));
      r.avisos.usuarios++; r.avisos.avisos += dest.avisos.length;
    } catch (e) {
      r.avisos.erros++; r.erros.push('avisos de ' + dest.user_id + ': ' + mensagemDoErro(e));
    }
  }
  return r;
}
