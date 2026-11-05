/* KORbuild — a função de borda criar-usuario (migração 0026), sem Deno e sem rede: a lógica (supabase/functions/criar-usuario/tratar.ts) com clientes de mentira,
 * e o gerador de senha (senha.ts). Confere: quem pode (o login de quem chama passa pelas funções preparar_*), a ordem das chamadas, o desfazimento do login quando a
 * finalização falha, o limite por minuto, que a senha nunca vai para o log, e que a senha sai no formato certo, sem caracteres que se confundem, com todos os símbolos
 * sorteados por igual. Uso: node tests/criar-usuario.test.mjs */

import { readFileSync } from 'node:fs';

const { tratar } = await import('../supabase/functions/criar-usuario/tratar.ts');
const { novaSenha, MAIUSCULAS, MINUSCULAS, NUMEROS } = await import('../supabase/functions/criar-usuario/senha.ts');

let falhas = 0, total = 0;
const verificar = (c, t, d) => { total++; if (c) console.log('  ok  ' + t); else { falhas++; console.log('FALHA ' + t + (d !== undefined ? '\n      encontrado: ' + (typeof d === 'string' ? d : JSON.stringify(d).slice(0, 300)) : '')); } };

// ---- a senha
console.log('A senha provisória');
const FORMATO = /^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/;
const amostra = Array.from({ length: 4000 }, novaSenha);
verificar(amostra.every((s) => FORMATO.test(s)), 'três grupos de quatro, só letras e números');
verificar(amostra.every((s) => !/[01OIl]/.test(s)), 'nenhum caractere que se confunde (0, O, 1, l, I)');
verificar(amostra.every((s) => /[A-Z]/.test(s) && /[a-z]/.test(s) && /[0-9]/.test(s)), 'sempre tem maiúscula, minúscula e número');
verificar(new Set(amostra).size === amostra.length, '4.000 senhas, nenhuma repetida');
const cont = new Map(); for (const s of amostra) for (const ch of s.replace(/-/g, '')) cont.set(ch, (cont.get(ch) || 0) + 1);
const todos = MAIUSCULAS + MINUSCULAS + NUMEROS, esperado = (amostra.length * 12) / todos.length;
verificar(todos.split('').every((ch) => (cont.get(ch) || 0) > 0), 'todos os ' + todos.length + ' símbolos aparecem');
// sorteio uniforme repetido até ter os três tipos: os números saem ~19% mais que o uniforme puro (a senha sem número é descartada); o resto, ~3% menos. Entropia ~69,4 bits.
const desvio = (ch) => Math.abs((cont.get(ch) || 0) - esperado * (NUMEROS.includes(ch) ? 1.19 : 0.98)) / esperado;
const pior = Math.max(...todos.split('').map(desvio));
verificar(pior < 0.2, 'cada símbolo sai na frequência esperada do sorteio (sem viés além do descarte das senhas sem os três tipos; pior desvio ' + (pior * 100).toFixed(1) + '%)', pior);
const pos = Array.from({ length: 12 }, (_, i) => amostra.filter((s) => /[0-9]/.test(s.replace(/-/g, '')[i])).length);
verificar(Math.min(...pos) > 0, 'o número garantido não fica sempre na mesma posição', pos);

// ---- clientes de mentira
function montar({ usuario = { id: 'admin-1' }, livre = true, preparar = {}, criar = {}, finalizar = {}, nova = {} } = {}) {
  const chamadas = [];
  const logs = [];
  const orig = { log: console.log, error: console.error };
  const quem = {
    auth: { getUser: async () => (usuario ? { data: { user: usuario }, error: null } : { data: null, error: { message: 'jwt inválido' } }) },
    rpc: async (nome, args) => { chamadas.push(['quem.rpc', nome, args]); return nome === 'preparar_usuario_direto' ? { data: preparar.data ?? 'emp-1', error: preparar.erro || null } : { data: nova.data === undefined ? 'user-alvo' : nova.data, error: nova.erro || null }; },
  };
  const servico = {
    rpc: async (nome, args) => {
      chamadas.push(['servico.rpc', nome, args]);
      if (nome === 'contar_tentativa') return { data: livre };
      if (nome === 'finalizar_usuario_direto') return { data: finalizar.erro ? null : 'membro-1', error: finalizar.erro || null };
      return { data: null, error: null };
    },
    auth: { admin: {
      createUser: async (a) => { chamadas.push(['createUser', a]); return criar.erro ? { data: null, error: criar.erro } : { data: { user: { id: 'user-novo' } }, error: null }; },
      deleteUser: async (id) => { chamadas.push(['deleteUser', id]); return { error: null }; },
      updateUserById: async (id, a) => { chamadas.push(['updateUserById', id, a]); return { error: nova.erroAtualizar || null }; },
    } },
  };
  return { chamadas, logs, deps: { clienteDoChamador: (a) => { chamadas.push(['clienteDoChamador', a]); return quem; }, servico } };
}
const pedido = (corpo, { metodo = 'POST', auth = 'Bearer jwt-do-admin' } = {}) => new Request('http://x/functions/v1/criar-usuario', { method: metodo, headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: auth } : {}) }, body: metodo === 'POST' ? JSON.stringify(corpo) : undefined });
const chamou = (cs, nome) => cs.filter((c) => c[0] === nome || c[1] === nome);
async function capturar(fn) {   // tudo o que a função escreve no console, para provar que a senha não vai para o log
  const ls = []; const o = { log: console.log, error: console.error, warn: console.warn, info: console.info };
  for (const k of Object.keys(o)) console[k] = (...a) => ls.push(a.map(String).join(' '));
  try { return { r: await fn(), ls }; } finally { Object.assign(console, o); }
}
const DADOS = { acao: 'criar', email: ' Novo.Pessoa@Example.com ', nome: 'Novo Pessoa', cargo: 'Encarregado', telefone: '(603) 555-0180', perfil: 'perfil-1' };

console.log('\nCadastrar');
let m = montar();
let { r, ls } = await capturar(() => tratar(pedido(DADOS), m.deps));
let j = await r.json();
verificar(r.status === 200 && j.ok && FORMATO.test(j.senha) && j.membro === 'membro-1', 'cadastro ok: devolve a senha provisória e o membro', j);
verificar(r.headers.get('Cache-Control') === 'no-store', 'a resposta não vai para o cache');
const ordem = m.chamadas.map((c) => c[0] === 'quem.rpc' || c[0] === 'servico.rpc' ? c[1] : c[0]);
verificar(ordem.join(' › ') === 'clienteDoChamador › contar_tentativa › preparar_usuario_direto › createUser › finalizar_usuario_direto', 'a ordem: o login de quem chama confere antes de qualquer coisa, depois cria o login, depois finaliza', ordem);
verificar(m.chamadas.find((c) => c[0] === 'clienteDoChamador')[1] === 'Bearer jwt-do-admin', 'a conferência de permissão usa o login de quem chamou (o mesmo JWT)');
const cu = m.chamadas.find((c) => c[0] === 'createUser')[1];
verificar(cu.email === 'novo.pessoa@example.com' && cu.email_confirm === true && cu.user_metadata.trocar_senha === true && cu.password === j.senha, 'o login nasce confirmado, com e-mail em minúsculas e a marca de "trocar a senha"', { ...cu, password: '***' });
const fin = m.chamadas.find((c) => c[1] === 'finalizar_usuario_direto')[2];
verificar(fin.p_admin === 'admin-1' && fin.p_user === 'user-novo' && fin.p_perfil === 'perfil-1' && fin.p_cargo === 'Encarregado', 'a finalização leva o administrador verificado (não um dado do pedido)', fin);
verificar(!ls.some((l) => l.includes(j.senha)), 'a senha não aparece em nenhuma linha de log');

console.log('\nRecusas');
m = montar({ preparar: { erro: { message: 'Sem permissão para cadastrar usuários.' } } });
({ r } = await capturar(() => tratar(pedido(DADOS), m.deps))); j = await r.json();
verificar(r.status === 400 && /Sem permiss/.test(j.erro) && chamou(m.chamadas, 'createUser').length === 0 && chamou(m.chamadas, 'finalizar_usuario_direto').length === 0, 'sem permissão: o banco recusa e NENHUM login é criado', j);
m = montar({ preparar: { erro: { message: 'ERROR: Este e-mail já tem conta no KORbuild.' } } });
({ r } = await capturar(() => tratar(pedido(DADOS), m.deps))); j = await r.json();
verificar(r.status === 400 && j.erro === 'Este e-mail já tem conta no KORbuild.', 'a mensagem do banco chega limpa, sem o prefixo ERROR:', j);
m = montar({ criar: { erro: { message: 'User already registered', status: 422 } } });
({ r } = await capturar(() => tratar(pedido(DADOS), m.deps))); j = await r.json();
verificar(r.status === 400 && /já tem conta/.test(j.erro) && chamou(m.chamadas, 'finalizar_usuario_direto').length === 0, 'e-mail que o Auth já tem: recusa com o caminho do convite, sem finalizar', j);
m = montar({ criar: { erro: { message: 'falha interna com detalhe do servidor', status: 500 } } });
({ r, ls } = await capturar(() => tratar(pedido(DADOS), m.deps))); j = await r.json();
verificar(r.status === 400 && !/detalhe do servidor/.test(j.erro) && ls.every((l) => !/novo\.pessoa|@example/.test(l)), 'erro do Auth: aviso genérico, e o log não leva o e-mail', { j, ls });
m = montar({ finalizar: { erro: { message: 'Perfil inválido.' } } });
({ r } = await capturar(() => tratar(pedido(DADOS), m.deps))); j = await r.json();
verificar(r.status === 400 && j.erro === 'Perfil inválido.' && m.chamadas.some((c) => c[0] === 'deleteUser' && c[1] === 'user-novo'), 'se a finalização falha, o login criado é apagado (nada fica sem empresa)', m.chamadas.map((c) => c[0]));
m = montar({ usuario: null });
({ r } = await capturar(() => tratar(pedido(DADOS), m.deps)));
verificar(r.status === 401 && chamou(m.chamadas, 'contar_tentativa').length === 0, 'JWT inválido: 401, nada é chamado');
m = montar();
({ r } = await capturar(() => tratar(pedido(DADOS, { auth: '' }), m.deps)));
verificar(r.status === 401 && m.chamadas.length === 0, 'sem Authorization: 401, nada é chamado');
m = montar({ livre: false });
({ r } = await capturar(() => tratar(pedido(DADOS), m.deps)));
verificar(r.status === 429 && chamou(m.chamadas, 'preparar_usuario_direto').length === 0, 'passou do limite por minuto: 429, sem tocar no cadastro');
m = montar();
({ r } = await capturar(() => tratar(pedido({ acao: 'apagar-tudo' }), m.deps)));
verificar(r.status === 400, 'ação desconhecida: 400');
({ r } = await capturar(() => tratar(pedido(null, { metodo: 'GET' }), m.deps)));
verificar(r.status === 405, 'só POST (GET: 405)');
({ r } = await capturar(() => tratar(pedido(null, { metodo: 'OPTIONS' }), m.deps)));
verificar(r.status === 200 && r.headers.get('Access-Control-Allow-Origin') === '*', 'OPTIONS responde para o navegador (CORS)');

console.log('\nNova senha provisória');
m = montar();
({ r, ls } = await capturar(() => tratar(pedido({ acao: 'nova-senha', membro: 'membro-9' }), m.deps))); j = await r.json();
const up = m.chamadas.find((c) => c[0] === 'updateUserById');
verificar(r.status === 200 && FORMATO.test(j.senha) && up && up[1] === 'user-alvo' && up[2].password === j.senha && up[2].user_metadata.trocar_senha === true, 'nova senha: o login conferido pelo banco recebe a senha e a marca de trocar', { j: { ...j, senha: '***' }, up: up && [up[1], { ...up[2], password: '***' }] });
verificar(m.chamadas.find((c) => c[1] === 'preparar_nova_senha')[2].p_membro === 'membro-9' && !ls.some((l) => l.includes(j.senha)), 'a pessoa vem do pedido, mas quem confere é o banco; a senha não vai para o log');
m = montar({ nova: { erro: { message: 'Para trocar a sua própria senha, use Meu perfil.' } } });
({ r } = await capturar(() => tratar(pedido({ acao: 'nova-senha', membro: 'eu-mesmo' }), m.deps))); j = await r.json();
verificar(r.status === 400 && /própria senha/.test(j.erro) && chamou(m.chamadas, 'updateUserById').length === 0, 'a própria senha ou pessoa de outra empresa: recusada pelo banco, nada é alterado', j);
m = montar({ nova: { erroAtualizar: { message: 'x', status: 500 } } });
({ r } = await capturar(() => tratar(pedido({ acao: 'nova-senha', membro: 'm' }), m.deps))); j = await r.json();
verificar(r.status === 400 && !('senha' in j), 'se o Auth falha, nenhuma senha é devolvida (ela não teria valido)', j);

console.log('\nO arquivo da função');
const fonte = readFileSync(new URL('../supabase/functions/criar-usuario/tratar.ts', import.meta.url), 'utf8') + readFileSync(new URL('../supabase/functions/criar-usuario/index.ts', import.meta.url), 'utf8');
verificar(!/console\.(log|info|warn)\(/.test(fonte), 'a função não usa console.log (só console.error, com o código do erro)');
verificar(!/console\.error\([^)]*(senha|password|email)/i.test(fonte), 'nenhum console.error leva senha ou e-mail');
verificar(!/no-verify-jwt/.test(readFileSync(new URL('../supabase/functions/criar-usuario/index.ts', import.meta.url), 'utf8').replace(/\/\/.*COM verificação.*\n/, '').split('\n').filter((l) => !l.startsWith('//')).join('\n')), 'o código não desliga a verificação de JWT (a publicação é com a verificação ligada)');

console.log(falhas ? '\n' + falhas + ' falha(s) de ' + total + '.' : '\nTudo certo: ' + total + ' verificações.');
process.exit(falhas ? 1 : 0);
