/* Um servidorzinho local só para servir os arquivos do projeto ao Chromium (a massa de demonstração dirige o app de verdade). */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));   // não use .pathname: no Windows vira /C:/… e não existe
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };
export async function servirProjeto() {
  const servidor = createServer((req, res) => {
    let caminho = normalize(join(RAIZ, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    if (existsSync(caminho) && statSync(caminho).isDirectory()) caminho = join(caminho, 'index.html');
    if (!caminho.startsWith(RAIZ) || !existsSync(caminho) || !statSync(caminho).isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TIPOS[extname(caminho)] || 'application/octet-stream' });
    res.end(readFileSync(caminho));
  });
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  return { base: 'http://127.0.0.1:' + servidor.address().port + '/', fechar: () => servidor.close() };
}
