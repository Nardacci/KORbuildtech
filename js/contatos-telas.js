/* KORbuild — telas dos atores: perfil da empresa (com logo) e contatos (construtoras, clientes,
 * fornecedores), mais o campo de escolher um contato com "novo contato" no próprio formulário. */

import { esc, toast, abrirDialogo, confirmar } from './util.js';
import { usuarioAtual } from './plataforma.js';
import { icone } from './icones.js';
import {
  PAPEIS, ATUACOES, empresa, salvarEmpresa, definirLogo, contatos, contato, salvarContato, excluirContato, usosDoContato,
} from './contatos.js';
import { itens } from './measure.js';

let app = { desenhar: () => {}, ir: () => {} };
export function ligarContatos(funcoes) { app = { ...app, ...funcoes }; }

const quem = () => (usuarioAtual() || {}).nome;
const campo = (id, rotulo, html, classe) => '<div class="campo' + (classe ? ' ' + classe : '') + '"><label class="rotulo-pequeno" for="' + id + '">' + rotulo + '</label>' + html + '</div>';
const texto = (pre, nome, rotulo, valor, extra) => campo(pre + nome, rotulo, '<input type="text" id="' + pre + nome + '" name="' + nome + '" value="' + esc(valor || '') + '"' + (extra || '') + '>');
const area = (pre, nome, rotulo, valor, linhas, ph) => campo(pre + nome, rotulo, '<textarea id="' + pre + nome + '" name="' + nome + '" rows="' + (linhas || 3) + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + '>' + esc(valor || '') + '</textarea>');
const etiquetasPapeis = (c) => c.papeis.map((p) => '<span class="etiqueta ' + ({ construtora: 'etiqueta-azul', fornecedor: 'etiqueta-ambar', prestadora: 'etiqueta-neutro' }[p] || 'etiqueta-verde') + '">' + PAPEIS[p].nome + '</span>').join(' ');

/* Logo da empresa: o que aparece no lugar da logo quando não há imagem. */
export function htmlLogo(classe) {
  const e = empresa();
  return e.logo ? '<img class="' + (classe || 'logo-empresa') + '" src="' + e.logo + '" alt="' + esc(e.nome) + '">' : '<span class="rel-logo">' + esc(e.sigla || '') + '</span>';
}

/* ---------- Escolher um contato (com "novo contato" sem sair do formulário) ---------- */

export function htmlEscolhaContato({ id, nome, rotulo, papeis, atual, vazio }) {
  const lista = contatos().filter((c) => c.papeis.some((p) => papeis.includes(p))).sort((a, b) => a.nome.localeCompare(b.nome));
  return '<div class="campo"><label class="rotulo-pequeno" for="' + id + '">' + rotulo + '</label><div class="escolha-contato">' +
    '<select id="' + id + '" name="' + nome + '" data-papeis="' + papeis.join(',') + '">' + (vazio != null ? '<option value="">' + esc(vazio) + '</option>' : '<option value="">Escolha…</option>') +
      lista.map((c) => '<option value="' + c.id + '"' + (c.id === atual ? ' selected' : '') + '>' + esc(c.nome) + ' · ' + c.papeis.map((p) => PAPEIS[p].nome.toLowerCase()).join(', ') + '</option>').join('') + '</select>' +
    '<button type="button" class="btn btn-contorno btn-pequeno" data-acao="contato-rapido" data-alvo="' + id + '" data-papel="' + papeis[0] + '">' + icone('mais', 14) + 'Novo</button></div></div>';
}

async function dialogoContatoRapido(papel) {
  const res = await abrirDialogo({
    titulo: 'Novo contato',
    corpo: '<label class="rotulo-pequeno" for="cr-nome">Nome (empresa ou pessoa)</label><input type="text" id="cr-nome" name="nome">' +
      '<label class="rotulo-pequeno" for="cr-pessoa">Pessoa de contato</label><input type="text" id="cr-pessoa" name="pessoa">' +
      '<label class="rotulo-pequeno" for="cr-email">E-mail</label><input type="email" id="cr-email" name="email">' +
      '<label class="rotulo-pequeno" for="cr-tel">Telefone</label><input type="text" id="cr-tel" name="telefone">' +
      '<fieldset class="papeis-contato"><legend class="rotulo-pequeno">É</legend>' + Object.entries(PAPEIS).map(([id, p]) =>
        '<label class="check pequeno"><input type="checkbox" name="papel-' + id + '" value="1"' + (id === papel ? ' checked' : '') + '> ' + p.nome + ' <span class="mudo">· ' + esc(p.dica) + '</span></label>').join('') + '</fieldset>',
    acoes: [{ rotulo: 'Cancelar', valor: false }, { rotulo: 'Criar contato', valor: true, classe: 'btn-primario' }],
  });
  if (!res || !res.valor) return null;
  const papeis = Object.keys(PAPEIS).filter((p) => res.campos['papel-' + p]);
  const r = salvarContato(null, { ...res.campos, papeis }, quem());
  if (r.erro) { toast(r.erro); return null; }
  return contato(r.id);
}

/* ---------- Empresa ---------- */

export function telaEmpresa(moldura) {
  const e = empresa();
  const pre = 'em-';
  return moldura({
    ativo: 'empresa', titulo: 'Empresa', subtitulo: 'Quem assina o KORbuild: estes dados e a logo saem na proposta, na lista de materiais e no diário de obra',
    conteudo: '<form id="form-empresa" class="form-settings" onsubmit="return false">' +
      '<section class="cartao"><h2 class="cartao-titulo">Logo</h2><div class="logo-campo"><div class="logo-previa" id="logo-previa">' + htmlLogo('logo-empresa grande') + '</div>' +
        '<div class="logo-acoes"><label class="btn btn-contorno btn-pequeno">' + icone('camera', 16) + (e.logo ? 'Trocar logo' : 'Enviar logo') + '<input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" id="empresa-logo" class="visualmente-oculto"></label>' +
          (e.logo ? '<button type="button" class="link-botao pequeno" data-acao="empresa-tirar-logo">Tirar a logo</button>' : '') +
          '<p class="mudo pequeno">PNG, JPG ou SVG. Ela é reduzida para caber no cabeçalho dos documentos. Sem logo, aparece a sigla.</p></div></div></section>' +
      '<section class="cartao"><h2 class="cartao-titulo">Identificação</h2><div class="grade-campos">' +
        texto(pre, 'nome', 'Nome da empresa *', e.nome) + texto(pre, 'razaoSocial', 'Razão social (legal name)', e.razaoSocial) +
        texto(pre, 'sigla', 'Sigla (sem logo)', e.sigla, ' maxlength="3"') + texto(pre, 'ein', 'EIN', e.ein) +
        campo(pre + 'atuacao', 'Como a empresa atua', '<select id="' + pre + 'atuacao" name="atuacao">' + Object.entries(ATUACOES).map(([k, n]) => '<option value="' + k + '"' + (k === e.atuacao ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>') +
        texto(pre, 'especialidades', 'Especialidades', e.especialidades, ' placeholder="Ex.: framing, siding, drywall"') +
      '</div></section>' +
      '<section class="cartao"><h2 class="cartao-titulo">Contato e endereço</h2>' + texto(pre, 'endereco', 'Endereço', e.endereco) +
        '<div class="grade-campos mz-grade-local">' + texto(pre, 'cidade', 'Cidade', e.cidade) + texto(pre, 'estado', 'Estado', e.estado, ' maxlength="2"') + texto(pre, 'zip', 'ZIP code', e.zip, ' maxlength="10"') + '</div>' +
        '<div class="grade-campos">' + texto(pre, 'telefone', 'Telefone', e.telefone) + texto(pre, 'email', 'E-mail', e.email) + texto(pre, 'site', 'Site', e.site) + '</div></section>' +
      '<section class="cartao"><h2 class="cartao-titulo">Licenças e seguros</h2><p class="mudo pequeno">A construtora costuma pedir o certificado de seguro (COI) antes de contratar. Vão no rodapé da proposta.</p>' +
        '<div class="grade-campos">' + area(pre, 'licencas', 'Licenças e registros', e.licencas, 3) + area(pre, 'seguros', 'Seguros', e.seguros, 3) + '</div></section>' +
      '<section class="cartao"><h2 class="cartao-titulo">Termos padrão da proposta</h2>' + area(pre, 'termosProposta', 'Validade, forma de pagamento, o que não está incluído…', e.termosProposta, 5) +
        '<p class="mudo pequeno">Cada proposta começa com estes termos e pode ser ajustada.</p></section>' +
      '<div class="rodape-form"><button type="button" class="btn btn-primario" data-acao="empresa-salvar">Salvar</button></div></form>',
  });
}

/* Reduz a imagem para o cabeçalho (até 480 × 160 px) e devolve um data URL. */
function reduzirLogo(arquivo) {
  return new Promise((ok, falha) => {
    const leitor = new FileReader();
    leitor.onerror = () => falha(new Error('Não foi possível ler o arquivo.'));
    leitor.onload = () => {
      const img = new Image();
      img.onerror = () => falha(new Error('Esse arquivo não é uma imagem.'));
      img.onload = () => {
        const k = Math.min(1, 480 / (img.width || 480), 160 / (img.height || 160));
        const cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round((img.width || 480) * k)); cv.height = Math.max(1, Math.round((img.height || 160) * k));
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        ok(cv.toDataURL('image/png'));
      };
      img.src = leitor.result;
    };
    leitor.readAsDataURL(arquivo);
  });
}
document.addEventListener('change', async (ev) => {
  if (ev.target.id !== 'empresa-logo' || !ev.target.files[0]) return;
  try {
    definirLogo(await reduzirLogo(ev.target.files[0]), quem());
    toast('Logo atualizada. Ela sai nos documentos da empresa.');
    app.desenhar();
  } catch (e) { toast(e.message); }
});

/* ---------- Contatos ---------- */

export function telaContatos(moldura, filtro) {
  const lista = contatos().filter((c) => !filtro || c.papeis.includes(filtro)).sort((a, b) => a.nome.localeCompare(b.nome));
  const abas = [['', 'Todos', contatos().length]].concat(Object.entries(PAPEIS).map(([id, p]) => [id, p.plural, contatos().filter((c) => c.papeis.includes(id)).length]));
  return moldura({
    ativo: 'contatos', titulo: 'Contatos', subtitulo: 'Construtoras que contratam, clientes (donos de obra) e fornecedores: um cadastro só, com marcadores',
    acoes: '<a class="btn btn-primario btn-pequeno" href="#/settings/contato/novo' + (filtro ? '/' + filtro : '') + '">' + icone('mais', 16) + 'Novo contato</a>',
    conteudo: '<nav class="abas-segmento" aria-label="Filtro">' + abas.map(([id, r, n]) => '<a href="#/settings/contatos' + (id ? '/' + id : '') + '"' + ((filtro || '') === id ? ' class="ativa" aria-current="page"' : '') + '>' + r + ' <span class="mz-contagem">' + n + '</span></a>').join('') + '</nav>' +
      (lista.length ? '<section class="cartao"><div class="tabela-rolagem"><table class="tabela tabela-contatos"><thead><tr><th>Nome</th><th>É</th><th>Contato</th><th>Cidade</th><th>Usado em</th></tr></thead><tbody>' +
        lista.map((c) => {
          const usos = usosDoContato(c.id);
          return '<tr><td><a href="#/settings/contato/' + c.id + '"><b>' + esc(c.nome) + '</b></a>' + (c.etapas.length ? '<span class="mudo pequeno bloco">Fornece: ' + esc(c.etapas.map((x) => x.split(' · ')[1] || x).join(', ')) + '</span>' : '') + '</td>' +
            '<td>' + etiquetasPapeis(c) + '</td><td>' + esc(c.pessoa) + (c.email ? '<span class="mudo pequeno bloco">' + esc(c.email) + '</span>' : '') + '</td>' +
            '<td>' + esc([c.cidade, c.estado].filter(Boolean).join(', ')) + '</td><td class="pequeno">' + (usos.length ? esc(usos.join(', ')) : '<span class="mudo">—</span>') + '</td></tr>';
        }).join('') + '</tbody></table></div></section>' : '<p class="vazio">Nenhum contato aqui ainda.</p>'),
  });
}

export function telaFormContato(moldura, id, papelInicial) {
  const c = id ? contato(id) : { papeis: papelInicial && PAPEIS[papelInicial] ? [papelInicial] : [], etapas: [], estado: 'NH' };
  const pre = 'ct-';
  const etapas = Array.from(new Set(itens().map((i) => i.etapa).filter(Boolean))).sort();
  return moldura({
    ativo: 'contatos', titulo: id ? c.nome : 'Novo contato', voltar: { href: '#/settings/contatos', rotulo: 'Contatos' },
    conteudo: '<form id="form-contato" class="form-settings" data-id="' + (id || '') + '" onsubmit="return false">' +
      '<section class="cartao"><h2 class="cartao-titulo">É</h2><div class="papeis-contato">' + Object.entries(PAPEIS).map(([k, p]) =>
        '<label class="opcao-perfil"><input type="checkbox" name="papeis" value="' + k + '"' + (c.papeis.includes(k) ? ' checked' : '') + '><span><b>' + p.nome + '</b><span class="mudo pequeno">' + esc(p.dica) + '</span></span></label>').join('') +
        '</div><p class="mudo pequeno">Pode ser mais de um: a mesma empresa contrata como construtora num projeto e é cliente em outro.</p></section>' +
      '<section class="cartao"><h2 class="cartao-titulo">Dados</h2><div class="grade-campos">' +
        texto(pre, 'nome', 'Nome (empresa ou pessoa) *', c.nome) + texto(pre, 'pessoa', 'Pessoa de contato', c.pessoa) +
        texto(pre, 'email', 'E-mail', c.email, ' inputmode="email"') + texto(pre, 'telefone', 'Telefone', c.telefone) + '</div>' +
        texto(pre, 'endereco', 'Endereço', c.endereco) +
        '<div class="grade-campos mz-grade-local">' + texto(pre, 'cidade', 'Cidade', c.cidade) + texto(pre, 'estado', 'Estado', c.estado, ' maxlength="2"') + texto(pre, 'zip', 'ZIP code', c.zip, ' maxlength="10"') + '</div></section>' +
      '<section class="cartao" id="ct-fornece"' + (c.papeis.includes('fornecedor') ? '' : ' hidden') + '><h2 class="cartao-titulo">O que fornece</h2>' +
        '<p class="mudo pequeno">As etapas (cost codes) dos itens do catálogo. A lista de materiais para cotação vai separada por fornecedor.</p><div class="etapas-contato">' +
        etapas.map((x) => '<label class="check pequeno"><input type="checkbox" name="etapas" value="' + esc(x) + '"' + (c.etapas.includes(x) ? ' checked' : '') + '> ' + esc(x) + '</label>').join('') + '</div></section>' +
      '<section class="cartao">' + area(pre, 'notas', 'Notas', c.notas, 2) + '</section>' +
      '<div class="rodape-form">' + (id ? '<button type="button" class="btn btn-contorno" data-acao="contato-excluir" data-id="' + id + '">Excluir</button>' : '') +
        '<a class="btn btn-contorno" href="#/settings/contatos">Cancelar</a><button type="button" class="btn btn-primario" data-acao="contato-salvar">' + (id ? 'Salvar' : 'Criar contato') + '</button></div></form>',
  });
}
// a seção "O que fornece" só aparece com o marcador de fornecedor
document.addEventListener('change', (ev) => {
  if (ev.target.name === 'papeis' && ev.target.closest('#form-contato')) {
    const s = document.getElementById('ct-fornece');
    if (s) s.hidden = !document.querySelector('#form-contato [name="papeis"][value="fornecedor"]').checked;
  }
});

/* ---------- Ações ---------- */

export const acoesContatos = {
  'empresa-salvar'() {
    const dados = Object.fromEntries(new FormData(document.getElementById('form-empresa')).entries());
    const r = salvarEmpresa(dados, quem());
    toast(r.erro || 'Dados da empresa salvos.');
    if (r.ok) app.desenhar();
  },
  async 'empresa-tirar-logo'() {
    if (!(await confirmar('Tirar a logo?', 'Os documentos passam a mostrar a sigla da empresa.', 'Tirar'))) return;
    definirLogo(null, quem());
    app.desenhar();
  },
  'contato-salvar'() {
    const form = document.getElementById('form-contato');
    const fd = new FormData(form);
    const id = form.dataset.id || null;
    const r = salvarContato(id, { ...Object.fromEntries(fd.entries()), papeis: fd.getAll('papeis'), etapas: fd.getAll('etapas') }, quem());
    if (r.erro) { toast(r.erro); return; }
    toast(id ? 'Contato atualizado.' : 'Contato criado.');
    app.ir('#/settings/contatos');
  },
  async 'contato-excluir'(el) {
    const c = contato(el.dataset.id);
    if (!(await confirmar('Excluir "' + c.nome + '"?', 'O contato sai do cadastro.', 'Excluir'))) return;
    const r = excluirContato(c.id, quem());
    if (r.erro) { toast(r.erro); return; }
    toast('Contato excluído.');
    app.ir('#/settings/contatos');
  },
  /* "Novo" ao lado do campo: cria o contato e já escolhe nele, sem perder o que foi digitado. */
  async 'contato-rapido'(el) {
    const c = await dialogoContatoRapido(el.dataset.papel);
    if (!c) return;
    const form = el.closest('form') || document;
    form.querySelectorAll('select[data-papeis]').forEach((sel) => {
      if (!c.papeis.some((p) => sel.dataset.papeis.split(',').includes(p))) return;
      sel.insertAdjacentHTML('beforeend', '<option value="' + c.id + '">' + esc(c.nome) + ' · ' + c.papeis.map((p) => PAPEIS[p].nome.toLowerCase()).join(', ') + '</option>');
    });
    const alvo = document.getElementById(el.dataset.alvo);
    if (alvo && alvo.querySelector('option[value="' + c.id + '"]')) alvo.value = c.id;
    toast('Contato "' + c.nome + '" criado.');
  },
};
