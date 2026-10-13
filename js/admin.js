/* KORbuild — a administração da plataforma (docs/banco.md §15.5), numa página à parte (admin.html).
 *
 * Só entra quem está em admins_plataforma: o mesmo login do app, a mesma sessão. Tudo passa por funções do banco que
 * conferem isso (admin_empresas, admin_alterar_plano…); quem não é administrador não lê nem grava nada daqui.
 * Telas (pelo "#" da página): empresas, empresa/{id}, valores, emails, administradores. */

import { tr, idioma, definirIdioma, htmlSeletorIdioma, nomeDoPlano } from './i18n.js';
import { esc, toast } from './util.js';
import { iniciar, conta, cliente, traduzir } from './conta.js';
import { marca, logotipo } from './icones.js';

const app = document.getElementById('app');
const STATUS = { teste: 'Teste', ativa: 'Ativa', atraso: 'Em atraso', cancelada: 'Cancelada', suspensa: 'Suspensa' };
const CLASSE = { teste: 'etiqueta-azul', ativa: 'etiqueta-verde', atraso: 'etiqueta-ambar', cancelada: 'etiqueta-neutro', suspensa: 'etiqueta-alerta' };
const nomeDoStatus = (s) => ({ teste: tr('Em teste'), ativa: tr('Ativa'), atraso: tr('Em atraso'), cancelada: tr('Cancelada'), suspensa: tr('Suspensa') }[s] || s);
const nomeDaAcao = (a) => ({ plano: tr('Plano alterado'), modulos: tr('Módulos alterados'), administrador: tr('Administrador alterado'), reenvio: tr('E-mail reenviado'), valores: tr('Valores padrão alterados') }[a] || a);
const nomeDoModelo = (m) => ({ 'convite-usuario': tr('Convite para entrar numa empresa'), 'convite-concorrencia': tr('Convite para cotar'), 'aviso-link': tr('Aviso de concorrência') }[m] || m);
const ATUACOES = () => ({ prestadora: tr('Prestadora'), construtora: tr('Construtora'), ambas: tr('Prestadora e construtora') });
const dataHora = (t) => (t ? new Date(t).toLocaleString(idioma() === 'pt' ? 'pt-BR' : 'en-US', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const dia = (t) => (t ? new Date(t).toLocaleDateString(idioma() === 'pt' ? 'pt-BR' : 'en-US') : '—');
const campo = (id, rotulo, html) => '<div class="campo"><label class="rotulo-pequeno" for="' + id + '">' + rotulo + '</label>' + html + '</div>';

async function chamar(nome, args) {
  const { data, error } = await cliente().rpc(nome, args || {});
  if (error) throw error;
  return data;
}

/* ---------- A moldura ---------- */

const ABAS = () => [['empresas', tr('Empresas')], ['valores', tr('Valores padrão')], ['emails', tr('E-mails')], ['administradores', tr('Administradores')]];
function moldura(ativa, conteudo) {
  const email = conta.sessao && conta.sessao.user ? conta.sessao.user.email : '';
  return '<header class="topo"><div class="topo-dentro">' +
      '<a class="topo-marca" href="#empresas" aria-label="KORbuild">' + marca(26) + logotipo({ classe: 'topo-nome' }) + '</a>' +
      '<span class="topo-sep" aria-hidden="true"></span><span class="topo-modulo">' + tr('Administração da plataforma') + '</span>' +
      '<span class="topo-espaco"></span>' + htmlSeletorIdioma() +
      '<a class="btn btn-contorno btn-pequeno" style="white-space:nowrap" href="index.html#/inicio" title="' + esc(email) + '">' + tr('Voltar ao KORbuild') + '</a>' +
    '</div></header>' +
    '<div class="corpo"><main class="pagina pagina-larga" id="conteudo">' +
      '<nav class="abas-segmento" aria-label="' + esc(tr('Seções')) + '">' + ABAS().map(([k, r]) => '<a href="#' + k + '"' + (k === ativa ? ' class="ativa" aria-current="page"' : '') + '>' + r + '</a>').join('') + '</nav>' +
      conteudo + '</main></div>';
}
const cartaoAviso = (titulo, texto, acao) => '<main class="pagina pagina-estreita"><div class="aviso aviso-ambar"><b>' + titulo + '</b><span>' + texto + '</span>' + (acao || '') + '</div></main>';

/* ---------- Empresas ---------- */

let empresas = [];
let busca = '';
let soVencidos = false;

function linhaDaEmpresa(e) {
  const dias = e.dias_de_teste;
  const teste = e.plano.status === 'teste' && dias != null
    ? (dias < 0 ? '<span class="etiqueta etiqueta-alerta">' + tr('venceu há {n} dias', { n: -dias }) + '</span>' : '<span class="mudo">' + tr('{n} dias', { n: dias }) + '</span>') : '<span class="mudo">—</span>';
  return '<tr><td><a href="#empresa/' + e.id + '"><b>' + esc(e.nome) + '</b></a>' + (e.plano.demo ? ' <span class="etiqueta etiqueta-neutro">' + tr('Demonstração') + '</span>' : '') + '</td><td>' + esc(ATUACOES()[e.atuacao] || e.atuacao) + '</td>' +
    '<td><span class="etiqueta ' + (CLASSE[e.plano.status] || 'etiqueta-neutro') + '">' + esc(nomeDoStatus(e.plano.status)) + '</span>' + (e.plano.nome ? ' <span class="mudo pequeno">' + esc(nomeDoPlano(e.plano.nome)) + '</span>' : '') + '</td>' +
    '<td>' + teste + '</td><td class="num">' + e.usuarios + '</td><td class="num">' + e.obras + '</td><td>' + dataHora(e.ultimo_acesso) + '</td><td>' + dia(e.criada_em) + '</td></tr>';
}
async function telaEmpresas() {
  empresas = await chamar('admin_empresas', { p_busca: busca || null });
  const lista = soVencidos ? empresas.filter((e) => e.plano.status === 'teste' && e.dias_de_teste != null && e.dias_de_teste < 0) : empresas;
  const vencidos = empresas.filter((e) => e.plano.status === 'teste' && e.dias_de_teste != null && e.dias_de_teste < 0).length;
  return moldura('empresas',
    '<section class="cartao"><div class="cartao-cabeca"><h2 class="cartao-titulo">' + tr('Empresas') + '</h2><span class="mudo pequeno">' + tn(lista.length) + '</span></div>' +
      '<div class="grade-campos">' + campo('ad-busca', tr('Buscar pelo nome'), '<input type="search" id="ad-busca" value="' + esc(busca) + '" autocomplete="off">') +
        '<label class="check"><input type="checkbox" id="ad-vencidos"' + (soVencidos ? ' checked' : '') + '> ' + tr('Só testes vencidos ({n})', { n: vencidos }) + '</label></div>' +
      (lista.length ? '<div class="tabela-rolagem"><table class="tabela"><thead><tr><th>' + tr('Empresa') + '</th><th>' + tr('Atuação') + '</th><th>' + tr('Plano') + '</th><th>' + tr('Período de teste') + '</th><th class="num">' + tr('Usuários') + '</th><th class="num">' + tr('Obras') + '</th><th>' + tr('Último acesso') + '</th><th>' + tr('Criada em') + '</th></tr></thead><tbody>' +
        lista.map(linhaDaEmpresa).join('') + '</tbody></table></div>' : '<p class="vazio">' + tr('Nenhuma empresa encontrada.') + '</p>') + '</section>');
}
const tn = (n) => tr('{n} empresas', { n });

/* ---------- Uma empresa ---------- */

async function telaEmpresa(id) {
  const d = await chamar('admin_empresa', { p_id: id });
  const e = d.empresa, p = e.plano || {};
  const modulos = ['daily', 'crew', 'measure'];
  const log = d.log.length ? '<ul class="lista-simples">' + d.log.map((l) => '<li><b>' + esc(nomeDaAcao(l.acao)) + '</b> · ' + dataHora(l.em) + ' · ' + esc(l.quem) +
    (l.detalhe && l.detalhe.motivo ? '<span class="mudo pequeno bloco">' + esc(l.detalhe.motivo) + '</span>' : '') + '</li>').join('') + '</ul>' : '<p class="mudo">—</p>';
  return moldura('empresas',
    '<a class="voltar" href="#empresas">← ' + tr('Empresas') + '</a>' +
    '<div class="pagina-cabeca"><div class="pagina-titulo"><h1>' + esc(e.nome) + '</h1><p>' + esc(ATUACOES()[e.atuacao] || e.atuacao) + ' · ' + tr('criada em {data}', { data: dia(e.criada_em) }) + '</p></div>' +
      '<span class="etiqueta ' + (CLASSE[p.status] || 'etiqueta-neutro') + '">' + esc(nomeDoStatus(p.status)) + '</span></div>' +
    '<div class="grade-2">' +
    '<section class="cartao"><h2 class="cartao-titulo">' + tr('Plano') + '</h2>' +
      '<form id="ad-plano" class="grade-campos" novalidate onsubmit="return false" data-empresa="' + e.id + '">' +
        campo('ap-status', tr('Situação'), '<select id="ap-status" name="status">' + Object.keys(STATUS).map((s) => '<option value="' + s + '"' + (p.status === s ? ' selected' : '') + '>' + esc(nomeDoStatus(s)) + '</option>').join('') + '</select>') +
        campo('ap-nome', tr('Nome do plano'), '<input id="ap-nome" name="nome" value="' + esc(p.nome || '') + '">') +
        campo('ap-teste', tr('Teste até'), '<input type="date" id="ap-teste" name="teste_ate" value="' + esc(String(p.teste_ate || '').slice(0, 10)) + '">') +
        campo('ap-obras', tr('Limite de obras'), '<input type="number" min="0" step="1" id="ap-obras" name="limite_obras" value="' + (p.limite_obras ?? '') + '">') +
        campo('ap-usuarios', tr('Limite de usuários'), '<input type="number" min="0" step="1" id="ap-usuarios" name="limite_usuarios" value="' + (p.limite_usuarios ?? '') + '">') +
        campo('ap-motivo', tr('Motivo *'), '<input id="ap-motivo" name="motivo" placeholder="' + esc(tr('Ex.: assinou o plano Profissional')) + '">') +
      '</form>' +
      '<div class="btn-linha" style="margin-top:12px"><button type="button" class="btn btn-primario" data-acao="ad-salvar-plano">' + tr('Salvar o plano') + '</button>' +
        '<button type="button" class="btn btn-contorno" data-acao="ad-mais-teste" data-empresa="' + e.id + '">' + tr('+7 dias de teste') + '</button>' +
        (p.status === 'suspensa' ? '<button type="button" class="btn btn-contorno" data-acao="ad-situacao" data-situacao="ativa">' + tr('Reativar') + '</button>' : '<button type="button" class="btn btn-contorno" data-acao="ad-situacao" data-situacao="suspensa">' + tr('Suspender') + '</button>') + '</div>' +
      '<p class="mudo pequeno" style="margin-top:10px">' + tr('Suspensa: a empresa continua entrando e vendo seus dados, mas não grava nada. Quem administra a conta recebe um aviso (sininho e e-mail) com o motivo. Os limites ficam registrados; só passam a valer com o preço.') + '</p></section>' +
    '<section class="cartao"><h2 class="cartao-titulo">' + tr('Módulos') + '</h2>' +
      '<form id="ad-modulos" novalidate onsubmit="return false" data-empresa="' + e.id + '">' +
        modulos.map((m) => '<label class="check"><input type="checkbox" name="modulos" value="' + m + '"' + ((e.modulos || []).includes(m) ? ' checked' : '') + (e.atuacao === 'construtora' && m !== 'daily' ? ' disabled' : '') + '> ' + m.charAt(0).toUpperCase() + m.slice(1) + '</label>').join('') +
        campo('am-motivo', tr('Motivo *'), '<input id="am-motivo" name="motivo">') +
      '</form><div class="btn-linha" style="margin-top:12px"><button type="button" class="btn btn-contorno" data-acao="ad-salvar-modulos">' + tr('Salvar os módulos') + '</button></div>' +
      '<dl class="lista-dados" style="margin-top:16px"><dt>' + tr('Obras') + '</dt><dd>' + d.obras + '</dd><dt>' + tr('Funcionários') + '</dt><dd>' + d.funcionarios + '</dd><dt>' + tr('Projetos no Measure') + '</dt><dd>' + d.projetos + '</dd><dt>' + tr('Concorrências') + '</dt><dd>' + d.concorrencias + '</dd></dl></section></div>' +
    '<section class="cartao"><h2 class="cartao-titulo">' + tr('Pessoas') + '</h2><div class="tabela-rolagem"><table class="tabela"><thead><tr><th>' + tr('Nome') + '</th><th>' + tr('E-mail') + '</th><th>' + tr('Perfil de acesso') + '</th><th>' + tr('Situação') + '</th><th>' + tr('Último acesso') + '</th></tr></thead><tbody>' +
      d.pessoas.map((x) => '<tr><td><b>' + esc(x.nome) + '</b>' + (x.cargo ? '<span class="mudo pequeno bloco">' + esc(x.cargo) + '</span>' : '') + '</td><td>' + esc(x.email) + '</td><td>' + esc(tr(x.perfil)) + '</td><td>' + (x.ativo ? '<span class="etiqueta etiqueta-verde">' + tr('Ativo') + '</span>' : '<span class="etiqueta etiqueta-neutro">' + tr('Desativado') + '</span>') + '</td><td>' + dataHora(x.ultimo_acesso) + '</td></tr>').join('') + '</tbody></table></div></section>' +
    '<section class="cartao"><h2 class="cartao-titulo">' + tr('O que a plataforma já fez nesta empresa') + '</h2>' + log + '</section>');
}

/* ---------- Valores padrão ---------- */

async function telaValores() {
  const v = await chamar('admin_valores_padrao');
  return moldura('valores',
    '<section class="cartao"><h2 class="cartao-titulo">' + tr('Valores padrão das empresas novas') + '</h2>' +
      '<form id="ad-valores" class="grade-campos" novalidate onsubmit="return false">' +
        campo('av-dias', tr('Dias de teste'), '<input type="number" min="1" max="365" step="1" id="av-dias" name="teste_dias" value="' + esc(v.teste_dias ?? 14) + '">') +
        campo('av-config', tr('Configuração inicial (JSON)'), '<textarea id="av-config" name="configuracao" rows="8" spellcheck="false">' + esc(JSON.stringify(v.configuracao || {}, null, 2)) + '</textarea>') +
      '</form><div class="btn-linha"><button type="button" class="btn btn-primario" data-acao="ad-salvar-valores">' + tr('Salvar') + '</button></div>' +
      '<p class="mudo pequeno">' + tr('Valem só para as empresas criadas daqui em diante; as que já existem não mudam. Exemplo da configuração: {"localizacao": {"intervalo_gps_min": 15}}.') + '</p></section>');
}

/* ---------- E-mails ---------- */

async function telaEmails() {
  const [resumo, fila] = await Promise.all([chamar('admin_resumo_email'), chamar('admin_fila_email', { p_limite: 100 })]);
  const card = (n, r, alerta) => '<div class="cartao' + (alerta && n ? ' aviso-ambar' : '') + '" style="min-width:150px"><b style="font-size:24px">' + n + '</b><span class="mudo bloco">' + r + '</span></div>';
  return moldura('emails',
    '<div class="btn-linha" style="flex-wrap:wrap">' + card(resumo.fila_pendente, tr('na fila para sair'), false) + card(resumo.fila_com_erro, tr('com erro de envio'), true) + card(resumo.fila_parada, tr('paradas (5 tentativas)'), true) + card(resumo.avisos_pendentes, tr('avisos ainda não enviados'), false) + '</div>' +
    '<section class="cartao"><h2 class="cartao-titulo">' + tr('Fila de e-mails (convites e avisos para quem não tem conta)') + '</h2>' +
      (fila.length ? '<div class="tabela-rolagem"><table class="tabela"><thead><tr><th>' + tr('Quando') + '</th><th>' + tr('Para') + '</th><th>' + tr('Empresa') + '</th><th>' + tr('Tipo') + '</th><th>' + tr('Situação') + '</th><th></th></tr></thead><tbody>' +
        fila.map((f) => '<tr><td>' + dataHora(f.criado_em) + '</td><td>' + esc(f.para_email) + '</td><td>' + esc(f.empresa || '—') + '</td><td>' + esc(nomeDoModelo(f.modelo)) + '</td><td>' +
          (f.enviado_em ? '<span class="etiqueta etiqueta-verde">' + tr('Enviado') + '</span> <span class="mudo pequeno">' + dataHora(f.enviado_em) + '</span>' : f.erro ? '<span class="etiqueta etiqueta-alerta">' + tr('Erro') + '</span> <span class="mudo pequeno">' + esc(f.erro) + ' · ' + tr('{n} tentativas', { n: f.tentativas }) + '</span>' : '<span class="etiqueta etiqueta-ambar">' + tr('Na fila') + '</span>') + '</td>' +
          '<td>' + (!f.enviado_em && (f.erro || f.tentativas >= 5) ? '<button type="button" class="btn btn-contorno btn-pequeno" data-acao="ad-reenviar" data-id="' + f.id + '">' + tr('Tentar de novo') + '</button>' : '') + '</td></tr>').join('') + '</tbody></table></div>'
        : '<p class="vazio">' + tr('Nenhum e-mail na fila.') + '</p>') + '</section>');
}

/* ---------- Administradores ---------- */

async function telaAdministradores() {
  const lista = await chamar('admin_administradores');
  const eu = conta.sessao.user.id;
  return moldura('administradores',
    '<section class="cartao"><h2 class="cartao-titulo">' + tr('Quem administra a plataforma') + '</h2><div class="tabela-rolagem"><table class="tabela"><thead><tr><th>' + tr('E-mail') + '</th><th>' + tr('Desde') + '</th><th></th></tr></thead><tbody>' +
      lista.map((a) => '<tr><td><b>' + esc(a.email) + '</b>' + (a.user_id === eu ? ' <span class="mudo pequeno">(' + tr('você') + ')</span>' : '') + '</td><td>' + dia(a.desde) + '</td><td><button type="button" class="btn btn-contorno btn-pequeno" data-acao="ad-tirar" data-email="' + esc(a.email) + '">' + tr('Tirar') + '</button></td></tr>').join('') + '</tbody></table></div>' +
      '<p class="mudo pequeno">' + tr('A plataforma sempre mantém pelo menos um administrador.') + '</p></section>' +
    '<section class="cartao"><h2 class="cartao-titulo">' + tr('Incluir um administrador') + '</h2>' +
      '<form id="ad-incluir" class="grade-campos" novalidate onsubmit="return false">' + campo('aa-email', tr('E-mail da conta (a pessoa já precisa ter entrado no KORbuild)'), '<input type="email" id="aa-email" name="email">') + '</form>' +
      '<div class="btn-linha"><button type="button" class="btn btn-primario" data-acao="ad-incluir">' + tr('Incluir') + '</button></div></section>');
}

/* ---------- Rotas e ações ---------- */

let numeroDoDesenho = 0;   // uma tela lenta não pode sobrescrever outra mais nova (busca digitada e clique numa empresa)
async function desenhar() {
  const meu = ++numeroDoDesenho;
  try {
    await iniciar();
    if (!conta.sessao) { app.innerHTML = cartaoAviso(tr('Entre primeiro no KORbuild'), tr('Esta página usa o mesmo login do app.'), '<a class="btn btn-primario btn-pequeno" href="index.html#/entrar">' + tr('Entrar') + '</a>'); return; }
    const ehAdmin = await chamar('eh_admin_plataforma');
    if (!ehAdmin) { app.innerHTML = cartaoAviso(tr('Sem acesso'), tr('Esta área é só de quem administra a plataforma KORbuild.'), '<a class="btn btn-contorno btn-pequeno" href="index.html#/inicio">' + tr('Voltar ao KORbuild') + '</a>'); return; }
    const [rota, arg] = (location.hash.slice(1) || 'empresas').split('/');
    const telas = { empresas: telaEmpresas, empresa: () => telaEmpresa(arg), valores: telaValores, emails: telaEmails, administradores: telaAdministradores };
    const html = await (telas[rota] || telaEmpresas)();
    if (meu !== numeroDoDesenho) return;
    app.innerHTML = html;
    document.documentElement.lang = idioma() === 'pt' ? 'pt-BR' : 'en';
  } catch (e) {
    if (meu !== numeroDoDesenho) return;
    app.innerHTML = cartaoAviso(tr('Não foi possível abrir esta tela'), esc(traduzir(e)), '<button type="button" class="btn btn-contorno btn-pequeno" data-acao="ad-recarregar">' + tr('Tentar de novo') + '</button>');
  }
}

const valorDe = (f, n) => (f.elements[n] ? f.elements[n].value.trim() : '');
async function gravar(promessa, ok) {
  try { await promessa; toast(ok); await desenhar(); } catch (e) { toast(traduzir(e)); }
}

const acoes = {
  'ad-recarregar': () => desenhar(),
  async 'ad-salvar-plano'() {
    const f = document.getElementById('ad-plano');
    const num = (n) => { const v = valorDe(f, n); return v === '' ? null : Number(v); };
    const plano = { status: valorDe(f, 'status'), nome: valorDe(f, 'nome') || null, teste_ate: valorDe(f, 'teste_ate') || null, limite_obras: num('limite_obras'), limite_usuarios: num('limite_usuarios') };
    await gravar(chamar('admin_alterar_plano', { p_empresa: f.dataset.empresa, p_plano: plano, p_motivo: valorDe(f, 'motivo') }), tr('Plano atualizado.'));
  },
  async 'ad-situacao'(el) {
    const f = document.getElementById('ad-plano');
    const motivo = valorDe(f, 'motivo');
    if (!motivo) { toast(tr('Diga o motivo da mudança.')); document.getElementById('ap-motivo').focus(); return; }
    if (el.dataset.situacao === 'suspensa' && !window.confirm(tr('Suspender esta empresa? Ela continua entrando e vendo os dados, mas não grava mais nada.'))) return;
    await gravar(chamar('admin_alterar_plano', { p_empresa: f.dataset.empresa, p_plano: { status: el.dataset.situacao }, p_motivo: motivo }), el.dataset.situacao === 'suspensa' ? tr('Empresa suspensa.') : tr('Empresa reativada.'));
  },
  async 'ad-mais-teste'(el) {
    const f = document.getElementById('ad-plano');
    const motivo = valorDe(f, 'motivo') || tr('Teste prorrogado em 7 dias');
    const atual = valorDe(f, 'teste_ate');
    const base = atual && atual >= new Date().toISOString().slice(0, 10) ? new Date(atual + 'T12:00:00') : new Date();
    base.setDate(base.getDate() + 7);
    await gravar(chamar('admin_alterar_plano', { p_empresa: el.dataset.empresa, p_plano: { status: 'teste', teste_ate: base.toISOString().slice(0, 10) }, p_motivo: motivo }), tr('Teste prorrogado.'));
  },
  async 'ad-salvar-modulos'() {
    const f = document.getElementById('ad-modulos');
    const marcados = Array.from(f.querySelectorAll('input[name="modulos"]:checked')).map((i) => i.value);
    await gravar(chamar('admin_alterar_modulos', { p_empresa: f.dataset.empresa, p_modulos: marcados, p_motivo: valorDe(f, 'motivo') }), tr('Módulos atualizados.'));
  },
  async 'ad-salvar-valores'() {
    const f = document.getElementById('ad-valores');
    let configuracao;
    try { configuracao = JSON.parse(valorDe(f, 'configuracao') || '{}'); } catch { toast(tr('A configuração não é um JSON válido.')); return; }
    await gravar(chamar('admin_valores_padrao', { p_valores: { teste_dias: Number(valorDe(f, 'teste_dias')), configuracao } }), tr('Valores padrão salvos.'));
  },
  async 'ad-reenviar'(el) { await gravar(chamar('admin_reenviar', { p_id: Number(el.dataset.id) }), tr('O e-mail volta para a fila.')); },
  async 'ad-incluir'() { const f = document.getElementById('ad-incluir'); await gravar(chamar('admin_definir', { p_email: valorDe(f, 'email'), p_ligado: true }), tr('Administrador incluído.')); },
  async 'ad-tirar'(el) {
    if (!window.confirm(tr('Tirar {email} da administração da plataforma?', { email: el.dataset.email }))) return;
    await gravar(chamar('admin_definir', { p_email: el.dataset.email, p_ligado: false }), tr('Administrador retirado.'));
  },
  idioma(el) { definirIdioma(el.dataset.idioma); desenhar(); },
};

app.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-acao]');
  if (el && acoes[el.dataset.acao]) acoes[el.dataset.acao](el);
});
let esperaBusca = null;
app.addEventListener('input', (ev) => {
  if (ev.target.id !== 'ad-busca') return;
  busca = ev.target.value;
  clearTimeout(esperaBusca);
  esperaBusca = setTimeout(async () => { await desenhar(); const i = document.getElementById('ad-busca'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 350);
});
app.addEventListener('change', (ev) => { if (ev.target.id === 'ad-vencidos') { soVencidos = ev.target.checked; desenhar(); } });
window.addEventListener('hashchange', desenhar);
app.innerHTML = '<p class="vazio" style="margin:24px">' + tr('Carregando…') + '</p>';
desenhar();
