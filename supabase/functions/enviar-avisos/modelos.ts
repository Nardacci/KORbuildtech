// KORbuild — os e-mails (docs/banco.md §15.3). Funções puras, sem Deno nem rede: o index.ts liga o Supabase e o SMTP, e
// tests/avisos-envio.test.mjs roda estes módulos no Node. Dois idiomas (pt | en; qualquer outro valor = en), o mesmo layout
// dos e-mails do Auth (tools/gerar-emails.py). Todo texto que vem de fora (nomes, serviço, mensagem) é escapado.

export type Idioma = 'pt' | 'en';
export interface Aviso { id: number; categoria: string; titulo: string; chave: string | null; dados: Record<string, unknown> | null; texto: string | null; link: string | null; criado_em: string }
export interface Destinatario { user_id: string; email: string; nome: string; idioma: Idioma; avisos: Aviso[] }
export interface ItemFila { id: number; para_email: string; para_nome: string; idioma: Idioma; modelo: string; dados: Record<string, unknown>; tentativas: number }
export interface Mensagem { para: string; assunto: string; html: string; texto: string }

export const REMETENTE_PADRAO = 'KORbuild <no-reply@korbuildtech.com>';
export const SITE_PADRAO = 'https://nardacci.github.io/KORbuildtech/';   // homologação; no lançamento, o segredo SITE_URL passa a korbuildtech.com

// Os textos-modelo dos avisos gravados pelo banco (notificacoes.chave) em inglês; em português vale a própria chave.
const EN: Record<string, string> = {
  'RDO nº {numero} de {obra} aguardando aprovação': 'Daily report #{numero} for {obra} is waiting for approval',
  'O escritório pediu ajustes no RDO nº {numero}': 'The office asked for changes on daily report #{numero}',
  'RDO nº {numero} de {obra} aprovado': 'Daily report #{numero} for {obra} was approved',
  'Cronograma publicado por {empresa}: {obra} (versão {versao})': 'Schedule published by {empresa}: {obra} (version {versao})',
  'Sua semana de {semana} foi aprovada': 'Your week of {semana} was approved',
  'Sua semana de {semana} foi devolvida: {motivo}': 'Your week of {semana} was returned: {motivo}',
  '{contratante} quer quarteirizar para {escolhida}: aprove ou recuse': '{contratante} wants to subcontract to {escolhida}: approve or decline',
  'Quarteirização aprovada: {empresa} · {servico}': 'Sub-tier subcontracting approved: {empresa} · {servico}',
  'Quarteirização recusada: {empresa} · {servico}': 'Sub-tier subcontracting declined: {empresa} · {servico}',
  'Convite para cotar: {servico} · {nome}': 'Invitation to bid: {servico} · {nome}',
  'Prazo prorrogado: {servico}': 'Bid due date extended: {servico}',
  'Aviso a todos: {servico}': 'Notice to all bidders: {servico}',
  'Concorrência cancelada: {servico}': 'Bid canceled: {servico}',
  'Você venceu: {servico} · {nome}': 'You were awarded: {servico} · {nome}',
  'Concorrência fechada com outra empresa: {servico}': 'Bid awarded to another company: {servico}',
  '{nome} não vai participar · {servico}': '{nome} will not bid · {servico}',
  'Proposta de {nome} (rev. {rev}) · {servico}': 'Bid from {nome} (rev. {rev}) · {servico}',
  'Mensagem de {nome} · {servico}': 'Message from {nome} · {servico}',
  'Prazo vencido: compare e feche · {servico}': 'Bid due date passed: compare and award · {servico}',
  'O período de teste termina em {dias} dias': 'Your trial ends in {dias} days',
  'O período de teste termina amanhã': 'Your trial ends tomorrow',
  'O plano da sua empresa foi alterado pelo KORbuild': 'Your company\'s plan was changed by KORbuild',
};

const idiomaDe = (i: unknown): Idioma => (i === 'pt' ? 'pt' : 'en');
const esc = (t: unknown): string => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const dizer = (i: Idioma, pt: string, en: string): string => (i === 'pt' ? pt : en);

/** "Olá {campo}" com os valores dos dados; campo que falta fica vazio. */
export function preencher(modelo: string, dados: Record<string, unknown> | null | undefined): string {
  return String(modelo).replace(/\{(\w+)\}/g, (_, k: string) => String((dados || {})[k] ?? ''));
}

/** O título do aviso no idioma da pessoa (a chave traduzida, ou o título já gravado pelo banco). */
export function tituloDoAviso(a: Aviso, idioma: Idioma): string {
  const modelo = idioma === 'en' && a.chave && EN[a.chave] ? EN[a.chave] : (idioma === 'pt' && a.chave ? a.chave : null);
  return modelo ? preencher(modelo, a.dados) : a.titulo;
}

function dataHora(iso: unknown, idioma: Idioma): string {
  const d = new Date(String(iso ?? ''));
  if (Number.isNaN(d.getTime())) return '';
  const fmt = new Intl.DateTimeFormat(idioma === 'pt' ? 'pt-BR' : 'en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/New_York' }).format(d);
  return fmt + dizer(idioma, ' (horário de Nova York)', ' (New York time)');
}

/** O endereço de uma tela do app: o `link` do banco começa por "#/…". */
export function enderecoDoApp(site: string, link: string | null | undefined): string {
  const base = site.endsWith('/') ? site : site + '/';
  return base + String(link ?? '').replace(/^\//, '');
}

// ---------- O layout (o mesmo dos e-mails do Auth) ----------

const GRAFITE = '#141B26', MARCA = '#F26A1B', PRIMARIO = '#C2410C', TEXTO = '#101828', TEXTO_2 = '#344054', MUDO = '#5D6B82', CLARO = '#98A2B3', BORDA = '#E4E7EC', FUNDO = '#F5F6F8';

interface Corpo { idioma: Idioma; assunto: string; previa: string; saudacao: string; paragrafos: string[]; itens?: { titulo: string; texto?: string; url?: string }[]; botao?: { rotulo: string; url: string }; rodape?: string }

function html(c: Corpo): string {
  const i = c.idioma;
  const itens = (c.itens || []).map((x) =>
    `<tr><td style="padding:12px 0; border-top:1px solid ${BORDA};"><p style="margin:0; font-size:15px; line-height:22px; color:${TEXTO}; font-weight:600;">${esc(x.titulo)}</p>` +
    (x.texto ? `<p style="margin:4px 0 0 0; font-size:14px; line-height:21px; color:${TEXTO_2};">${esc(x.texto)}</p>` : '') +
    (x.url ? `<p style="margin:6px 0 0 0; font-size:13px;"><a href="${esc(x.url)}" style="color:${PRIMARIO}; text-decoration:underline;">${esc(dizer(i, 'Abrir no KORbuild', 'Open in KORbuild'))}</a></p>` : '') + '</td></tr>').join('');
  const botao = c.botao
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 28px 0;"><tr><td style="background-color:${PRIMARIO}; border-radius:8px;"><a href="${esc(c.botao.url)}" style="display:inline-block; padding:13px 28px; font-size:15px; font-weight:600; color:#FFFFFF; text-decoration:none;">${esc(c.botao.rotulo)}</a></td></tr></table>`
    : '';
  return `<!DOCTYPE html>
<html lang="${i === 'pt' ? 'pt-BR' : 'en'}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${esc(c.assunto)}</title></head>
<body style="margin:0; padding:0; background-color:${FUNDO}; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">${esc(c.previa)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${FUNDO}; padding:32px 16px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; background-color:#FFFFFF; border-radius:12px; overflow:hidden; border:1px solid ${BORDA};">
<tr><td style="padding:26px 40px; text-align:center; background-color:${GRAFITE};">
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr>
<td style="width:34px; height:34px; background-color:${MARCA}; border-radius:4px 10px 4px 4px; text-align:center; vertical-align:middle; font-size:20px; font-weight:800; color:#FFFFFF; line-height:34px;">K</td>
<td style="padding-left:10px; vertical-align:middle; font-size:22px; line-height:1; color:#FFFFFF; letter-spacing:-0.01em;"><strong style="font-weight:800;">KOR</strong><span style="font-weight:400;">build</span></td>
</tr></table></td></tr>
<tr><td style="padding:36px 40px 12px 40px;">
<p style="margin:0 0 16px 0; font-size:15px; line-height:24px; color:${TEXTO};">${esc(c.saudacao)}</p>
${c.paragrafos.map((p) => `<p style="margin:0 0 16px 0; font-size:15px; line-height:24px; color:${TEXTO_2};">${esc(p)}</p>`).join('\n')}
${itens ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;">${itens}</table>` : ''}
${botao}
</td></tr>
<tr><td style="padding:18px 40px 26px 40px; border-top:1px solid ${BORDA};"><p style="margin:0; font-size:12px; line-height:18px; color:${MUDO};">${esc(c.rodape || dizer(i,
  'Você recebe este e-mail porque tem uma conta, ou foi convidado, no KORbuild. Para escolher quais avisos chegam por e-mail, abra Meu perfil no app.',
  'You are receiving this email because you have a KORbuild account, or were invited to KORbuild. To choose which notices arrive by email, open My profile in the app.'))}</p>
<p style="margin:8px 0 0 0; font-size:12px; color:${CLARO};">${dizer(i, 'Esta mensagem é automática: não responda.', 'This message is automatic: please do not reply.')}</p></td></tr>
</table></td></tr></table>
</body></html>`;
}

function texto(c: Corpo): string {
  const l = [c.saudacao, '', ...c.paragrafos.flatMap((p) => [p, ''])];
  for (const x of c.itens || []) { l.push('• ' + x.titulo); if (x.texto) l.push('  ' + x.texto); if (x.url) l.push('  ' + x.url); }
  if (c.itens?.length) l.push('');
  if (c.botao) l.push(c.botao.rotulo + ': ' + c.botao.url, '');
  l.push(c.rodape || dizer(c.idioma, 'Esta mensagem é automática: não responda. Para escolher quais avisos chegam por e-mail, abra Meu perfil no app.', 'This message is automatic: please do not reply. To choose which notices arrive by email, open My profile in the app.'));
  return l.join('\n');
}

const saudar = (i: Idioma, nome: string): string => (nome ? dizer(i, `Olá, ${nome},`, `Hi ${nome},`) : dizer(i, 'Olá,', 'Hi,'));
const pronto = (para: string, c: Corpo): Mensagem => ({ para, assunto: c.assunto, html: html(c), texto: texto(c) });

// ---------- Os avisos agrupados de um usuário com login ----------

export function montarAvisos(d: Destinatario, site: string): Mensagem {
  const i = idiomaDe(d.idioma);
  const n = d.avisos.length;
  const itens = d.avisos.map((a) => ({ titulo: tituloDoAviso(a, i), texto: a.texto || undefined, url: a.link ? enderecoDoApp(site, a.link) : undefined }));
  const assunto = n === 1 ? itens[0].titulo : dizer(i, `${n} novos avisos no KORbuild`, `${n} new notices on KORbuild`);
  return pronto(d.email, {
    idioma: i, assunto, previa: itens[0].titulo, saudacao: saudar(i, d.nome),
    paragrafos: [n === 1 ? dizer(i, 'Tem um aviso novo para você:', 'You have a new notice:') : dizer(i, `Você tem ${n} avisos novos:`, `You have ${n} new notices:`)],
    itens: n === 1 ? itens.map((x) => ({ ...x, url: undefined })) : itens,
    botao: n === 1 && itens[0].url ? { rotulo: dizer(i, 'Abrir no KORbuild', 'Open in KORbuild'), url: itens[0].url } : undefined,
  });
}

// ---------- A fila: quem ainda não tem conta ----------

const AVISO_LINK: Record<string, [string, string]> = {
  prazo: ['O prazo da proposta de {servico} ({contratante}) foi prorrogado para {prazo}.', 'The bid due date for {servico} ({contratante}) was extended to {prazo}.'],
  adendo: ['{contratante} enviou um aviso sobre {servico}: {texto}', '{contratante} sent a notice about {servico}: {texto}'],
  mensagem: ['{contratante} respondeu na conversa de {servico}: {texto}', '{contratante} replied about {servico}: {texto}'],
  cancelada: ['{contratante} cancelou a concorrência {servico}.', '{contratante} canceled the bid for {servico}.'],
  venceu: ['Você venceu a concorrência {servico}, de {contratante}. A contratante vai entrar em contato.', 'You were awarded {servico} by {contratante}. They will be in touch.'],
  fechada: ['{contratante} fechou a concorrência {servico} com outra empresa. Obrigado por cotar.', '{contratante} awarded {servico} to another company. Thank you for bidding.'],
};
const ASSUNTO_LINK: Record<string, [string, string]> = {
  prazo: ['Prazo prorrogado: {servico}', 'Bid due date extended: {servico}'],
  adendo: ['Aviso sobre {servico}', 'Notice about {servico}'],
  mensagem: ['Nova mensagem sobre {servico}', 'New message about {servico}'],
  cancelada: ['Concorrência cancelada: {servico}', 'Bid canceled: {servico}'],
  venceu: ['Você venceu: {servico}', 'You were awarded: {servico}'],
  fechada: ['Concorrência fechada: {servico}', 'Bid awarded: {servico}'],
};

export function montarFila(item: ItemFila, site: string): Mensagem {
  const i = idiomaDe(item.idioma);
  const d = item.dados || {};
  const nome = item.para_nome || '';
  if (item.modelo === 'convite-usuario') {
    const por = String(d.por || '');
    const assunto = por ? dizer(i, `${por} convidou você para o KORbuild`, `${por} invited you to KORbuild`) : dizer(i, 'Você foi convidado para o KORbuild', 'You were invited to KORbuild');
    return pronto(item.para_email, {
      idioma: i, assunto, previa: dizer(i, `Entre na ${d.empresa} no KORbuild`, `Join ${d.empresa} on KORbuild`), saudacao: saudar(i, nome),
      paragrafos: [
        dizer(i, `${por || 'Alguém'} convidou você para entrar na ${d.empresa} no KORbuild, com o perfil ${d.perfil}.`, `${por || 'Someone'} invited you to join ${d.empresa} on KORbuild, as ${d.perfil}.`),
        dizer(i, 'Crie a sua conta (ou entre) com este mesmo e-mail e aceite o convite. O convite vale por 7 dias.', 'Create your account (or sign in) with this same email and accept the invitation. The invitation is valid for 7 days.'),
      ],
      botao: { rotulo: dizer(i, 'Aceitar o convite', 'Accept the invitation'), url: enderecoDoApp(site, '#/aceitar/' + d.token) },
    });
  }
  if (item.modelo === 'convite-concorrencia') {
    const assunto = dizer(i, `Convite para cotar: ${d.servico} · ${d.contratante}`, `Invitation to bid: ${d.servico} · ${d.contratante}`);
    return pronto(item.para_email, {
      idioma: i, assunto, previa: dizer(i, `${d.contratante} convidou a sua empresa para cotar`, `${d.contratante} invited your company to bid`), saudacao: saudar(i, nome),
      paragrafos: [
        dizer(i, `${d.contratante} convidou a sua empresa para cotar o serviço: ${d.servico}.`, `${d.contratante} invited your company to bid on ${d.servico}.`),
        ...(d.prazo ? [dizer(i, `Prazo da proposta: ${dataHora(d.prazo, i)}.`, `Bids are due by ${dataHora(d.prazo, i)}.`)] : []),
        dizer(i, 'O botão abre o pacote (escopo e desenhos). Pelo link você responde, pergunta e envia a proposta, sem precisar de conta. O link é pessoal: não o encaminhe.', 'The button below opens the bid package: scope, drawings and requirements. From there you can say whether you will bid, ask questions and submit your bid. No account is needed. This link is personal to you, so please do not forward it.'),
        dizer(i, 'Para medir plantas e orçar no KORbuild, crie a sua conta com este mesmo e-mail: o convite e as propostas vêm junto.', 'Want to take off plans and build your estimate in KORbuild Takeoff? Create an account with this same email, and this invitation and your bids carry over automatically.'),
      ],
      botao: { rotulo: dizer(i, 'Abrir o convite', 'View bid package'), url: enderecoDoApp(site, '#/convite/' + d.token) },
    });
  }
  if (item.modelo === 'aviso-link' && AVISO_LINK[String(d.evento)]) {
    const ev = String(d.evento);
    const dados = { ...d, prazo: dataHora(d.prazo, i), texto: String(d.texto ?? '') };
    const assunto = preencher(dizer(i, ASSUNTO_LINK[ev][0], ASSUNTO_LINK[ev][1]), dados);
    return pronto(item.para_email, {
      idioma: i, assunto, previa: assunto, saudacao: saudar(i, nome),
      paragrafos: [preencher(dizer(i, AVISO_LINK[ev][0], AVISO_LINK[ev][1]), dados), dizer(i, 'Para ver os detalhes, abra o link do convite que você recebeu por e-mail antes.', 'To see the details, open the invitation link you received by email earlier.')],
    });
  }
  throw new Error('modelo de e-mail desconhecido: ' + item.modelo + (d.evento ? '/' + d.evento : ''));
}
