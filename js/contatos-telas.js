/* KORbuild — telas dos atores: perfil da empresa (com logo) e contatos (construtoras, clientes,
 * fornecedores), mais o campo de escolher um contato com "novo contato" no próprio formulário. */

import { esc, toast, abrirDialogo, confirmar } from './util.js';
import { tr, tn } from './i18n.js';
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
    '<select id="' + id + '" name="' + nome + '" data-papeis="' + papeis.join(',') + '">' + (vazio != null ? '<option value="">' + esc(vazio) + '</option>' : ('<option value="">' + tr('Escolha…') + '</option>')) +
      lista.map((c) => '<option value="' + c.id + '"' + (c.id === atual ? ' selected' : '') + '>' + esc(c.nome) + ' · ' + c.papeis.map((p) => PAPEIS[p].nome.toLowerCase()).join(', ') + '</option>').join('') + '</select>' +
    '<button type="button" class="btn btn-contorno btn-pequeno" data-acao="contato-rapido" data-alvo="' + id + '" data-papel="' + papeis[0] + '">' + icone('mais', 14) + (tr('Novo') + '</button></div></div>');
}

async function dialogoContatoRapido(papel) {
  const res = await abrirDialogo({
    titulo: tr('Novo contato'),
    corpo: ('<label class="rotulo-pequeno" for="cr-nome">' + tr('Nome (empresa ou pessoa)') + '</label><input type="text" id="cr-nome" name="nome">') +
      ('<label class="rotulo-pequeno" for="cr-pessoa">' + tr('Pessoa de contato') + '</label><input type="text" id="cr-pessoa" name="pessoa">') +
      ('<label class="rotulo-pequeno" for="cr-email">' + tr('E-mail') + '</label><input type="email" id="cr-email" name="email">') +
      ('<label class="rotulo-pequeno" for="cr-tel">' + tr('Telefone') + '</label><input type="text" id="cr-tel" name="telefone">') +
      ('<fieldset class="papeis-contato"><legend class="rotulo-pequeno">' + tr('É') + '</legend>') + Object.entries(PAPEIS).map(([id, p]) =>
        '<label class="check pequeno"><input type="checkbox" name="papel-' + id + '" value="1"' + (id === papel ? ' checked' : '') + '> ' + p.nome + ' <span class="mudo">· ' + esc(p.dica) + '</span></label>').join('') + '</fieldset>',
    acoes: [{ rotulo: tr('Cancelar'), valor: false }, { rotulo: tr('Criar contato'), valor: true, classe: 'btn-primario' }],
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
    ativo: 'empresa', titulo: tr('Empresa'), subtitulo: tr('Quem assina o KORbuild: estes dados e a logo saem na proposta, na lista de materiais e no diário de obra'),
    conteudo: '<form id="form-empresa" class="form-settings" onsubmit="return false">' +
      ('<section class="cartao"><h2 class="cartao-titulo">' + tr('Logo') + '</h2><div class="logo-campo"><div class="logo-previa" id="logo-previa">') + htmlLogo('logo-empresa grande') + '</div>' +
        '<div class="logo-acoes"><label class="btn btn-contorno btn-pequeno">' + icone('camera', 16) + (e.logo ? tr('Trocar logo') : tr('Enviar logo')) + '<input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" id="empresa-logo" class="visualmente-oculto"></label>' +
          (e.logo ? ('<button type="button" class="link-botao pequeno" data-acao="empresa-tirar-logo">' + tr('Tirar a logo') + '</button>') : '') +
          ('<p class="mudo pequeno">' + tr('PNG, JPG ou SVG. Ela é reduzida para caber no cabeçalho dos documentos. Sem logo, aparece a sigla.') + '</p></div></div></section>') +
      ('<section class="cartao"><h2 class="cartao-titulo">' + tr('Identificação') + '</h2><div class="grade-campos">') +
        texto(pre, 'nome', tr('Nome da empresa *'), e.nome) + texto(pre, 'razaoSocial', tr('Razão social (legal name)'), e.razaoSocial) +
        texto(pre, 'sigla', tr('Sigla (sem logo)'), e.sigla, ' maxlength="3"') + texto(pre, 'ein', 'EIN', e.ein) +
        campo(pre + 'atuacao', tr('Como a empresa atua'), '<select id="' + pre + 'atuacao" name="atuacao">' + Object.entries(ATUACOES).map(([k, n]) => '<option value="' + k + '"' + (k === e.atuacao ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>') +
        texto(pre, 'especialidades', tr('Especialidades'), e.especialidades, (' placeholder="' + tr('Ex.: framing, siding, drywall') + '"')) +
      '</div></section>' +
      ('<section class="cartao"><h2 class="cartao-titulo">' + tr('Contato e endereço') + '</h2>') + texto(pre, 'endereco', tr('Endereço'), e.endereco) +
        '<div class="grade-campos mz-grade-local">' + texto(pre, 'cidade', tr('Cidade'), e.cidade) + texto(pre, 'estado', tr('Estado'), e.estado, ' maxlength="2"') + texto(pre, 'zip', tr('ZIP code'), e.zip, ' maxlength="10"') + '</div>' +
        '<div class="grade-campos">' + texto(pre, 'telefone', tr('Telefone'), e.telefone) + texto(pre, 'email', tr('E-mail'), e.email) + texto(pre, 'site', tr('Site'), e.site) + '</div></section>' +
      ('<section class="cartao"><h2 class="cartao-titulo">' + tr('Licenças e seguros') + '</h2><p class="mudo pequeno">' + tr('A construtora costuma pedir o certificado de seguro (COI) antes de contratar. Vão no rodapé da proposta.') + '</p>') +
        '<div class="grade-campos">' + area(pre, 'licencas', tr('Licenças e registros'), e.licencas, 3) + area(pre, 'seguros', tr('Seguros'), e.seguros, 3) + '</div></section>' +
      ('<section class="cartao"><h2 class="cartao-titulo">' + tr('Termos padrão da proposta') + '</h2>') + area(pre, 'termosProposta', tr('Validade, forma de pagamento, o que não está incluído…'), e.termosProposta, 5) +
        ('<p class="mudo pequeno">' + tr('Cada proposta começa com estes termos e pode ser ajustada.') + '</p></section>') +
      ('<div class="rodape-form"><button type="button" class="btn btn-primario" data-acao="empresa-salvar">' + tr('Salvar') + '</button></div></form>'),
  });
}

/* Reduz a imagem para o cabeçalho (até 480 × 160 px) e devolve um data URL. */
function reduzirLogo(arquivo) {
  return new Promise((ok, falha) => {
    const leitor = new FileReader();
    leitor.onerror = () => falha(new Error(tr('Não foi possível ler o arquivo.')));
    leitor.onload = () => {
      const img = new Image();
      img.onerror = () => falha(new Error(tr('Esse arquivo não é uma imagem.')));
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
    toast(tr('Logo atualizada. Ela sai nos documentos da empresa.'));
    app.desenhar();
  } catch (e) { toast(e.message); }
});

/* ---------- Contatos ---------- */

export function telaContatos(moldura, filtro) {
  const lista = contatos().filter((c) => !filtro || c.papeis.includes(filtro)).sort((a, b) => a.nome.localeCompare(b.nome));
  const abas = [['', tr('Todos'), contatos().length]].concat(Object.entries(PAPEIS).map(([id, p]) => [id, p.plural, contatos().filter((c) => c.papeis.includes(id)).length]));
  return moldura({
    ativo: 'contatos', titulo: tr('Contatos'), subtitulo: tr('Construtoras que contratam, clientes (donos de obra) e fornecedores: um cadastro só, com marcadores'),
    acoes: '<a class="btn btn-primario btn-pequeno" href="#/settings/contato/novo' + (filtro ? '/' + filtro : '') + '">' + icone('mais', 16) + (tr('Novo contato') + '</a>'),
    conteudo: ('<nav class="abas-segmento" aria-label="' + tr('Filtro') + '">') + abas.map(([id, r, n]) => '<a href="#/settings/contatos' + (id ? '/' + id : '') + '"' + ((filtro || '') === id ? ' class="ativa" aria-current="page"' : '') + '>' + r + ' <span class="mz-contagem">' + n + '</span></a>').join('') + '</nav>' +
      (lista.length ? ('<section class="cartao"><div class="tabela-rolagem"><table class="tabela tabela-contatos"><thead><tr><th>' + tr('Nome') + '</th><th>' + tr('É') + '</th><th>' + tr('Contato') + '</th><th>' + tr('Cidade') + '</th><th>' + tr('Usado em') + '</th></tr></thead><tbody>') +
        lista.map((c) => {
          const usos = usosDoContato(c.id);
          return '<tr><td><a href="#/settings/contato/' + c.id + '"><b>' + esc(c.nome) + '</b></a>' + (c.etapas.length ? ('<span class="mudo pequeno bloco">' + tr('Fornece:') + ' ') + esc(c.etapas.map((x) => x.split(' · ')[1] || x).join(', ')) + '</span>' : '') + '</td>' +
            '<td>' + etiquetasPapeis(c) + '</td><td>' + esc(c.pessoa) + (c.email ? '<span class="mudo pequeno bloco">' + esc(c.email) + '</span>' : '') + '</td>' +
            '<td>' + esc([c.cidade, c.estado].filter(Boolean).join(', ')) + '</td><td class="pequeno">' + (usos.length ? esc(usos.join(', ')) : '<span class="mudo">—</span>') + '</td></tr>';
        }).join('') + '</tbody></table></div></section>' : ('<p class="vazio">' + tr('Nenhum contato aqui ainda.') + '</p>')),
  });
}

export function telaFormContato(moldura, id, papelInicial) {
  const c = id ? contato(id) : { papeis: papelInicial && PAPEIS[papelInicial] ? [papelInicial] : [], etapas: [], estado: 'NH' };
  const pre = 'ct-';
  const etapas = Array.from(new Set(itens().map((i) => i.etapa).filter(Boolean))).sort();
  return moldura({
    ativo: 'contatos', titulo: id ? c.nome : tr('Novo contato'), voltar: { href: '#/settings/contatos', rotulo: tr('Contatos') },
    conteudo: '<form id="form-contato" class="form-settings" data-id="' + (id || '') + '" onsubmit="return false">' +
      ('<section class="cartao"><h2 class="cartao-titulo">' + tr('É') + '</h2><div class="papeis-contato">') + Object.entries(PAPEIS).map(([k, p]) =>
        '<label class="opcao-perfil"><input type="checkbox" name="papeis" value="' + k + '"' + (c.papeis.includes(k) ? ' checked' : '') + '><span><b>' + p.nome + '</b><span class="mudo pequeno">' + esc(p.dica) + '</span></span></label>').join('') +
        ('</div><p class="mudo pequeno">' + tr('Pode ser mais de um: a mesma empresa contrata como construtora num projeto e é cliente em outro.') + '</p></section>') +
      ('<section class="cartao"><h2 class="cartao-titulo">' + tr('Dados') + '</h2><div class="grade-campos">') +
        texto(pre, 'nome', tr('Nome (empresa ou pessoa) *'), c.nome) + texto(pre, 'pessoa', tr('Pessoa de contato'), c.pessoa) +
        texto(pre, 'email', tr('E-mail'), c.email, ' inputmode="email"') + texto(pre, 'telefone', tr('Telefone'), c.telefone) + '</div>' +
        texto(pre, 'endereco', tr('Endereço'), c.endereco) +
        '<div class="grade-campos mz-grade-local">' + texto(pre, 'cidade', tr('Cidade'), c.cidade) + texto(pre, 'estado', tr('Estado'), c.estado, ' maxlength="2"') + texto(pre, 'zip', tr('ZIP code'), c.zip, ' maxlength="10"') + '</div></section>' +
      '<section class="cartao" id="ct-fornece"' + (c.papeis.includes('fornecedor') ? '' : ' hidden') + ('><h2 class="cartao-titulo">' + tr('O que fornece') + '</h2>') +
        ('<p class="mudo pequeno">' + tr('As etapas (cost codes) dos itens do catálogo. A lista de materiais para cotação vai separada por fornecedor.') + '</p><div class="etapas-contato">') +
        etapas.map((x) => '<label class="check pequeno"><input type="checkbox" name="etapas" value="' + esc(x) + '"' + (c.etapas.includes(x) ? ' checked' : '') + '> ' + esc(x) + '</label>').join('') + '</div></section>' +
      '<section class="cartao">' + area(pre, 'notas', tr('Notas'), c.notas, 2) + '</section>' +
      '<div class="rodape-form">' + (id ? '<button type="button" class="btn btn-contorno" data-acao="contato-excluir" data-id="' + id + ('">' + tr('Excluir') + '</button>') : '') +
        ('<a class="btn btn-contorno" href="#/settings/contatos">' + tr('Cancelar') + '</a><button type="button" class="btn btn-primario" data-acao="contato-salvar">') + (id ? tr('Salvar') : tr('Criar contato')) + '</button></div></form>',
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
    toast(r.erro || tr('Dados da empresa salvos.'));
    if (r.ok) app.desenhar();
  },
  async 'empresa-tirar-logo'() {
    if (!(await confirmar(tr('Tirar a logo?'), tr('Os documentos passam a mostrar a sigla da empresa.'), tr('Tirar')))) return;
    definirLogo(null, quem());
    app.desenhar();
  },
  'contato-salvar'() {
    const form = document.getElementById('form-contato');
    const fd = new FormData(form);
    const id = form.dataset.id || null;
    const r = salvarContato(id, { ...Object.fromEntries(fd.entries()), papeis: fd.getAll('papeis'), etapas: fd.getAll('etapas') }, quem());
    if (r.erro) { toast(r.erro); return; }
    toast(id ? tr('Contato atualizado.') : tr('Contato criado.'));
    app.ir('#/settings/contatos');
  },
  async 'contato-excluir'(el) {
    const c = contato(el.dataset.id);
    if (!(await confirmar(tr('Excluir "') + c.nome + '"?', tr('O contato sai do cadastro.'), tr('Excluir')))) return;
    const r = excluirContato(c.id, quem());
    if (r.erro) { toast(r.erro); return; }
    toast(tr('Contato excluído.'));
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
    toast(tr('Contato "') + c.nome + '" criado.');
  },
};
