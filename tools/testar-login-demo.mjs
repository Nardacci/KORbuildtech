/* KORbuild — confere se os logins da massa demo entram com a senha de KOR_DEMO_SENHA. Só lê: faz o login pela API de autenticação e sai.
 * Uso (PowerShell, na janela onde KOR_DEMO_SENHA está definida): node tools/testar-login-demo.mjs [email ...]
 * Sem e-mails, testa os dois do roteiro de teste. Nunca imprime a senha; só diz se entrou e, se não, o motivo que o servidor deu. */
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../js/config.js';

const senha = process.env.KOR_DEMO_SENHA;
if (!senha) { console.log('KOR_DEMO_SENHA não está definida nesta janela. Defina e rode de novo (não escreva a senha em arquivo nem no chat).'); process.exit(2); }
console.log('Senha lida da variável: ' + senha.length + ' caracteres' + (senha !== senha.trim() ? ' (ATENÇÃO: tem espaço no começo ou no fim)' : ''));

const emails = process.argv.slice(2).filter((a) => a.includes('@'));
if (!emails.length) emails.push('demo.s2.trabalhador@example.com', 'demo.s2.encarregado@example.com');

let falhou = 0;
for (const email of emails) {
  const r = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
    method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: senha }),
  });
  const j = await r.json().catch(() => ({}));
  if (r.ok && j.access_token) console.log('  ENTROU  ' + email);
  else { falhou++; console.log('  NÃO ENTROU  ' + email + ' · HTTP ' + r.status + ' · ' + (j.error_code || j.error || '?') + ' · ' + (j.msg || j.error_description || '')); }
}
process.exit(falhou ? 1 : 0);
