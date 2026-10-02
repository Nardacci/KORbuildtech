/* KORbuild Daily — lacre do RDO aprovado.
 * Na aprovação, o conteúdo do relatório (incluindo a impressão digital de cada foto) vira um
 * texto canônico e recebe um hash SHA-256. O código de verificação são os 12 primeiros
 * caracteres. Qualquer alteração posterior muda o hash, e a verificação acusa. */

import { sha256 } from './util.js';

export function conteudoCanonico(r, obra) {
  return JSON.stringify({
    obra: { id: obra.id, nome: obra.nome, endereco: obra.endereco, cidade: obra.cidade },
    rdo: r.numero,
    data: r.data,
    autor: r.autor,
    clima: r.clima,
    equipe: r.equipe,
    equipamentos: r.equipamentos,
    atividades: r.atividades.map((a) => [a.descricao, a.local, a.situacao]),
    ocorrencias: r.ocorrencias.map((o) => [o.tipo, o.descricao]),
    fotos: r.fotos.map((f) => [f.hashOriginal, f.legenda, f.tiradaEm, f.lat, f.lon]),
    observacoes: r.observacoes,
    aprovadoPor: r.aprovadoPor,
    aprovadoEm: r.aprovadoEm,
  });
}

export async function lacrar(r, obra) {
  r.hashDocumento = await sha256(conteudoCanonico(r, obra));
  r.codigo = r.hashDocumento.slice(0, 12).toUpperCase().match(/.{4}/g).join('-');
}

/* true = conteúdo atual bate com o lacre. */
export async function conferirLacre(r, obra) {
  if (!r.hashDocumento) return false;
  return (await sha256(conteudoCanonico(r, obra))) === r.hashDocumento;
}
