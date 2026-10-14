/* KORbuild — a política de conteúdo (CSP) candidata e o jeito de testá-la com os testes que já existem.
 * KOR_CSP=relatorio  → o navegador só AVISA o que a política barraria (Content-Security-Policy-Report-Only); as violações vão para o arquivo de KOR_CSP_ARQ.
 * KOR_CSP=ligada    → a política vale de verdade (o que quebrar aparece como falha do próprio teste) e as violações também vão para o arquivo.
 * Sem a variável não faz nada. Chamado por rotear() de tests/_supabase-local.mjs e tests/_supabase-real.mjs.
 * Uso: KOR_CSP=relatorio KOR_CSP_ARQ=.testes/csp.txt node tests/crew-oficial.test.mjs   (e os demais). */

import { appendFileSync } from 'node:fs';

/* A mesma política vai, depois, na <meta http-equiv="Content-Security-Policy"> de index.html e admin.html (a meta não aceita frame-ancestors nem Report-Only). */
export const POLITICA = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://*.supabase.co https://tile.openstreetmap.org https://*.tile.openstreetmap.org",
  "connect-src 'self' blob: data: https://*.supabase.co wss://*.supabase.co https://api.open-meteo.com https://nominatim.openstreetmap.org https://router.project-osrm.org https://tile.openstreetmap.org",
  "media-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

export async function ativarCsp(contexto) {
  const modo = process.env.KOR_CSP;
  if (!modo) return;
  const cabecalho = modo === 'ligada' ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only';
  await contexto.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      console.error('CSP-VIOLACAO ' + JSON.stringify({ diretiva: e.violatedDirective, bloqueado: e.blockedURI, onde: e.sourceFile || '', linha: e.lineNumber, amostra: (e.sample || '').slice(0, 80), pagina: location.hash }));
    });
  });
  await contexto.route((url) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(url.href) && !url.href.includes(':3001'), async (route) => {
    if (route.request().resourceType() !== 'document') return route.fallback();
    const resposta = await route.fetch();
    await route.fulfill({ response: resposta, headers: { ...resposta.headers(), [cabecalho]: process.env.KOR_CSP_POLITICA || POLITICA } });
  });
  const anotar = (m) => {
    if (m.type() === 'error' && m.text().startsWith('CSP-VIOLACAO') && process.env.KOR_CSP_ARQ) appendFileSync(process.env.KOR_CSP_ARQ, m.text().slice(13) + '\n');
  };
  const ligar = (p) => p.on('console', anotar);
  contexto.pages().forEach(ligar);
  contexto.on('page', ligar);
}
