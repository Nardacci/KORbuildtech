/* KORbuild — telas da página oficial (sem "?demo"), com a conta de verdade no Supabase (docs/banco.md, fatia 1):
 * entrar, criar conta, esqueci a senha / nova senha, aceitar convite, criar a empresa no primeiro acesso,
 * e a área da conta: início, usuários (convites), perfis de acesso e empresa. Os módulos chegam nas próximas fatias. */

import { PRIMEIRA_VERSAO, NOME_MEASURE, MODULOS_DA_VERSAO } from './versao.js';
import { esc, toast, confirmar, dataHora, abrirPainel } from './util.js';
import { iniciais, quando, cabecalhoDePagina, botaoCriar, barraDeBusca, atributosDeLinha, gradeEmCartao, avatar, campoPainel } from './padrao-cadastro.js';
import { tr, idioma, htmlSeletorIdioma, nomeDoPlano } from './i18n.js';
import { paginaEntrada, htmlCaminhosEntrada, telaLoginOficial, URL_PROTOTIPO, URL_PORTAL, usuarioAtual, sino, botaoModulos, menuUsuario, hrefManual, CONTROLE_DE_TESTE } from './plataforma.js';
import { icone, marca, logotipo } from './icones.js';
import { PERMISSOES, permissao } from './settings.js';
import { ATUACOES } from './contatos.js';
import {
  conta, iniciar, aoMudar, carregarMinhaConta, pode, emailAtual, entrar, cadastrar, pedirNovaSenha, definirNovaSenha, sair, criarEmpresa,
  aceitarConvite, convidar, salvarEmpresa, atualizarMeuPerfil, trocarEmail, emailPendente, salvarPermissoes, mudarPerfilDoMembro, ativarMembro, cancelarConvite, criarPerfil, excluirPerfil, salvarMembro, salvarPerfil, criarUsuarioDireto, novaSenhaProvisoria,
} from './conta.js';
import { telaCadastro, ABAS_CADASTROS, ligarCadastros, acoesCadastros } from './cadastros-telas.js';
import { esquecer as esquecerCadastros } from './cadastros.js';
import { espelho } from './espelho.js';
import { estado, bancoDeDados } from './armazem.js';
import { calcularInicio } from './inicio-calculo.js';
import { htmlPainelInicio } from './inicio-dashboard.js';
import { listaDeCotacao } from './measure-relatorios.js';
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
    if (!pode(cadastro[2]) || (PRIMEIRA_VERSAO && !['contatos', 'funcoes'].includes(cadastro[0]))) return { trocar: '#/conta' };
    const r = telaCadastro(aba, p.slice(2));
    return r.trocar ? r : { html: moldura(aba, r.html), depois: r.depois };
  }
  if (aba !== 'inicio') return { trocar: '#/conta' };
  if (temPainelDoInicio() && espelhoProntoParaOInicio()) return { html: moldura('inicio', htmlInicioComPainel(), { cheio: true }) };
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
    ((((conta.sessao || {}).user || {}).user_metadata || {}).trocar_senha ? '<p class="aviso aviso-ambar pequeno">' + tr('Você entrou com a senha provisória que o administrador passou. Escolha agora a sua: só você vai saber.') + '</p>' : '') +
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

const ICONES_DO_SETTINGS = { obras: 'obras', contatos: 'crew', funcionarios: 'crew', funcoes: 'dinheiro', regras: 'settings', usuarios: 'crew', perfis: 'aprovacoes', empresa: 'conta', perfil: 'settings' };
/* O lado direito do cabeçalho: na 1ª versão, o mesmo do Takeoff (sininho, módulos e o menu do usuário, com idioma e Sair dentro);
 * enquanto o espelho da empresa não carregou (ou fora da 1ª versão), o seletor de idioma e o botão Sair. */
function ladoDireitoDoTopo() {
  const u = PRIMEIRA_VERSAO && espelho.pronto && estado() && estado().oficial ? usuarioAtual() : null;
  if (u) return sino(u) + botaoModulos(u) + menuUsuario(u);
  return htmlSeletorIdioma('oficial-idioma') + (PRIMEIRA_VERSAO ? botaoModulos(null) : '') + '<a class="btn btn-contorno btn-pequeno" id="menu-manual" href="' + hrefManual() + '" download target="_blank" rel="noopener">' + icone('baixar', 16) + '<span>' + tr('Manual (PDF)') + '</span></a><button type="button" class="btn btn-contorno btn-pequeno" data-acao="of-sair">' + tr('Sair') + '</button>';
}

/* A moldura da área da conta. Na 1ª versão: o Início é o painel, em tela cheia (opcoes.cheio), e as outras telas do Settings têm o menu
 * lateral, como o Takeoff (no celular o menu vira as abas de sempre). */
function moldura(ativa, conteudo, opcoes = {}) {
  const abas = [['inicio', tr('Início')]].concat(ABAS_CADASTROS.filter(([k, , perm]) => pode(perm) && (!PRIMEIRA_VERSAO || k === 'contatos' || k === 'funcoes')).map(([k, nome]) => [k, tr(nome)]))
    .concat(pode('settings.acesso') ? [['usuarios', tr('Usuários')], ['perfis', tr('Perfis de acesso')]] : []).concat([['empresa', tr('Empresa')], ['perfil', tr('Meu perfil')]]);
  const topo = '<header class="oficial-topo"><a class="oficial-marca" href="#/conta">' + marca(28) + logotipo({ produto: false }) + '</a>' + (PRIMEIRA_VERSAO ? '<span class="oficial-secao">/ ' + (opcoes.cheio ? tr('Início') : 'Settings') + '</span>' : '') +
      '<span class="oficial-empresa"><b>' + esc(conta.empresa ? conta.empresa.nome : '') + '</b><span class="mudo pequeno">' + esc(conta.membro.nome) + ' · ' + esc(nomeDoPerfil(conta.perfil)) + '</span></span>' +
      ladoDireitoDoTopo() + '</header>';
  const href = (k) => '#/conta' + (k === 'inicio' ? '' : '/' + k);
  const avisos = htmlAvisoDoPlano() + htmlAvisoInstalar();
  if (PRIMEIRA_VERSAO && opcoes.cheio) return topo + '<main class="oficial-pagina ini-pagina">' + avisos + conteudo + '</main>';
  const segmento = '<nav class="abas-segmento' + (PRIMEIRA_VERSAO ? ' so-celular' : '') + '" aria-label="' + tr('Seções') + '">' + abas.map(([k, r]) => '<a href="' + href(k) + '"' + (k === ativa ? ' class="ativa" aria-current="page"' : '') + '>' + r + '</a>').join('') + '</nav>';
  if (!PRIMEIRA_VERSAO) return topo + '<main class="pagina pagina-larga oficial-pagina">' + segmento + avisos + conteudo + '</main>';
  const lateral = '<nav class="lateral" aria-label="' + tr('Seções') + '"><span class="lateral-titulo">Settings</span>' +
    abas.map(([k, r]) => '<a class="lateral-item' + (k === ativa ? ' ativo' : '') + '" href="' + href(k) + '"' + (k === ativa ? ' aria-current="page"' : '') + '>' + icone(k === 'inicio' ? 'painel' : (ICONES_DO_SETTINGS[k] || 'settings')) + '<span>' + r + '</span></a>').join('') + '</nav>';
  return topo + '<div class="corpo com-lateral">' + lateral + '<main class="pagina pagina-larga oficial-pagina" id="conteudo">' + segmento + avisos + conteudo + '</main></div>';
}

/** Conta suspensa (só lê) ou teste vencido: o aviso fica no alto de toda tela da conta (docs/banco.md §15.6). */
function htmlAvisoDoPlano() {
  const pl = (conta.empresa && conta.empresa.plano) || {};
  const vencido = CONTROLE_DE_TESTE && pl.status === 'teste' && /^\d{4}-\d{2}-\d{2}/.test(pl.teste_ate || '') && pl.teste_ate.slice(0, 10) < new Date().toISOString().slice(0, 10);
  if (pl.status !== 'suspensa' && !vencido) return '';
  return '<section class="aviso aviso-alerta aviso-plano" role="alert"><b>' + (pl.status === 'suspensa' ? tr('Esta conta está suspensa. Fale com o KORbuild.') : tr('Seu período de teste terminou: fale com o KORbuild.')) + '</b></section>';
}

/* Diagnóstico do aparelho (js/diagnostico.js): a mesma tela da página avulsa diagnostico.html, com o que só o app sabe (usuário e fila de envio). */
function htmlTelaDiagnostico() {
  return '<section class="cartao"><h1 class="oficial-titulo">' + tr('Diagnóstico do aparelho') + '</h1><p class="mudo">' + tr('Para quando algo não funciona neste celular: veja o que está errado e mande o relatório para quem está ajudando.') + '</p></section><div id="diag-raiz"></div>';
}
function iniciarTelaDiagnostico() {
  iniciarDiagnostico(document.getElementById('diag-raiz'), async () => {
    let pendentesDiario = null, pendentesPonto = null, cofre = null;
    try { cofre = (await import('./armazem.js')).cofreDasFotos(); } catch { /* sem armazém */ }
    try { const m = await import('./sincronizacao.js'); pendentesDiario = m.pendentesNoAparelho(); pendentesPonto = m.pendentesDoPonto(); } catch { /* sem fila para mostrar */ }
    return { usuario: String((conta.sessao && conta.sessao.user && conta.sessao.user.id) || '').slice(0, 8), perfil: nomeDoPerfil(conta.perfil), pendentesDiario, pendentesPonto, cofre };
  });
}

/* O painel do Início (1ª versão): para quem mede, convida ou responde convites. Precisa do espelho do banco (o app o carrega ao abrir o Início). */
export const temPainelDoInicio = () => PRIMEIRA_VERSAO && !!conta.membro && (pode('measure.medir') || pode('concorrencias.gerir') || pode('concorrencias.responder'));
export const espelhoProntoParaOInicio = () => !!(espelho.pronto && estado() && estado().oficial && conta.empresa && estado().empresa.id === conta.empresa.id);
function htmlPainel(cabeca, rodape) {
  const medir = pode('measure.medir');
  const ver = { medir, dinheiro: medir && (pode('measure.catalogo') || pode('crew.custos')), concorrenciasEnviadas: pode('concorrencias.gerir'), concorrenciasRecebidas: pode('concorrencias.responder'), obras: !PRIMEIRA_VERSAO && (pode('settings.obras') || medir), semObra: PRIMEIRA_VERSAO };
  const dados = { ...estado(), concorrencias: (bancoDeDados() || {}).concorrencias || [] };   // as concorrências ficam fora das empresas, numa lista só
  const calc = calcularInicio(dados, { eu: conta.empresa.id, agora: Date.now(), ver, itensDaLista: (id) => { try { return listaDeCotacao(id).total; } catch { return 0; } } });
  return htmlPainelInicio(calc, { ver, cabeca, rodape });
}
function htmlInicioComPainel() {
  const rotaDoSettings = !PRIMEIRA_VERSAO && pode('settings.obras') ? '#/conta/obras' : pode('settings.contatos') ? '#/conta/contatos' : '#/conta/empresa';
  const rotaDoTakeoff = pode('measure.medir') ? '#/measure' : '#/measure/convites';
  const temDaily = pode('daily.preencher') || pode('daily.acompanhar') || pode('daily.aprovar');
  const cabeca = '<header class="ini-topo"><div class="ini-saudacao"><h1 class="ini-ola">' + tr('Olá, {nome}', { nome: esc(conta.membro.nome.split(' ')[0]) }) + '</h1>' +
      '<p class="ini-sub">' + esc(conta.empresa.nome) + ' · ' + esc(ATUACOES[conta.empresa.atuacao] || '') + ' · ' + esc(nomeDoPerfil(conta.perfil)) + '</p></div>' +
    '<div class="ini-botoes">' + (temDaily ? '<a class="ini-botao ini-botao-daily" href="#/daily">' + icone('daily', 22) + '<span><b>Daily</b><small>' + tr('Diário de obra dos projetos em execução') + '</small></span></a>' : '') +
      '<a class="ini-botao ini-botao-takeoff" href="' + rotaDoTakeoff + '">' + icone('tabela', 22) + '<span><b>Takeoff</b><small>' + tr('Plantas, quantidades e propostas') + '</small></span></a>' +
      '<a class="ini-botao ini-botao-settings" href="' + rotaDoSettings + '">' + icone('settings', 22) + '<span><b>Settings</b><small>' + tr(PRIMEIRA_VERSAO ? 'Contatos, usuários e empresa' : 'Obras, contatos, usuários e empresa') + '</small></span></a></div></header>';
  const rodape = '<footer class="ini-rodape"><a href="' + URL_PORTAL + (idioma() === 'pt' ? 'pt/' : '') + '">' + tr('Especificações e manual') + '</a></footer>';
  return htmlPainel(cabeca, rodape);
}

function htmlInicio() {
  return '<section class="cartao"><h1 class="oficial-titulo">' + tr('Olá, {nome}', { nome: esc(conta.membro.nome.split(' ')[0]) }) + '</h1>' +
      '<dl class="lista-dados"><dt>' + tr('Empresa') + '</dt><dd>' + esc(conta.empresa.nome) + ' · ' + esc(ATUACOES[conta.empresa.atuacao] || '') + '</dd>' +
      '<dt>' + tr('Seu acesso') + '</dt><dd>' + esc(nomeDoPerfil(conta.perfil)) + ' · ' + esc(emailAtual()) + '</dd>' +
      '<dt>' + tr('Plano') + '</dt><dd>' + esc(nomeDoPlano((conta.empresa.plano || {}).nome)) + '</dd></dl></section>' +
    ((pode('daily.preencher') || pode('daily.acompanhar') || pode('daily.aprovar'))
      ? '<section class="cartao"><h2 class="cartao-titulo">Daily</h2><p>' + tr('O diário de obra e o cronograma já funcionam com o banco de dados, com e sem internet: preencha no canteiro, envie, aprove, mande o link para o cliente e acompanhe as etapas da obra.') + '</p>' +
        '<div class="btn-linha"><a class="btn btn-primario" href="#/daily">' + icone('daily', 18) + tr('Abrir o Daily') + '</a></div></section>'
      : '') +
    (!PRIMEIRA_VERSAO && conta.empresa.atuacao !== 'construtora' && ['crew.ponto.proprio', 'crew.ponto.equipe', 'crew.acompanhar'].some((x) => pode(x))
      ? '<section class="cartao"><h2 class="cartao-titulo">Crew</h2><p>' + tr('O ponto da equipe já funciona com o banco de dados, com e sem internet: bata a entrada, o intervalo e a saída no celular; o escritório confere, ajusta e aprova a semana.') + '</p>' +
        '<div class="btn-linha"><a class="btn btn-primario" href="#/crew">' + icone('relogio', 18) + tr('Abrir o Crew') + '</a></div></section>'
      : '') +
    ((conta.empresa.atuacao !== 'construtora' || PRIMEIRA_VERSAO) && pode('measure.medir')
      ? '<section class="cartao"><h2 class="cartao-titulo">' + NOME_MEASURE + '</h2><p>' + (PRIMEIRA_VERSAO ? tr('Abra a planta em PDF, defina a escala, meça em pés e polegadas, monte as quantidades e emita a proposta. No computador.') : tr('A medição de plantas já funciona com o banco de dados, no computador: envie o PDF, defina a escala, meça, monte o catálogo e emita a proposta.')) + '</p>' +
        '<div class="btn-linha"><a class="btn btn-primario" href="#/measure">' + icone('tabela', 18) + (PRIMEIRA_VERSAO ? tr('Abrir o Takeoff') : tr('Abrir o Measure')) + '</a></div></section>'
      : '') +
    (pode('concorrencias.gerir')
      ? '<section class="cartao"><h2 class="cartao-titulo">' + tr('Concorrências') + '</h2><p>' + tr('As concorrências já funcionam com o banco de dados: convide prestadoras, receba propostas (pela plataforma ou por link), compare e feche; a obra da vencedora nasce ligada à sua.') + '</p>' +
        '<div class="btn-linha"><a class="btn btn-primario" href="#/daily/concorrencias">' + icone('tabela', 18) + tr('Abrir as concorrências') + '</a></div></section>'
      : '') +
    (conta.ehAdmin
      ? '<section class="cartao"><h2 class="cartao-titulo">' + tr('Administração da plataforma (KORbuild)') + '</h2>' +
        '<div class="btn-linha"><a class="btn btn-contorno" href="admin.html">' + tr('Administração da plataforma') + '</a></div></section>'
      : '') +
    (PRIMEIRA_VERSAO ? '<section class="cartao"><h2 class="cartao-titulo">' + tr('Manual do usuário') + '</h2><div class="btn-linha"><a class="btn btn-contorno" href="' + URL_PORTAL + (idioma() === 'pt' ? 'pt/' : '') + '">' + tr('Especificações e manual') + '</a></div></section>' : ''
    ) +
    (PRIMEIRA_VERSAO ? '' : '<section class="cartao"><h2 class="cartao-titulo">' + tr('Os módulos chegam em etapas') + '</h2>' +
      '<p>' + tr('A conta, os cadastros, o Daily (com o cronograma da obra), o Crew, o Measure e as concorrências já estão no banco de dados. Os avisos por e-mail chegam na próxima etapa.') + '</p>' +
      '<p>' + tr('Enquanto isso, conheça cada módulo no protótipo, com dados de exemplo.') + '</p>' +
      '<div class="btn-linha"><a class="btn btn-primario" href="' + URL_PROTOTIPO + '">' + icone('play', 18) + tr('Abrir o protótipo') + '</a><a class="btn btn-contorno" href="' + URL_PORTAL + (idioma() === 'pt' ? 'pt/' : '') + '">' + tr('Especificações e manual') + '</a></div></section>');
}

/* ---------- Usuários e Perfis de acesso: cabeçalho com ação, busca, grade e painel lateral ---------- */

const nomePerfilDe = (id) => nomeDoPerfil(conta.perfis.find((p) => p.id === id)) || '—';
const opcoesDePerfil = (atual) => conta.perfis.map((p) => '<option value="' + p.id + '"' + (p.id === atual ? ' selected' : '') + '>' + esc(nomeDoPerfil(p)) + '</option>').join('');
function htmlUsuarios() {
  const pendentes = conta.convites.filter((c) => !c.aceito_em && !c.cancelado_em && new Date(c.expira_em) > new Date());
  const ativos = conta.membros.filter((m) => m.ativo).length;
  const linhas = conta.membros.map((m) => {
    const eu = m.id === conta.membro.id;
    const sub = [m.cargo, m.telefone].filter(Boolean).join(' · ');
    return '<tr data-usuario="' + m.id + '"' + atributosDeLinha(m.nome + ' ' + (m.cargo || '') + ' ' + (m.telefone || '') + ' ' + nomePerfilDe(m.perfil_id), [m.ativo ? 'ativos' : 'desativados']) + '>' +
      '<td><div class="pessoa"><span class="avatar' + (m.ativo ? '' : ' inativo') + '" aria-hidden="true">' + esc(iniciais(m.nome)) + '</span><div><b>' + esc(m.nome) + '</b>' + (eu ? ' <span class="mudo pequeno">(' + tr('você') + ')</span>' : '') +
        (sub ? '<span class="mudo pequeno bloco">' + esc(sub) + '</span>' : '') + '</div></div></td>' +
      '<td>' + (eu ? '<span class="chip-perfil">' + esc(nomePerfilDe(m.perfil_id)) + '</span>' : '<select class="select-chip" data-acao-mudar="of-perfil-membro" data-id="' + m.id + '" aria-label="' + esc(tr('Perfil de {nome}', { nome: m.nome })) + '">' + opcoesDePerfil(m.perfil_id) + '</select>') + '</td>' +
      '<td>' + (m.ativo ? '<span class="status status-ok">' + tr('Ativo') + '</span>' : '<span class="status status-off">' + tr('Desativado') + '</span>') + '</td>' +
      '<td class="mudo">' + (m.ultimo_acesso ? esc(quando(m.ultimo_acesso)) : '—') + '</td>' +
      '<td class="acoes-linha"><button type="button" class="btn btn-contorno btn-pequeno" data-acao="of-editar-usuario" data-id="' + m.id + '">' + tr('Editar') + '</button>' +
        (eu ? '' : '<button type="button" class="btn btn-fantasma btn-pequeno" data-acao="of-ativar" data-id="' + m.id + '" data-ativo="' + (m.ativo ? '' : '1') + '">' + (m.ativo ? tr('Desativar') : tr('Reativar')) + '</button>') + '</td></tr>';
  }).join('');
  return cabecalhoDePagina(tr('Usuários'), tr('Quem entra no sistema e o que cada pessoa pode fazer. O cadastro é do administrador.'),
      '<button type="button" class="btn btn-contorno" data-acao="of-convidar-link">' + tr('Convidar por link') + '</button>' + botaoCriar('of-novo-usuario', tr('Novo usuário'), icone('mais', 16))) +
    barraDeBusca(tr('Buscar por nome, cargo ou perfil'), [['', tr('Todos'), conta.membros.length], ['ativos', tr('Ativos'), ativos], ['desativados', tr('Desativados'), conta.membros.length - ativos]]) +
    gradeEmCartao('tabela-membros', [tr('Pessoa'), tr('Perfil de acesso'), tr('Situação'), tr('Último acesso'), ''], linhas, tr('Ninguém encontrado com esse filtro.')) +
    '<p class="mudo pequeno">' + tr('Ninguém altera o próprio acesso, e a empresa sempre mantém alguém ativo que cuide dos acessos.') + '</p>' +
    (pendentes.length ? '<section class="cartao"><h3 class="cartao-titulo">' + tr('Convites pendentes') + ' <span class="mudo pequeno">' + pendentes.length + '</span></h3><ul class="lista-simples">' + pendentes.map((c) => '<li><b>' + esc(c.email) + '</b> · ' + esc(nomePerfilDe(c.perfil_id)) + ' · ' + tr('vale até {quando}', { quando: dataHora(new Date(c.expira_em).getTime()) }) +
      ' <button type="button" class="link" data-acao="of-cancelar-convite" data-id="' + c.id + '">' + tr('Cancelar') + '</button></li>').join('') + '</ul></section>' : '');
}

/* Cadastro direto: o administrador cria o login; a senha provisória aparece uma vez e a pessoa troca no primeiro acesso. */
function painelSenhaProvisoria({ titulo, subtitulo, email, senha }) {
  const endereco = location.origin + location.pathname;
  const texto = tr('Entrar em: {url}', { url: endereco }) + '\n' + tr('E-mail: {email}', { email }) + '\n' + tr('Senha provisória: {senha}', { senha });
  return abrirPainel({
    titulo, subtitulo, somenteLeitura: true, classe: 'painel-estreito',
    corpo: '<div class="painel-campos"><div class="credencial"><span class="rotulo-pequeno">' + tr('E-mail') + '</span><b>' + esc(email) + '</b>' +
      '<span class="rotulo-pequeno">' + tr('Senha provisória') + '</span><input type="text" readonly value="' + esc(senha) + '" class="senha-provisoria" data-selecionar aria-label="' + esc(tr('Senha provisória')) + '"></div>' +
      '<button type="button" class="btn btn-primario" data-acao="of-copiar-texto" data-texto="' + esc(texto) + '">' + icone('link', 16) + '<span>' + tr('Copiar endereço, e-mail e senha') + '</span></button>' +
      '<p class="aviso aviso-ambar pequeno"><b>' + tr('Esta senha aparece só agora.') + '</b> ' + tr('Passe para a pessoa por um canal seguro. No primeiro acesso ela é obrigada a escolher uma senha nova.') + '</p></div>',
  });
}

function painelNovoUsuarioDireto() {
  return abrirPainel({
    titulo: tr('Novo usuário'), subtitulo: tr('Você cadastra a pessoa e entrega a senha provisória. Ela troca a senha no primeiro acesso.'), rotuloSalvar: tr('Criar usuário'),
    corpo: '<div class="painel-campos">' + campoPainel('nu-nome', tr('Nome'), '<input id="nu-nome" autocomplete="off">') + campoPainel('nu-email', tr('E-mail (é o login da pessoa)'), '<input id="nu-email" type="email" autocomplete="off">') +
      '<div class="painel-linha">' + campoPainel('nu-telefone', tr('Telefone'), '<input id="nu-telefone" type="tel" autocomplete="off">') + campoPainel('nu-cargo', tr('Cargo'), '<input id="nu-cargo" autocomplete="off" placeholder="' + esc(tr('Ex.: Encarregado de obra')) + '">') + '</div>' +
      campoPainel('nu-perfil', tr('Perfil de acesso'), '<select id="nu-perfil">' + opcoesDePerfil((conta.perfis.find((p) => p.chave === 'gestor') || {}).id) + '</select>', tr('O que cada perfil pode fazer está em Perfis de acesso.')) + '</div>',
    aoSalvar: async (p) => {
      const dados = { nome: p.querySelector('#nu-nome').value, email: p.querySelector('#nu-email').value, telefone: p.querySelector('#nu-telefone').value, cargo: p.querySelector('#nu-cargo').value, perfil: p.querySelector('#nu-perfil').value };
      const r = await criarUsuarioDireto(dados);
      return r.erro ? r : { ok: true, senha: r.senha, email: dados.email.trim().toLowerCase(), nome: dados.nome.trim() };
    },
  }).then(async (r) => {
    if (!r) return;
    redesenhar();
    await painelSenhaProvisoria({ titulo: tr('Usuário criado'), subtitulo: r.nome, email: r.email, senha: r.senha });
  });
}

/* O convite por link continua para quem quer escolher a própria senha. */
function painelNovoUsuario() {
  return abrirPainel({
    titulo: tr('Convidar por link'), subtitulo: tr('Gera um link para a pessoa criar a própria conta e entrar com o perfil escolhido.'), rotuloSalvar: tr('Gerar o convite'),
    corpo: '<div class="painel-campos">' + campoPainel('cv-email', tr('E-mail'), '<input id="cv-email" name="email" type="email" required autocomplete="off">') + campoPainel('cv-nome', tr('Nome'), '<input id="cv-nome" name="nome" autocomplete="off">') +
      campoPainel('cv-perfil', tr('Perfil de acesso'), '<select id="cv-perfil" name="perfil">' + opcoesDePerfil((conta.perfis.find((p) => p.chave === 'gestor') || {}).id) + '</select>', tr('O que cada perfil pode fazer está em Perfis de acesso.')) +
      '<p class="mudo pequeno">' + tr('O convite é um link para você mandar à pessoa (vale 7 dias, uma vez só, para aquele e-mail).') + '</p></div>',
    aoSalvar: async (p) => {
      const r = await convidar(p.querySelector('#cv-email').value, p.querySelector('#cv-nome').value, p.querySelector('#cv-perfil').value);
      return r.erro ? r : { ok: true, link: r.link };
    },
  }).then(async (r) => {
    if (!r) return;
    redesenhar();
    await abrirPainel({
      titulo: tr('Convite criado'), subtitulo: tr('Mande este link para a pessoa:'), somenteLeitura: true, classe: 'painel-estreito',
      corpo: '<div class="painel-campos"><input type="text" readonly value="' + esc(r.link) + '" class="oficial-link" data-selecionar><button type="button" class="btn btn-contorno" data-acao="of-copiar" data-link="' + esc(r.link) + '">' + tr('Copiar o link') + '</button>' +
        '<p class="mudo pequeno">' + tr('Vale 7 dias e só uma vez, para o e-mail informado.') + '</p></div>',
    });
  });
}

function painelEditarUsuario(id) {
  const m = conta.membros.find((x) => x.id === id);
  if (!m) return;
  const eu = m.id === conta.membro.id;
  return abrirPainel({
    titulo: m.nome, subtitulo: eu ? tr('Você: o seu perfil e a sua situação só outra pessoa altera.') : nomePerfilDe(m.perfil_id), rotuloSalvar: tr('Salvar'),
    extras: eu ? [] : [{ rotulo: tr('Gerar nova senha provisória'), classe: 'btn-contorno', aoClicar: async () => {
      if (!(await confirmar(tr('Gerar nova senha provisória?'), tr('A senha atual deixa de valer e a pessoa terá de escolher outra no próximo acesso.'), tr('Gerar')))) return null;
      const r = await novaSenhaProvisoria(m.id);
      return r.erro ? r : { ok: true, senha: r.senha, nova: true };
    } }],
    corpo: '<div class="painel-campos">' + campoPainel('eu-nome', tr('Nome'), '<input id="eu-nome" value="' + esc(m.nome) + '">') + campoPainel('eu-telefone', tr('Telefone'), '<input id="eu-telefone" type="tel" value="' + esc(m.telefone || '') + '">') +
      campoPainel('eu-cargo', tr('Cargo'), '<input id="eu-cargo" value="' + esc(m.cargo || '') + '" placeholder="' + esc(tr('Ex.: Encarregado de obra')) + '">') +
      campoPainel('eu-perfil', tr('Perfil de acesso'), '<select id="eu-perfil"' + (eu ? ' disabled' : '') + '>' + opcoesDePerfil(m.perfil_id) + '</select>') +
      '<label class="check"><input type="checkbox" id="eu-ativo"' + (m.ativo ? ' checked' : '') + (eu ? ' disabled' : '') + '> ' + tr('Pode entrar no sistema') + '</label></div>',
    aoSalvar: async (p) => {
      const dados = { nome: p.querySelector('#eu-nome').value, telefone: p.querySelector('#eu-telefone').value, cargo: p.querySelector('#eu-cargo').value };
      if (!eu) { dados.perfil_id = p.querySelector('#eu-perfil').value; dados.ativo = p.querySelector('#eu-ativo').checked; }
      const r = await salvarMembro(m.id, dados);
      return r.erro ? r : { ok: true };
    },
  }).then(async (r) => {
    if (!r) return;
    redesenhar();
    if (r.nova) await painelSenhaProvisoria({ titulo: tr('Nova senha provisória'), subtitulo: m.nome, email: '—', senha: r.senha });
    else toast(tr('Dados salvos.'));
  });
}

/* ---------- Perfis de acesso ---------- */

const gruposVisiveis = () => PERMISSOES.filter((g) => g.modulo !== 'crew' || MODULOS_DA_VERSAO.includes('crew'));   // o Crew só aparece quando existir para o cliente
const tipoDoPerfil = (p) => (p.sistema ? ['sistema', tr('Sistema')] : p.chave ? ['modelo', tr('Modelo')] : ['proprio', tr('Personalizado')]);

function htmlPerfis() {
  const total = gruposVisiveis().reduce((n, g) => n + g.itens.length, 0);
  const ids = new Set(gruposVisiveis().flatMap((g) => g.itens.map((i) => i.id)));
  const linhas = conta.perfis.map((p) => {
    const usuarios = conta.membros.filter((m) => m.perfil_id === p.id);
    const [tipo, rotuloTipo] = tipoDoPerfil(p);
    const n = p.permissoes.filter((x) => ids.has(x)).length;
    return '<tr class="perfil-cartao" data-perfil="' + p.id + '"><td><div class="pessoa"><span class="icone-perfil" aria-hidden="true">' + icone('conta', 18) + '</span><div><b>' + esc(nomeDoPerfil(p)) + '</b><span class="mudo pequeno bloco">' + esc(descricaoDoPerfil(p) || '—') + '</span></div></div></td>' +
      '<td><span class="tipo-perfil tipo-' + tipo + '">' + (p.sistema ? icone('olho', 12) : '') + rotuloTipo + '</span></td>' +
      '<td><div class="meter" title="' + n + ' / ' + total + '"><span style="width:' + Math.round(n * 100 / Math.max(1, total)) + '%"></span></div><span class="mudo pequeno">' + tr('{n} de {total} permissões', { n, total }) + '</span></td>' +
      '<td>' + (usuarios.length ? '<span class="pilha-avatares" title="' + esc(usuarios.map((u) => u.nome).join(', ')) + '">' + usuarios.slice(0, 3).map((u) => '<span class="avatar mini">' + esc(iniciais(u.nome)) + '</span>').join('') + '</span> <span class="mudo pequeno">' + (usuarios.length === 1 ? tr('1 usuário') : tr('{n} usuários', { n: usuarios.length })) + '</span>' : '<span class="mudo pequeno">' + tr('Ninguém') + '</span>') + '</td>' +
      '<td class="acoes-linha"><button type="button" class="btn btn-contorno btn-pequeno" data-acao="of-editar-perfil" data-id="' + p.id + '">' + (p.sistema ? tr('Ver') : tr('Editar')) + '</button></td></tr>';
  }).join('');
  return cabecalhoDePagina(tr('Perfis de acesso'), tr('Cada perfil é um conjunto de permissões. Crie os que a sua empresa precisa e escolha, em Usuários, quem usa cada um.'),
      botaoCriar('of-novo-perfil', tr('Novo perfil'), icone('mais', 16))) +
    '<section class="cartao grade-cartao"><div class="tabela-rolagem"><table class="tabela tabela-perfis grade"><thead><tr><th>' + tr('Perfil') + '</th><th>' + tr('Tipo') + '</th><th>' + tr('Permissões') + '</th><th>' + tr('Quem usa') + '</th><th></th></tr></thead><tbody>' + linhas + '</tbody></table></div></section>' +
    '<p class="mudo pequeno">' + tr('O Administrador é protegido: a empresa sempre precisa de alguém que cuide dos acessos. Os perfis "Modelo" vêm prontos e podem ser alterados ou excluídos quando ninguém os usa.') + '</p>';
}

function htmlPermissoes(p, travado) {
  return gruposVisiveis().map((g) => '<fieldset class="perm-grupo"><legend>' + esc(g.grupo) + '</legend>' + g.itens.map((i) =>
    '<label class="perm-linha"><input type="checkbox" name="perm" value="' + i.id + '"' + (p && p.permissoes.includes(i.id) ? ' checked' : '') + (travado ? ' disabled' : '') + '><span class="perm-chave" aria-hidden="true"></span>' +
    '<span class="perm-texto"><b>' + esc(i.nome) + '</b>' + (i.descricao ? '<span class="mudo pequeno bloco">' + esc(i.descricao) + '</span>' : '') + '</span></label>').join('') + '</fieldset>').join('');
}

function painelNovoPerfil() {
  return abrirPainel({
    titulo: tr('Novo perfil'), subtitulo: tr('Dê um nome e escolha de onde partir. Depois você ajusta as permissões.'), rotuloSalvar: tr('Criar perfil'),
    corpo: '<div class="painel-campos">' + campoPainel('np-nome', tr('Nome'), '<input id="np-nome" name="nome" required autocomplete="off" placeholder="' + esc(tr('Ex.: Orçamentista')) + '">') +
      campoPainel('np-descricao', tr('Descrição'), '<input id="np-descricao" name="descricao" autocomplete="off" placeholder="' + esc(tr('Para que serve este perfil')) + '">') +
      campoPainel('np-base', tr('Começar de'), '<select id="np-base" name="base"><option value="">' + tr('Em branco (sem permissões)') + '</option>' + opcoesDePerfil('') + '</select>') + '</div>',
    aoSalvar: async (p) => {
      const r = await criarPerfil(p.querySelector('#np-nome').value, p.querySelector('#np-base').value, p.querySelector('#np-descricao').value);
      return r.erro ? r : { ok: true, id: r.id };
    },
  }).then((r) => { if (!r) return; toast(tr('Perfil criado.')); redesenhar(); if (r.id) setTimeout(() => painelEditarPerfil(r.id), 50); });
}

function painelEditarPerfil(id) {
  const p = conta.perfis.find((x) => x.id === id);
  if (!p) return;
  const travado = !!p.sistema;
  const usuarios = conta.membros.filter((m) => m.perfil_id === p.id);
  const visiveis = new Set(gruposVisiveis().flatMap((g) => g.itens.map((i) => i.id)));
  const extras = [];
  if (!travado) extras.push({ rotulo: tr('Excluir'), classe: 'btn-perigo', aoClicar: async () => {
    if (usuarios.length) return { erro: tr('Em uso por {n} pessoa(s): troque antes o perfil delas em Usuários.', { n: usuarios.length }) };
    if (!(await confirmar(tr('Excluir este perfil?'), tr('Ele deixa de existir. Ninguém usa este perfil agora.'), tr('Excluir')))) return null;
    const r = await excluirPerfil(p.id);
    return r.erro ? r : { ok: true, excluido: true };
  } });
  return abrirPainel({
    titulo: nomeDoPerfil(p), subtitulo: travado ? tr('Perfil protegido: as permissões do Administrador não mudam.') : (usuarios.length === 1 ? tr('1 usuário usa este perfil') : tr('{n} usuários usam este perfil', { n: usuarios.length })), somenteLeitura: travado, extras,
    classe: 'painel-largo', rotuloSalvar: tr('Salvar'),
    corpo: '<div class="painel-campos">' + campoPainel('pf-nome', tr('Nome'), '<input id="pf-nome" value="' + esc(nomeDoPerfil(p)) + '"' + (travado ? ' disabled' : '') + '>') +
      campoPainel('pf-descricao', tr('Descrição'), '<input id="pf-descricao" value="' + esc(descricaoDoPerfil(p)) + '"' + (travado ? ' disabled' : '') + '>') + '</div>' +
      '<h3 class="painel-secao">' + tr('Permissões') + '</h3><div class="perm-grade">' + htmlPermissoes(p, travado) + '</div>' +
      (usuarios.length ? '<h3 class="painel-secao">' + tr('Quem usa') + '</h3><p class="mudo">' + esc(usuarios.map((u) => u.nome).join(', ')) + '</p>' : ''),
    aoSalvar: async (painel) => {
      const marcadas = new Set(Array.from(painel.querySelectorAll('[name="perm"]:checked')).map((i) => i.value));
      for (const idp of Array.from(marcadas)) for (const req of (permissao(idp) || {}).requer || []) marcadas.add(req);   // dependências automáticas (SET-062)
      for (const x of p.permissoes) if (!visiveis.has(x)) marcadas.add(x);   // o que a tela não mostra (módulo ainda não disponível) fica como está
      const dados = { permissoes: Array.from(marcadas) };
      const nome = painel.querySelector('#pf-nome').value, descricao = painel.querySelector('#pf-descricao').value;
      if (nome.trim() !== nomeDoPerfil(p)) dados.nome = nome;
      if (descricao.trim() !== descricaoDoPerfil(p)) dados.descricao = descricao;
      const r = await salvarPerfil(p.id, dados);
      return r.erro ? r : { ok: true };
    },
  }).then((r) => { if (r) { toast(r.excluido ? tr('Perfil excluído.') : tr('Perfil salvo.')); redesenhar(); } });
}

const CAMPOS_EMPRESA = [['nome', 'Nome da empresa'], ['razao_social', 'Razão social'], ['ein', 'EIN'], ['endereco', 'Endereço'], ['cidade', 'Cidade'], ['estado', 'Estado'], ['zip', 'ZIP code'], ['telefone', 'Telefone'], ['email', 'E-mail'], ['site', 'Site']];
function htmlEmpresa() {
  const e = conta.empresa;
  const edita = pode('settings.conta');
  return cabecalhoDePagina(tr('Empresa'), tr('Os dados da empresa aparecem nas propostas e nos relatórios.'), '') + '<section class="cartao"><h2 class="cartao-titulo">' + tr('Dados da empresa') + '</h2><form id="form-empresa" class="grade-campos" novalidate data-sem-envio>' +
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
  return cabecalhoDePagina(tr('Meu perfil'), tr('Seus dados, o idioma, o e-mail de acesso e a senha. O seu perfil de acesso e as permissões só o administrador altera.'), '') + '<section class="cartao"><h2 class="cartao-titulo">' + tr('Seus dados') + '</h2>' +
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
  async 'of-sair'() { await sair(); esquecerConvite(); esquecerCadastros(); espelho.pronto = false; ir('#/entrar'); location.reload(); },   // recarrega: zera de vez o que ficou em memória (e a sessão antiga do cliente do Auth)
  async 'of-aceitar'() {
    const r = await aceitarConvite(conviteGuardado());
    if (r.erro) return mostrarErro(r.erro);
    esquecerConvite();
    toast(tr('Boas-vindas à empresa.'));
    ir('#/conta');
  },
  'of-descartar-convite'() { esquecerConvite(); ir('#/nova-empresa'); },
  'of-novo-usuario'() { painelNovoUsuarioDireto(); },
  'of-convidar-link'() { painelNovoUsuario(); },
  async 'of-copiar-texto'(el) { try { await navigator.clipboard.writeText(el.dataset.texto); toast(tr('Copiado.')); } catch (e) { toast(tr('Selecione o texto e copie.')); } },
  'of-editar-usuario'(el) { painelEditarUsuario(el.dataset.id); },
  async 'of-copiar'(el) {
    try { await navigator.clipboard.writeText(el.dataset.link); toast(tr('Link copiado.')); } catch (e) { toast(tr('Selecione o link e copie.')); }
  },
  async 'of-cancelar-convite'(el) { comResultado(await cancelarConvite(el.dataset.id), tr('Convite cancelado.')); },
  async 'of-ativar'(el) {
    const ativo = !!el.dataset.ativo;
    if (!ativo && !(await confirmar(tr('Desativar este usuário?'), tr('A pessoa deixa de entrar no KORbuild. O histórico fica, e dá para reativar depois.'), tr('Desativar')))) return;
    comResultado(await ativarMembro(el.dataset.id, ativo), ativo ? tr('Usuário reativado.') : tr('Usuário desativado.'));
  },
  'of-novo-perfil'() { painelNovoPerfil(); },
  'of-editar-perfil'(el) { painelEditarPerfil(el.dataset.id); },
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
