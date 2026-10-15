/* KORbuild — telas da página oficial (sem "?demo"), com a conta de verdade no Supabase (docs/banco.md, fatia 1):
 * entrar, criar conta, esqueci a senha / nova senha, aceitar convite, criar a empresa no primeiro acesso,
 * e a área da conta: início, usuários (convites), perfis de acesso e empresa. Os módulos chegam nas próximas fatias. */

import { esc, toast, confirmar, dataHora } from './util.js';
import { tr, idioma, htmlSeletorIdioma, nomeDoPlano } from './i18n.js';
import { paginaEntrada, htmlCaminhosEntrada, telaLoginOficial, URL_PROTOTIPO, URL_PORTAL } from './plataforma.js';
import { icone, marca, logotipo } from './icones.js';
import { PERMISSOES, permissao } from './settings.js';
import { ATUACOES } from './contatos.js';
import {
  conta, iniciar, aoMudar, carregarMinhaConta, pode, emailAtual, entrar, cadastrar, pedirNovaSenha, definirNovaSenha, sair, criarEmpresa,
  aceitarConvite, convidar, salvarEmpresa, atualizarMeuPerfil, trocarEmail, emailPendente, salvarPermissoes, mudarPerfilDoMembro, ativarMembro, cancelarConvite, criarPerfil, excluirPerfil,
} from './conta.js';
import { telaCadastro, ABAS_CADASTROS, ligarCadastros, acoesCadastros } from './cadastros-telas.js';
import { esquecer as esquecerCadastros } from './cadastros.js';
import { espelho } from './espelho.js';
import { htmlAvisoInstalar } from './instalar.js';
import { iniciarDiagnostico } from './diagnostico.js';
import { CATEGORIAS_DE_EMAIL, textoDaCategoria, recebePorEmail, prefsLidas, lerPrefs, salvarPrefEmail } from './avisos-oficial.js';
export { acoesCadastros };

let redesenhar = () => {};

/* Os perfis padrão vêm do banco em português (criar_empresa); na tela, no idioma escolhido. Os criados pela empresa ficam como estão. */
const nomeDoPerfil = (p) => (p ? (p.chave ? tr(p.nome) : p.nome) : '');
const descricaoDoPerfil = (p) => (p && p.descricao ? (p.chave ? tr(p.descricao) : p.descricao) : '');
/* A conta é relida sozinha (renovação do token, idioma gravado, outro aparelho): quem está na área da conta com um formulário em que já
 * mexeu não o vê apagado. As ações da própria pessoa chamam redesenhar() direto e não passam por aqui; as telas de entrada
 * (login, cadastro) ficam de fora, porque precisam trocar de tela quando a sessão muda. */
const formularioEmEdicao = () => !!(conta.membro && location.hash.startsWith('#/conta') && document.querySelector('#app form[data-sujo]'));
export function ligarOficial(fn) { redesenhar = fn; aoMudar(() => { if (!formularioEmEdicao()) redesenhar(); }); ligarCadastros({ redesenhar: () => redesenhar(), ir: (h) => ir(h) }); }

const CONVITE = 'kbt.convite';

/* Usuários e convites mudam por fora (alguém aceitou um convite): ao abrir a aba, relê do banco e redesenha. */
let ultimaReleitura = 0;
function relerAoAbrir() {
  if (Date.now() - ultimaReleitura < 3000) return;
  ultimaReleitura = Date.now();
  carregarMinhaConta().then(() => redesenhar()).catch(() => { /* fica o que já estava na tela */ });
}
// quem deixou Usuários aberto e volta para a janela (o convidado aceitou nesse meio-tempo) vê a lista atualizada
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && location.hash.startsWith('#/conta/usuarios') && conta.sessao) relerAoAbrir();
});
const guardarConvite = (t) => { try { sessionStorage.setItem(CONVITE, t); } catch (e) { /* sem armazenamento */ } };
const conviteGuardado = () => { try { return sessionStorage.getItem(CONVITE); } catch (e) { return null; } };
const esquecerConvite = () => { try { sessionStorage.removeItem(CONVITE); } catch (e) { /* */ } };

/* ---------- Roteamento da página oficial ---------- */

/* Devolve { html } ou { trocar: '#/…' }. Enquanto a conexão com o banco carrega, uma tela de espera. */
export function telaOficial(p) {
  if (!conta.pronto) {
    iniciar().then(() => redesenhar()).catch((e) => { conta.pronto = true; conta.erroConexao = e.message; redesenhar(); });
    return { html: '<main class="pagina pagina-estreita"><p class="vazio">' + tr('Carregando…') + '</p></main>' };
  }
  if (conta.erroConexao) return { html: paginaEntrada('<div class="login-form"><h2>' + tr('Sem conexão') + '</h2><p class="login-erro">' + esc(conta.erroConexao) + '</p>' + htmlCaminhosEntrada() + '</div>') };
  if (conta.recuperandoSenha && p[0] !== 'nova-senha') return { trocar: '#/nova-senha' };
  if (p[0] === 'aceitar' && p[1]) guardarConvite(p[1]);

  if (!conta.sessao) {
    if (p[0] === 'criar-conta') return { html: telaCriarConta() };
    if (p[0] === 'conta-criada') return { html: telaContaCriada(p[1]) };
    if (p[0] === 'esqueci-senha') return { html: telaEsqueciSenha() };
    if (p[0] === 'aceitar') return { html: telaConviteSemLogin() };
    if (p[0] !== 'entrar') return { trocar: '#/entrar' };
    return { html: telaLoginOficial() };
  }
  if (p[0] === 'nova-senha') return { html: telaNovaSenha() };
  if (conta.membro && !conta.membro.ativo) {
    return { html: paginaEntrada('<div class="login-form"><h2>' + tr('Seu acesso foi desativado') + '</h2><p>' + tr('Fale com o administrador da sua empresa no KORbuild.') + '</p>' +
      '<p class="mudo pequeno">' + esc(emailAtual()) + '</p><button type="button" class="btn btn-contorno btn-bloco" data-acao="of-sair">' + tr('Sair') + '</button></div>') };
  }
  if (!conta.membro) {
    if (conviteGuardado()) return { html: telaAceitarConvite() };
    if (p[0] !== 'nova-empresa') return { trocar: '#/nova-empresa' };
    return { html: telaNovaEmpresa() };
  }
  if (p[0] !== 'conta') return { trocar: '#/conta' };
  const aba = p[1] || 'inicio';
  if (aba === 'usuarios' && pode('settings.acesso')) { relerAoAbrir(); return { html: moldura('usuarios', htmlUsuarios()) }; }
  if (aba === 'perfis' && pode('settings.acesso')) return { html: moldura('perfis', htmlPerfis()) };
  if (aba === 'empresa') return { html: moldura('empresa', htmlEmpresa()) };
  if (aba === 'perfil') return { html: moldura('perfil', htmlMeuPerfil()) };
  if (aba === 'diagnostico') return { html: moldura('perfil', htmlTelaDiagnostico()), depois: iniciarTelaDiagnostico };
  const cadastro = ABAS_CADASTROS.find(([k]) => k === aba);
  if (cadastro) {
    if (!pode(cadastro[2])) return { trocar: '#/conta' };
    const r = telaCadastro(aba, p.slice(2));
    return r.trocar ? r : { html: moldura(aba, r.html), depois: r.depois };
  }
  if (aba !== 'inicio') return { trocar: '#/conta' };
  return { html: moldura('inicio', htmlInicio()) };
}

/* ---------- Sem login ---------- */

const campo = (id, rotulo, html) => '<label for="' + id + '">' + rotulo + '</label>' + html;
const erroForm = '<p class="login-erro" id="login-erro" role="alert" hidden></p>';

function telaCriarConta() {
  return paginaEntrada('<form class="login-form" id="form-criar-conta" novalidate>' + htmlSeletorIdioma('login-idioma') +
    '<h2>' + tr('Criar a conta da sua empresa') + '</h2><p class="mudo">' + tr('Primeiro o seu acesso; depois, os dados da empresa.') + '</p>' +
    campo('cc-nome', tr('Seu nome'), '<input id="cc-nome" name="nome" autocomplete="name" required>') +
    campo('cc-email', tr('E-mail'), '<input id="cc-email" name="email" type="email" autocomplete="email" required>') +
    campo('cc-senha', tr('Senha (pelo menos 8 caracteres)'), '<input id="cc-senha" name="senha" type="password" autocomplete="new-password" minlength="8" required>') +
    erroForm + '<button type="submit" class="btn btn-primario btn-bloco btn-grande">' + tr('Criar conta') + '</button>' +
    '<p class="login-alternativa">' + tr('Já tem conta?') + ' <a href="#/entrar">' + tr('Entrar') + '</a></p>' + htmlCaminhosEntrada() + '</form>');
}

function telaContaCriada(email) {
  return paginaEntrada('<div class="login-form"><h2>' + tr('Confira o seu e-mail') + '</h2>' +
    '<p>' + tr('Enviamos um link de confirmação para {email}. Abra o link para ativar a conta; depois, entre com o seu e-mail e senha.', { email: '<b>' + esc(decodeURIComponent(email || '')) + '</b>' }) + '</p>' +
    '<p class="mudo pequeno">' + tr('Não chegou? Veja a caixa de spam ou espere alguns minutos.') + '</p>' +
    '<a class="btn btn-contorno btn-bloco" href="#/entrar">' + tr('Ir para a entrada') + '</a></div>');
}

function telaEsqueciSenha() {
  return paginaEntrada('<form class="login-form" id="form-esqueci-senha" novalidate>' + htmlSeletorIdioma('login-idioma') +
    '<h2>' + tr('Esqueci a senha') + '</h2><p class="mudo">' + tr('Enviamos um link para você escolher uma senha nova.') + '</p>' +
    campo('es-email', tr('E-mail'), '<input id="es-email" name="email" type="email" autocomplete="email" required>') +
    erroForm + '<button type="submit" class="btn btn-primario btn-bloco btn-grande">' + tr('Enviar o link') + '</button>' +
    '<p class="login-alternativa"><a href="#/entrar">' + tr('Voltar para a entrada') + '</a></p></form>');
}

function telaNovaSenha() {
  return paginaEntrada('<form class="login-form" id="form-nova-senha" novalidate>' +
    '<h2>' + tr('Escolha uma senha nova') + '</h2><p class="mudo">' + esc(emailAtual()) + '</p>' +
    campo('ns-senha', tr('Senha nova (pelo menos 8 caracteres)'), '<input id="ns-senha" name="senha" type="password" autocomplete="new-password" minlength="8" required>') +
    erroForm + '<button type="submit" class="btn btn-primario btn-bloco btn-grande">' + tr('Salvar a senha') + '</button></form>');
}

function telaConviteSemLogin() {
  return paginaEntrada('<div class="login-form">' + htmlSeletorIdioma('login-idioma') + '<h2>' + tr('Você foi convidado para o KORbuild') + '</h2>' +
    '<p>' + tr('Entre com o e-mail que recebeu o convite. Se ainda não tem acesso, crie a sua conta com esse mesmo e-mail: o convite fica guardado e você entra direto na empresa.') + '</p>' +
    '<div class="btn-linha"><a class="btn btn-primario" href="#/entrar">' + tr('Entrar') + '</a><a class="btn btn-contorno" href="#/criar-conta">' + tr('Criar conta') + '</a></div></div>');
}

/* ---------- Primeiro acesso (logado, sem empresa) ---------- */

function telaAceitarConvite() {
  return paginaEntrada('<div class="login-form"><h2>' + tr('Entrar na empresa') + '</h2>' +
    '<p>' + tr('Você tem um convite para entrar numa empresa no KORbuild com {email}.', { email: '<b>' + esc(emailAtual()) + '</b>' }) + '</p>' +
    erroForm + '<button type="button" class="btn btn-primario btn-bloco btn-grande" data-acao="of-aceitar">' + tr('Aceitar o convite') + '</button>' +
    '<button type="button" class="btn btn-contorno btn-bloco" data-acao="of-descartar-convite">' + tr('Não é para mim: criar a minha empresa') + '</button>' +
    '<button type="button" class="link" data-acao="of-sair">' + tr('Sair') + '</button></div>');
}

function telaNovaEmpresa() {
  const nome = (conta.sessao.user.user_metadata || {}).nome || '';
  return paginaEntrada('<form class="login-form" id="form-nova-empresa" novalidate>' + htmlSeletorIdioma('login-idioma') +
    '<h2>' + tr('Sua empresa') + '</h2><p class="mudo">' + tr('Uma conta por empresa. Você entra como Administrador e convida o seu pessoal depois.') + '</p>' +
    campo('ne-empresa', tr('Nome da empresa'), '<input id="ne-empresa" name="empresa" autocomplete="organization" required>') +
    campo('ne-atuacao', tr('Como a empresa atua'), '<select id="ne-atuacao" name="atuacao">' + Object.entries(ATUACOES).map(([k, n]) => '<option value="' + k + '">' + n + '</option>').join('') + '</select>') +
    campo('ne-pessoa', tr('Seu nome'), '<input id="ne-pessoa" name="pessoa" value="' + esc(nome) + '" autocomplete="name" required>') +
    erroForm + '<button type="submit" class="btn btn-primario btn-bloco btn-grande">' + tr('Criar a empresa') + '</button>' +
    '<p class="login-alternativa">' + esc(emailAtual()) + ' · <button type="button" class="link" data-acao="of-sair">' + tr('Sair') + '</button></p></form>');
}

/* ---------- Área da conta ---------- */

function moldura(ativa, conteudo) {
  const abas = [['inicio', tr('Início')]].concat(ABAS_CADASTROS.filter(([, , perm]) => pode(perm)).map(([k, nome]) => [k, tr(nome)]))
    .concat(pode('settings.acesso') ? [['usuarios', tr('Usuários')], ['perfis', tr('Perfis de acesso')]] : []).concat([['empresa', tr('Empresa')], ['perfil', tr('Meu perfil')]]);
  return '<header class="oficial-topo"><a class="oficial-marca" href="#/conta">' + marca(28) + logotipo() + '</a>' +
      '<span class="oficial-empresa"><b>' + esc(conta.empresa ? conta.empresa.nome : '') + '</b><span class="mudo pequeno">' + esc(conta.membro.nome) + ' · ' + esc(nomeDoPerfil(conta.perfil)) + '</span></span>' +
      htmlSeletorIdioma('oficial-idioma') + '<button type="button" class="btn btn-contorno btn-pequeno" data-acao="of-sair">' + tr('Sair') + '</button></header>' +
    '<main class="pagina pagina-larga oficial-pagina">' +
      '<nav class="abas-segmento" aria-label="' + tr('Seções') + '">' + abas.map(([k, r]) => '<a href="#/conta' + (k === 'inicio' ? '' : '/' + k) + '"' + (k === ativa ? ' class="ativa" aria-current="page"' : '') + '>' + r + '</a>').join('') + '</nav>' +
      htmlAvisoDoPlano() + htmlAvisoInstalar() + conteudo + '</main>';
}

/** Conta suspensa (só lê) ou teste vencido: o aviso fica no alto de toda tela da conta (docs/banco.md §15.6). */
function htmlAvisoDoPlano() {
  const pl = (conta.empresa && conta.empresa.plano) || {};
  const vencido = pl.status === 'teste' && /^\d{4}-\d{2}-\d{2}/.test(pl.teste_ate || '') && pl.teste_ate.slice(0, 10) < new Date().toISOString().slice(0, 10);
  if (pl.status !== 'suspensa' && !vencido) return '';
  return '<section class="aviso aviso-alerta aviso-plano" role="alert"><b>' + (pl.status === 'suspensa' ? tr('Esta conta está suspensa. Fale com o KORbuild.') : tr('Seu período de teste terminou: fale com o KORbuild.')) + '</b></section>';
}

/* Diagnóstico do aparelho (js/diagnostico.js): a mesma tela da página avulsa diagnostico.html, com o que só o app sabe (usuário e fila de envio). */
function htmlTelaDiagnostico() {
  return '<section class="cartao"><h1 class="oficial-titulo">' + tr('Diagnóstico do aparelho') + '</h1><p class="mudo">' + tr('Para quando algo não funciona neste celular: veja o que está errado e mande o relatório para quem está ajudando.') + '</p></section><div id="diag-raiz"></div>';
}
function iniciarTelaDiagnostico() {
  iniciarDiagnostico(document.getElementById('diag-raiz'), async () => {
    let pendentesDiario = null, pendentesPonto = null;
    try { const m = await import('./sincronizacao.js'); pendentesDiario = m.pendentesNoAparelho(); pendentesPonto = m.pendentesDoPonto(); } catch { /* sem fila para mostrar */ }
    return { usuario: String((conta.sessao && conta.sessao.user && conta.sessao.user.id) || '').slice(0, 8), perfil: nomeDoPerfil(conta.perfil), pendentesDiario, pendentesPonto };
  });
}

function htmlInicio() {
  return '<section class="cartao"><h1 class="oficial-titulo">' + tr('Olá, {nome}', { nome: esc(conta.membro.nome.split(' ')[0]) }) + '</h1>' +
      '<dl class="lista-dados"><dt>' + tr('Empresa') + '</dt><dd>' + esc(conta.empresa.nome) + ' · ' + esc(ATUACOES[conta.empresa.atuacao] || '') + '</dd>' +
      '<dt>' + tr('Seu acesso') + '</dt><dd>' + esc(nomeDoPerfil(conta.perfil)) + ' · ' + esc(emailAtual()) + '</dd>' +
      '<dt>' + tr('Plano') + '</dt><dd>' + esc(nomeDoPlano((conta.empresa.plano || {}).nome)) + '</dd></dl></section>' +
    (pode('daily.preencher') || pode('daily.acompanhar') || pode('daily.aprovar')
      ? '<section class="cartao"><h2 class="cartao-titulo">Daily</h2><p>' + tr('O diário de obra e o cronograma já funcionam com o banco de dados, com e sem internet: preencha no canteiro, envie, aprove, mande o link para o cliente e acompanhe as etapas da obra.') + '</p>' +
        '<div class="btn-linha"><a class="btn btn-primario" href="#/daily">' + icone('daily', 18) + tr('Abrir o Daily') + '</a></div></section>'
      : '') +
    (conta.empresa.atuacao !== 'construtora' && ['crew.ponto.proprio', 'crew.ponto.equipe', 'crew.acompanhar'].some((x) => pode(x))
      ? '<section class="cartao"><h2 class="cartao-titulo">Crew</h2><p>' + tr('O ponto da equipe já funciona com o banco de dados, com e sem internet: bata a entrada, o intervalo e a saída no celular; o escritório confere, ajusta e aprova a semana.') + '</p>' +
        '<div class="btn-linha"><a class="btn btn-primario" href="#/crew">' + icone('relogio', 18) + tr('Abrir o Crew') + '</a></div></section>'
      : '') +
    (conta.empresa.atuacao !== 'construtora' && pode('measure.medir')
      ? '<section class="cartao"><h2 class="cartao-titulo">Measure</h2><p>' + tr('A medição de plantas já funciona com o banco de dados, no computador: envie o PDF, defina a escala, meça, monte o catálogo e emita a proposta.') + '</p>' +
        '<div class="btn-linha"><a class="btn btn-primario" href="#/measure">' + icone('tabela', 18) + tr('Abrir o Measure') + '</a></div></section>'
      : '') +
    (pode('concorrencias.gerir')
      ? '<section class="cartao"><h2 class="cartao-titulo">' + tr('Concorrências') + '</h2><p>' + tr('As concorrências já funcionam com o banco de dados: convide prestadoras, receba propostas (pela plataforma ou por link), compare e feche; a obra da vencedora nasce ligada à sua.') + '</p>' +
        '<div class="btn-linha"><a class="btn btn-primario" href="#/daily/concorrencias">' + icone('tabela', 18) + tr('Abrir as concorrências') + '</a></div></section>'
      : '') +
    (conta.ehAdmin
      ? '<section class="cartao"><h2 class="cartao-titulo">' + tr('Administração da plataforma (KORbuild)') + '</h2>' +
        '<div class="btn-linha"><a class="btn btn-contorno" href="admin.html">' + tr('Administração da plataforma') + '</a></div></section>'
      : '') +
    '<section class="cartao"><h2 class="cartao-titulo">' + tr('Os módulos chegam em etapas') + '</h2>' +
      '<p>' + tr('A conta, os cadastros, o Daily (com o cronograma da obra), o Crew, o Measure e as concorrências já estão no banco de dados. Os avisos por e-mail chegam na próxima etapa.') + '</p>' +
      '<p>' + tr('Enquanto isso, conheça cada módulo no protótipo, com dados de exemplo.') + '</p>' +
      '<div class="btn-linha"><a class="btn btn-primario" href="' + URL_PROTOTIPO + '">' + icone('play', 18) + tr('Abrir o protótipo') + '</a><a class="btn btn-contorno" href="' + URL_PORTAL + (idioma() === 'pt' ? 'pt/' : '') + '">' + tr('Especificações e manual') + '</a></div></section>';
}

function htmlUsuarios() {
  const nomePerfil = (id) => nomeDoPerfil(conta.perfis.find((p) => p.id === id)) || '—';
  const opcoesPerfil = (atual) => conta.perfis.map((p) => '<option value="' + p.id + '"' + (p.id === atual ? ' selected' : '') + '>' + esc(nomeDoPerfil(p)) + '</option>').join('');
  const pendentes = conta.convites.filter((c) => !c.aceito_em && !c.cancelado_em && new Date(c.expira_em) > new Date());
  return '<section class="cartao"><div class="cartao-cabeca"><h2 class="cartao-titulo">' + tr('Usuários') + '</h2><span class="mudo pequeno">' + conta.membros.length + '</span></div>' +
      '<div class="tabela-rolagem"><table class="tabela tabela-membros"><thead><tr><th>' + tr('Nome') + '</th><th>' + tr('Perfil de acesso') + '</th><th>' + tr('Situação') + '</th><th>' + tr('Último acesso') + '</th><th></th></tr></thead><tbody>' +
      conta.membros.map((m) => {
        const eu = m.id === conta.membro.id;
        return '<tr><td><b>' + esc(m.nome) + '</b>' + (eu ? ' <span class="mudo pequeno">(' + tr('você') + ')</span>' : '') + '</td>' +
          '<td>' + (eu ? esc(nomePerfil(m.perfil_id)) : '<select data-acao-mudar="of-perfil-membro" data-id="' + m.id + '" aria-label="' + esc(tr('Perfil de {nome}', { nome: m.nome })) + '">' + opcoesPerfil(m.perfil_id) + '</select>') + '</td>' +
          '<td>' + (m.ativo ? '<span class="etiqueta etiqueta-verde">' + tr('Ativo') + '</span>' : '<span class="etiqueta etiqueta-neutro">' + tr('Desativado') + '</span>') + '</td>' +
          '<td>' + (m.ultimo_acesso ? dataHora(new Date(m.ultimo_acesso).getTime()) : '<span class="mudo">—</span>') + '</td>' +
          '<td>' + (eu ? '' : '<button type="button" class="btn btn-contorno btn-pequeno" data-acao="of-ativar" data-id="' + m.id + '" data-ativo="' + (m.ativo ? '' : '1') + '">' + (m.ativo ? tr('Desativar') : tr('Reativar')) + '</button>') + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<p class="mudo pequeno">' + tr('Ninguém altera o próprio acesso, e a empresa sempre mantém alguém ativo que cuide dos acessos.') + '</p></section>' +
    '<section class="cartao"><h2 class="cartao-titulo">' + tr('Convidar alguém') + '</h2>' +
      '<form id="form-convidar" class="grade-campos" novalidate data-sem-envio>' +
        '<div class="campo"><label class="rotulo-pequeno" for="cv-email">' + tr('E-mail') + '</label><input id="cv-email" name="email" type="email" required></div>' +
        '<div class="campo"><label class="rotulo-pequeno" for="cv-nome">' + tr('Nome') + '</label><input id="cv-nome" name="nome"></div>' +
        '<div class="campo"><label class="rotulo-pequeno" for="cv-perfil">' + tr('Perfil de acesso') + '</label><select id="cv-perfil" name="perfil">' + opcoesPerfil((conta.perfis.find((p) => p.chave === 'gestor') || {}).id) + '</select></div>' +
      '</form>' +
      '<div class="btn-linha"><button type="button" class="btn btn-primario" data-acao="of-convidar">' + tr('Gerar o convite') + '</button></div>' +
      '<div id="link-convite"></div>' +
      '<p class="mudo pequeno">' + tr('Por enquanto, o convite é um link para você mandar à pessoa (vale 7 dias, uma vez só, para aquele e-mail). O envio por e-mail chega numa próxima etapa.') + '</p>' +
      (pendentes.length ? '<h3 class="rotulo-pequeno">' + tr('Convites pendentes') + '</h3><ul class="lista-simples">' + pendentes.map((c) => '<li><b>' + esc(c.email) + '</b> · ' + esc(nomePerfil(c.perfil_id)) + ' · ' + tr('vale até {quando}', { quando: dataHora(new Date(c.expira_em).getTime()) }) +
        ' <button type="button" class="link" data-acao="of-cancelar-convite" data-id="' + c.id + '">' + tr('Cancelar') + '</button></li>').join('') + '</ul>' : '') +
    '</section>';
}

function htmlPerfis() {
  return conta.perfis.map((p) => {
    const travado = p.sistema;
    const usado = conta.membros.filter((m) => m.perfil_id === p.id).length;
    return '<section class="cartao perfil-cartao" data-perfil="' + p.id + '"><div class="cartao-cabeca"><h2 class="cartao-titulo">' + esc(nomeDoPerfil(p)) + '</h2>' +
        '<span class="mudo pequeno">' + (usado === 1 ? tr('1 usuário') : tr('{n} usuários', { n: usado })) + (travado ? ' · ' + tr('travado') : '') + '</span></div>' +
        (p.descricao ? '<p class="mudo pequeno">' + esc(descricaoDoPerfil(p)) + '</p>' : '') +
        '<div class="perfil-grupos">' + PERMISSOES.map((g) => '<fieldset><legend class="rotulo-pequeno">' + esc(g.grupo) + '</legend>' + g.itens.map((i) =>
          '<label class="check pequeno"><input type="checkbox" name="perm" value="' + i.id + '"' + (p.permissoes.includes(i.id) ? ' checked' : '') + (travado ? ' disabled' : '') + '> ' + esc(i.nome) + '</label>').join('') + '</fieldset>').join('') + '</div>' +
        (travado ? '' : '<div class="btn-linha"><button type="button" class="btn btn-primario btn-pequeno" data-acao="of-salvar-perfil" data-id="' + p.id + '">' + tr('Salvar permissões') + '</button>' +
          (p.chave ? '' : '<button type="button" class="btn btn-contorno btn-pequeno" data-acao="of-excluir-perfil" data-id="' + p.id + '">' + tr('Excluir') + '</button>') + '</div>') + '</section>';
  }).join('') +
  '<section class="cartao"><h2 class="cartao-titulo">' + tr('Novo perfil') + '</h2><form id="form-novo-perfil" class="grade-campos" novalidate data-sem-envio>' +
    '<div class="campo"><label class="rotulo-pequeno" for="np-nome">' + tr('Nome') + '</label><input id="np-nome" name="nome" required></div>' +
    '<div class="campo"><label class="rotulo-pequeno" for="np-base">' + tr('A partir de') + '</label><select id="np-base" name="base">' + conta.perfis.map((p) => '<option value="' + p.id + '">' + esc(nomeDoPerfil(p)) + '</option>').join('') + '</select></div></form>' +
    '<div class="btn-linha"><button type="button" class="btn btn-contorno" data-acao="of-novo-perfil">' + tr('Criar perfil') + '</button></div></section>';
}

const CAMPOS_EMPRESA = [['nome', 'Nome da empresa'], ['razao_social', 'Razão social'], ['ein', 'EIN'], ['endereco', 'Endereço'], ['cidade', 'Cidade'], ['estado', 'Estado'], ['zip', 'ZIP code'], ['telefone', 'Telefone'], ['email', 'E-mail'], ['site', 'Site']];
function htmlEmpresa() {
  const e = conta.empresa;
  const edita = pode('settings.conta');
  return '<section class="cartao"><h2 class="cartao-titulo">' + tr('Empresa') + '</h2><form id="form-empresa" class="grade-campos" novalidate data-sem-envio>' +
    CAMPOS_EMPRESA.map(([k, r]) => '<div class="campo"><label class="rotulo-pequeno" for="em-' + k + '">' + tr(r) + '</label><input id="em-' + k + '" name="' + k + '" value="' + esc(e[k] || '') + '"' + (edita ? '' : ' readonly') + (k === 'estado' ? ' maxlength="2"' : '') + '></div>').join('') + '</form>' +
    (edita ? '<div class="btn-linha"><button type="button" class="btn btn-primario" data-acao="of-salvar-empresa">' + tr('Salvar') + '</button></div>' : '<p class="mudo pequeno">' + tr('Só quem tem a permissão Empresa, conta e plano altera estes dados.') + '</p>') +
    '<p class="mudo pequeno">' + tr('Como a empresa atua: {atuacao}. Módulos: {modulos}.', { atuacao: esc(ATUACOES[e.atuacao] || ''), modulos: esc((e.modulos || []).join(', ')) }) + '</p></section>';
}

/* Meu perfil: nome e telefone (o cadastro na empresa), idioma, e-mail de acesso e senha. */
/* Quais avisos chegam também por e-mail (o sininho mostra todos). Sem escolha, tudo ligado. */
function htmlAvisosPorEmail() {
  if (!prefsLidas()) lerPrefs().then(() => redesenhar()).catch(() => { /* fica o padrão */ });
  return '<section class="cartao"><h2 class="cartao-titulo">' + tr('Avisos por e-mail') + '</h2>' +
    '<p>' + tr('O sininho mostra todos os avisos. Aqui você escolhe quais deles também chegam por e-mail, em {email}.', { email: '<b>' + esc(emailAtual()) + '</b>' }) + '</p>' +
    CATEGORIAS_DE_EMAIL.map((c) => '<label class="check"><input type="checkbox" data-acao="of-pref-email" data-categoria="' + c + '"' + (recebePorEmail(c) ? ' checked' : '') + '> ' + textoDaCategoria[c]() + '</label>').join('') +
    '<p class="mudo pequeno">' + tr('Os convites para entrar numa empresa ou numa concorrência sempre chegam por e-mail.') + '</p></section>';
}

function htmlMeuPerfil() {
  const m = conta.membro;
  const pendente = emailPendente();
  const linha = (id, rotulo, html) => '<div class="campo"><label class="rotulo-pequeno" for="' + id + '">' + rotulo + '</label>' + html + '</div>';
  return '<section class="cartao"><h2 class="cartao-titulo">' + tr('Seus dados') + '</h2>' +
      '<form id="form-meu-perfil" class="grade-campos" novalidate data-sem-envio>' +
        linha('mp-nome', tr('Nome'), '<input id="mp-nome" name="nome" type="text" value="' + esc(m.nome) + '" autocomplete="name">') +
        linha('mp-telefone', tr('Telefone'), '<input id="mp-telefone" name="telefone" type="tel" value="' + esc(m.telefone || '') + '" autocomplete="tel">') +
      '</form>' +
      '<div class="btn-linha"><button type="button" class="btn btn-primario" data-acao="of-salvar-meu-perfil">' + tr('Salvar') + '</button></div>' +
      '<p class="mudo pequeno">' + tr('Perfil de acesso: {perfil}. Só quem cuida dos acessos da empresa muda o perfil.', { perfil: esc(nomeDoPerfil(conta.perfil)) }) + '</p></section>' +
    '<section class="cartao"><h2 class="cartao-titulo">' + tr('Idioma') + '</h2>' +
      '<p>' + tr('O idioma das telas vale também para os e-mails que o KORbuild manda para você.') + '</p>' + htmlSeletorIdioma('perfil-idioma') + '</section>' +
    htmlAvisosPorEmail() +
    '<section class="cartao"><h2 class="cartao-titulo">' + tr('E-mail de acesso') + '</h2>' +
      '<p>' + tr('Você entra com {email}.', { email: '<b>' + esc(emailAtual()) + '</b>' }) + '</p>' +
      (pendente ? '<div class="aviso aviso-ambar"><span>' + tr('Aguardando a confirmação de {email}: abra o link que enviamos para esse endereço.', { email: '<b>' + esc(pendente) + '</b>' }) + '</span></div>' : '') +
      '<form id="form-trocar-email" class="grade-campos" novalidate data-sem-envio>' +
        linha('mp-email', tr('E-mail novo'), '<input id="mp-email" name="email" type="email" autocomplete="email">') +
      '</form>' +
      '<div class="btn-linha"><button type="button" class="btn btn-contorno" data-acao="of-trocar-email">' + tr('Trocar o e-mail') + '</button></div>' +
      '<p class="mudo pequeno">' + tr('O e-mail só muda depois que você abrir o link enviado para o endereço novo. A empresa, o perfil e o histórico continuam os mesmos.') + '</p></section>' +
    '<section class="cartao"><h2 class="cartao-titulo">' + tr('Senha') + '</h2>' +
      '<form id="form-trocar-senha" class="grade-campos" novalidate data-sem-envio>' +
        linha('mp-senha', tr('Senha nova (pelo menos 8 caracteres)'), '<input id="mp-senha" name="senha" type="password" autocomplete="new-password" minlength="8">') +
        linha('mp-senha2', tr('Repita a senha nova'), '<input id="mp-senha2" name="senha2" type="password" autocomplete="new-password" minlength="8">') +
      '</form>' +
      '<div class="btn-linha"><button type="button" class="btn btn-contorno" data-acao="of-trocar-senha">' + tr('Trocar a senha') + '</button></div></section>';
}

/* ---------- Ações ---------- */

function mostrarErro(texto) {
  const el = document.getElementById('login-erro');
  if (el) { el.textContent = texto; el.hidden = false; } else toast(texto);
}
const ir = (hash) => { if (location.hash === hash) redesenhar(); else location.hash = hash; };

/* Formulários das telas de entrada: devolve true se o formulário é da página oficial. */
export async function enviarFormOficial(form) {
  const v = (n) => (form.elements[n] ? form.elements[n].value : '');
  const botao = form.querySelector('button[type="submit"]');
  if (botao) botao.disabled = true;
  try {
    if (form.id === 'form-login-oficial') {
      const r = await entrar(v('email'), v('senha'));
      if (r.erro) return mostrarErro(r.erro);
      return ir(conta.membro ? '#/conta' : '#/nova-empresa');
    }
    if (form.id === 'form-criar-conta') {
      const r = await cadastrar(v('nome'), v('email'), v('senha'));
      if (r.erro) return mostrarErro(r.erro);
      if (r.data && r.data.session) return ir('#/nova-empresa'); // confirmação desligada: já entra
      return ir('#/conta-criada/' + encodeURIComponent(v('email').trim()));
    }
    if (form.id === 'form-esqueci-senha') {
      const r = await pedirNovaSenha(v('email'));
      if (r.erro) return mostrarErro(r.erro);
      toast(tr('Se houver uma conta com esse e-mail, o link chega em alguns minutos.'));
      return ir('#/entrar');
    }
    if (form.id === 'form-nova-senha') {
      const r = await definirNovaSenha(v('senha'));
      if (r.erro) return mostrarErro(r.erro);
      toast(tr('Senha alterada.'));
      return ir('#/conta');
    }
    if (form.id === 'form-nova-empresa') {
      const r = await criarEmpresa({ nome: v('empresa'), atuacao: v('atuacao'), nome_pessoa: v('pessoa') });
      if (r.erro) return mostrarErro(r.erro);
      toast(tr('Empresa criada. Você é o Administrador.'));
      return ir('#/conta');
    }
  } finally { if (botao) botao.disabled = false; }
  return false;
}
export const FORMS_OFICIAIS = ['form-login-oficial', 'form-criar-conta', 'form-esqueci-senha', 'form-nova-senha', 'form-nova-empresa'];

const comResultado = (r, ok) => { if (r.erro) { toast(r.erro); return; } if (ok) toast(ok); redesenhar(); };

export const acoesOficiais = {
  async 'of-sair'() { await sair(); esquecerConvite(); esquecerCadastros(); espelho.pronto = false; ir('#/entrar'); },
  async 'of-aceitar'() {
    const r = await aceitarConvite(conviteGuardado());
    if (r.erro) return mostrarErro(r.erro);
    esquecerConvite();
    toast(tr('Boas-vindas à empresa.'));
    ir('#/conta');
  },
  'of-descartar-convite'() { esquecerConvite(); ir('#/nova-empresa'); },
  async 'of-convidar'() {
    const f = document.getElementById('form-convidar');
    const r = await convidar(f.email.value, f.nome.value, f.perfil.value);
    if (r.erro) { toast(r.erro); return; }
    redesenhar();
    const area = document.getElementById('link-convite');
    if (area) {
      area.innerHTML = '<div class="aviso aviso-verde"><b>' + tr('Convite criado') + '</b><span>' + tr('Mande este link para a pessoa:') + '</span>' +
        '<input type="text" readonly value="' + esc(r.link) + '" class="oficial-link"><button type="button" class="btn btn-contorno btn-pequeno" data-acao="of-copiar" data-link="' + esc(r.link) + '">' + tr('Copiar o link') + '</button></div>';
    }
  },
  async 'of-copiar'(el) {
    try { await navigator.clipboard.writeText(el.dataset.link); toast(tr('Link copiado.')); } catch (e) { toast(tr('Selecione o link e copie.')); }
  },
  async 'of-cancelar-convite'(el) { comResultado(await cancelarConvite(el.dataset.id), tr('Convite cancelado.')); },
  async 'of-ativar'(el) {
    const ativo = !!el.dataset.ativo;
    if (!ativo && !(await confirmar(tr('Desativar este usuário?'), tr('A pessoa deixa de entrar no KORbuild. O histórico fica, e dá para reativar depois.'), tr('Desativar')))) return;
    comResultado(await ativarMembro(el.dataset.id, ativo), ativo ? tr('Usuário reativado.') : tr('Usuário desativado.'));
  },
  async 'of-salvar-perfil'(el) {
    const caixa = document.querySelector('[data-perfil="' + el.dataset.id + '"]');
    const marcadas = new Set(Array.from(caixa.querySelectorAll('[name="perm"]:checked')).map((i) => i.value));
    // dependências automáticas: aprovar inclui acompanhar, ver custos inclui acompanhar… (SET-062)
    for (const id of Array.from(marcadas)) for (const req of (permissao(id) || {}).requer || []) marcadas.add(req);
    comResultado(await salvarPermissoes(el.dataset.id, Array.from(marcadas)), tr('Permissões salvas.'));
  },
  async 'of-excluir-perfil'(el) {
    if (!(await confirmar(tr('Excluir este perfil?'), '', tr('Excluir')))) return;
    comResultado(await excluirPerfil(el.dataset.id), tr('Perfil excluído.'));
  },
  async 'of-novo-perfil'() {
    const f = document.getElementById('form-novo-perfil');
    comResultado(await criarPerfil(f.nome.value, f.base.value), tr('Perfil criado.'));
  },
  async 'of-salvar-meu-perfil'() {
    const f = document.getElementById('form-meu-perfil');
    comResultado(await atualizarMeuPerfil(f.nome.value, f.telefone.value), tr('Seus dados foram salvos.'));
  },
  async 'of-pref-email'(el) {
    const r = await salvarPrefEmail(el.dataset.categoria, el.checked);
    if (r.erro) { el.checked = !el.checked; toast(r.erro); return; }
    toast(el.checked ? tr('Você vai receber esses avisos por e-mail.') : tr('Esses avisos não vão mais por e-mail. Continuam no sininho.'));
  },
  async 'of-trocar-email'() {
    const f = document.getElementById('form-trocar-email');
    const r = await trocarEmail(f.email.value);
    if (r.erro) { toast(r.erro); return; }
    toast(tr('Enviamos um link para {email}. O e-mail muda quando você abrir o link.', { email: f.email.value.trim() }));
    redesenhar();
  },
  async 'of-trocar-senha'() {
    const f = document.getElementById('form-trocar-senha');
    if (f.senha.value !== f.senha2.value) { toast(tr('As duas senhas não são iguais.')); return; }
    const r = await definirNovaSenha(f.senha.value);
    if (r.erro) { toast(r.erro); return; }
    f.reset();
    toast(tr('Senha alterada.'));
  },
  async 'of-salvar-empresa'() {
    const f = document.getElementById('form-empresa');
    const mudancas = {};
    for (const [k] of CAMPOS_EMPRESA) mudancas[k] = k === 'estado' ? f[k].value.trim().toUpperCase() : f[k].value.trim();
    comResultado(await salvarEmpresa(mudancas), tr('Dados da empresa salvos.'));
  },
};

/* O perfil de um usuário muda pela lista (select). */
export async function mudarOficial(el) {
  if (el.dataset.acaoMudar !== 'of-perfil-membro') return false;
  comResultado(await mudarPerfilDoMembro(el.dataset.id, el.value), tr('Perfil alterado.'));
  return true;
}
