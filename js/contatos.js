/* KORbuild — os atores (docs/saas.md §Atores).
 *
 *  - A EMPRESA é quem assina o KORbuild: uma prestadora de serviço (subcontractor), uma construtora
 *    (general contractor) ou as duas. O perfil dela (logo, licenças, seguros, termos) sai nos documentos.
 *  - Os FUNCIONÁRIOS são da empresa (Settings › Funcionários) e entram como usuários.
 *  - CONTATOS são os de fora: um diretório só, com marcadores (construtora, cliente, fornecedor).
 *    O papel depende do projeto: a mesma construtora contrata num projeto e é dona da obra em outro.
 *  - Em cada projeto/obra: o CONTRATANTE (quem recebe a proposta e o diário) e, se for outro, o DONO. */

import { novoId } from './util.js';
import { estado, salvar } from './armazem.js';
import { auditar } from './settings.js';

export const PAPEIS = {
  construtora: { nome: 'Construtora', plural: 'Construtoras', dica: 'General contractor: contrata a empresa para um serviço da obra' },
  cliente: { nome: 'Cliente', plural: 'Clientes', dica: 'Dono da obra (owner): contrata direto ou por uma construtora' },
  fornecedor: { nome: 'Fornecedor', plural: 'Fornecedores', dica: 'Recebe a lista de materiais para cotação' },
  prestadora: { nome: 'Prestadora', plural: 'Prestadoras', dica: 'Subcontractor: a empresa de serviço (framing, drywall…) que a construtora contrata' },
};
export const ATUACOES = {
  prestadora: 'Prestadora de serviço (subcontractor)',
  construtora: 'Construtora / empreiteira (general contractor)',
  ambas: 'As duas: contrata e executa',
};

const t = (v) => String(v == null ? '' : v).trim();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ---------- Empresa (quem assina) ---------- */

export function empresa() { return estado().empresa; }

export function salvarEmpresa(dados, por) {
  const d = {
    nome: t(dados.nome), razaoSocial: t(dados.razaoSocial), sigla: t(dados.sigla).toUpperCase().slice(0, 3), ein: t(dados.ein), atuacao: dados.atuacao,
    especialidades: t(dados.especialidades), endereco: t(dados.endereco), cidade: t(dados.cidade), estado: t(dados.estado).toUpperCase(), zip: t(dados.zip),
    telefone: t(dados.telefone), email: t(dados.email), site: t(dados.site), licencas: t(dados.licencas), seguros: t(dados.seguros), termosProposta: t(dados.termosProposta),
  };
  if (!d.nome) return { erro: 'Informe o nome da empresa (como aparece para o cliente).' };
  if (!ATUACOES[d.atuacao]) return { erro: 'Escolha como a empresa atua.' };
  if (d.estado && !/^[A-Z]{2}$/.test(d.estado)) return { erro: 'Estado com 2 letras (ex.: NH).' };
  if (d.zip && !/^\d{5}(-\d{4})?$/.test(d.zip)) return { erro: 'ZIP code com 5 dígitos (ex.: 03101).' };
  if (d.email && !EMAIL.test(d.email)) return { erro: 'E-mail inválido.' };
  if (!d.sigla) d.sigla = d.nome.split(/\s+/).map((p) => p[0]).join('').slice(0, 3).toUpperCase();
  const e = empresa();
  const mudou = Object.keys(d).filter((k) => (e[k] || '') !== d[k]);
  Object.assign(e, d);
  if (mudou.length) auditar('Empresa', 'Perfil da empresa alterado: ' + mudou.join(', '), '', '', '', por);
  salvar();
  return { ok: true };
}

/* Logo já reduzida (data URL). null tira a logo. */
export function definirLogo(dataUrl, por) {
  empresa().logo = dataUrl || null;
  auditar('Empresa', dataUrl ? 'Logo da empresa trocada' : 'Logo da empresa removida', '', '', '', por);
  salvar();
}

export function enderecoDaEmpresa(e = empresa()) {
  return [e.endereco, e.cidade, [e.estado, e.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}

/* ---------- Contatos (os de fora) ---------- */

export function contatos() { return estado().contatos || []; }
export function contato(id) { return contatos().find((c) => c.id === id); }
export function contatosCom(papel) { return contatos().filter((c) => c.papeis.includes(papel)).sort((a, b) => a.nome.localeCompare(b.nome)); }
export function nomeContato(id) { return (contato(id) || {}).nome || ''; }

export function salvarContato(id, dados, por) {
  const d = {
    nome: t(dados.nome), pessoa: t(dados.pessoa), email: t(dados.email), telefone: t(dados.telefone),
    endereco: t(dados.endereco), cidade: t(dados.cidade), estado: t(dados.estado).toUpperCase(), zip: t(dados.zip),
    papeis: Object.keys(PAPEIS).filter((p) => (dados.papeis || []).includes(p)),
    etapas: (dados.etapas || []).map(t).filter(Boolean), notas: t(dados.notas),
  };
  if (!d.nome) return { erro: 'Informe o nome (empresa ou pessoa).' };
  if (!d.papeis.length) return { erro: 'Marque pelo menos um: construtora, cliente ou fornecedor.' };
  if (d.email && !EMAIL.test(d.email)) return { erro: 'E-mail inválido.' };
  if (d.estado && !/^[A-Z]{2}$/.test(d.estado)) return { erro: 'Estado com 2 letras (ex.: NH).' };
  if (d.zip && !/^\d{5}(-\d{4})?$/.test(d.zip)) return { erro: 'ZIP code com 5 dígitos.' };
  if (!d.papeis.includes('fornecedor')) d.etapas = [];
  if (contatos().some((c) => c.id !== id && c.nome.toLowerCase() === d.nome.toLowerCase())) return { erro: 'Já existe um contato com esse nome.' };
  estado().contatos = estado().contatos || [];
  if (id) {
    const c = contato(id);
    Object.assign(c, d);
    auditar('Contatos', 'Contato alterado: ' + d.nome, '', d.papeis.join(', '), '', por);
    salvar();
    return { ok: true, id };
  }
  const novo = { id: novoId('ct'), ...d, criadoEm: Date.now() };
  estado().contatos.push(novo);
  auditar('Contatos', 'Contato criado: ' + d.nome, '', d.papeis.join(', '), '', por);
  salvar();
  return { ok: true, id: novo.id };
}

/* Onde o contato aparece (não se exclui quem está em uso). */
export function usosDoContato(id) {
  const d = estado();
  const projetos = ((d.measure && d.measure.projetos) || []).filter((p) => p.contratanteId === id || p.donoId === id).map((p) => 'projeto ' + p.nome);
  const obras = d.obras.filter((o) => o.contratanteId === id || o.donoId === id).map((o) => 'obra ' + o.nome);
  return projetos.concat(obras);
}

export function excluirContato(id, por) {
  const usos = usosDoContato(id);
  if (usos.length) return { erro: 'Em uso: ' + usos.join(', ') + '. Troque antes de excluir.' };
  const c = contato(id);
  estado().contatos = contatos().filter((x) => x.id !== id);
  auditar('Contatos', 'Contato excluído: ' + c.nome, '', '', '', por);
  salvar();
  return { ok: true };
}

/* ---------- Partes de um projeto ou obra ---------- */

/* Quem recebe a proposta e o diário: a construtora que contrata, ou o próprio dono quando contrata direto. */
export function contratanteDe(x) { return contato(x.contratanteId) || null; }
/* O dono da obra; sem dono separado, o contratante é o dono. */
export function donoDe(x) { return contato(x.donoId) || contratanteDe(x); }
export function textoPartes(x) {
  const c = contratanteDe(x), o = contato(x.donoId);
  return [c ? c.nome : '', o && o.id !== (c && c.id) ? 'para ' + o.nome : ''].filter(Boolean).join(' · ');
}
