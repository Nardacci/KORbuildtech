/* KORbuild — monta a pasta para publicar no domínio de produção (korbuildtech.com): a 1ª versão, só com o Measure Takeoff e o Settings.
 * Uso: python3 tools/gerar_portal.py --edicao=measure   (uma vez, e sempre que o guia mudar)
 *      node tools/gerar-producao.mjs                    → cria producao/ ; é o conteúdo dessa pasta que vai para o domínio (public_html)
 * O app é o mesmo código da homologação (GitHub Pages): no domínio korbuildtech.com ele abre sozinho como 1ª versão (js/versao.js).
 * Aqui só se deixa de fora o que não vai para produção: testes, documentos do projeto, o guia inteiro, o protótipo-guia e os roteiros de celular. */

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SAIDA = join(RAIZ, 'producao');
const COPIAR = ['index.html', 'admin.html', 'diagnostico.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'icons', 'vendor', 'assets'];

if (!existsSync(join(RAIZ, 'portal-measure', 'index.html'))) {
  console.error('Falta o guia da 1ª versão: rode antes  python3 tools/gerar_portal.py --edicao=measure');
  process.exit(1);
}
rmSync(SAIDA, { recursive: true, force: true });
mkdirSync(SAIDA, { recursive: true });
for (const item of COPIAR) {
  if (existsSync(join(RAIZ, item))) cpSync(join(RAIZ, item), join(SAIDA, item), { recursive: true });
}
cpSync(join(RAIZ, 'portal-measure'), join(SAIDA, 'portal'), { recursive: true });

// o app instalado se chama KORbuild Takeoff (a homologação, com o mesmo código, mantém o nome KORbuild)
const manifesto = JSON.parse(readFileSync(join(SAIDA, 'manifest.webmanifest'), 'utf8'));
manifesto.name = 'KORbuild Takeoff'; manifesto.short_name = 'Takeoff';
manifesto.description = 'KORbuild Takeoff: medição de plantas, quantidades de material, cotações e propostas.';
writeFileSync(join(SAIDA, 'manifest.webmanifest'), JSON.stringify(manifesto, null, 2) + '\n');

// outro projeto Supabase para produção (recomendado: o de homologação fica com os dados de teste): KOR_SUPABASE_URL e KOR_SUPABASE_ANON_KEY (a chave pública "anon"/publishable; nunca a service_role)
if (process.env.KOR_SUPABASE_URL || process.env.KOR_SUPABASE_ANON_KEY) {
  const url = process.env.KOR_SUPABASE_URL, chave = process.env.KOR_SUPABASE_ANON_KEY;
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url || '') || !/^(sb_publishable_|eyJ)/.test(chave || '')) { console.error('KOR_SUPABASE_URL (https://<projeto>.supabase.co) e KOR_SUPABASE_ANON_KEY (chave pública anon/publishable) precisam vir juntas e válidas.'); process.exit(1); }
  const cfg = join(SAIDA, 'js', 'config.js');
  let c = readFileSync(cfg, 'utf8');
  c = c.replace(/SUPABASE_URL = '[^']*'/, "SUPABASE_URL = '" + url + "'").replace(/SUPABASE_ANON_KEY = '[^']*'/, "SUPABASE_ANON_KEY = '" + chave + "'");
  writeFileSync(cfg, c);
  console.log('Supabase de produção: ' + url);
}

// o service worker guarda uma lista de arquivos: tira os que não existem em produção (senão a instalação dele falha)
let sw = readFileSync(join(SAIDA, 'sw.js'), 'utf8');
const lista = /var APP = \[([\s\S]*?)\];/.exec(sw);
const arquivos = [...lista[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
const ficam = arquivos.filter((a) => a === './' || existsSync(join(SAIDA, a)));
const fora = arquivos.filter((a) => !ficam.includes(a));
sw = sw.replace(lista[0], 'var APP = [\n  ' + ficam.map((a) => "'" + a + "'").join(', ') + ',\n];');
writeFileSync(join(SAIDA, 'sw.js'), sw);

// servidor Apache (Hostinger): https, nada de lista de pastas, o service worker e a página inicial sempre revalidados
writeFileSync(join(SAIDA, '.htaccess'), `# KORbuild — 1ª versão (gerado por tools/gerar-producao.mjs)
Options -Indexes
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteCond %{HTTPS} off
  RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
</IfModule>
<IfModule mod_headers.c>
  Header always set X-Content-Type-Options "nosniff"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
  <FilesMatch "^(sw\\.js|index\\.html|admin\\.html|diagnostico\\.html)$">
    Header set Cache-Control "no-cache"
  </FilesMatch>
</IfModule>
`);
console.log('producao/ pronta: ' + COPIAR.filter((i) => existsSync(join(SAIDA, i))).join(', ') + ', portal/ (guia do Measure Takeoff), .htaccess');
console.log('service worker: ' + ficam.length + ' arquivos guardados' + (fora.length ? ' (fora de produção: ' + fora.join(', ') + ')' : ''));
