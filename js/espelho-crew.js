/* KORbuild — o Crew no espelho do aparelho (docs/banco.md §11): do banco para o formato que js/crew.js e js/settings.js
 * já usam (funcionários com valor hora, regras de jornada, encargos, equipes, batidas, aprovações, orçamentos e
 * registros de localização). Cada linha que veio do banco leva `_banco: true`; o que nasceu no aparelho e ainda não
 * subiu fica sem essa marca (js/sincronizacao.js) e é preservado quando o espelho é relido. */

import { cliente } from './conta.js';

const ms = (t) => (t ? new Date(t).getTime() : null);
const PAGINA = 1000;   // o servidor entrega no máximo 1000 linhas por pedido

/* Lê a tabela inteira, de mil em mil. */
export async function lerTudo(tabela, ordem, desempate = 'id') {
  const linhas = [];
  for (let de = 0, paginas = 0; ; de += PAGINA) {
    if (++paginas > 200) throw new Error('A leitura de ' + tabela + ' não terminou (mais de 200 mil linhas).');
    const { data, error } = await cliente().from(tabela).select('*').order(ordem).order(desempate).range(de, de + PAGINA - 1);
    if (error) throw error;
    linhas.push(...(data || []));
    if (!data || data.length < PAGINA) break;
  }
  return linhas;
}

export function lerCrew() {
  return Promise.all([
    lerTudo('equipes', 'nome'), lerTudo('funcionarios', 'nome'), lerTudo('funcionario_valores', 'desde'), lerTudo('encargos_versoes', 'desde'),
    lerTudo('regras_jornada_versoes', 'desde'), lerTudo('batidas', 'em'), lerTudo('batidas_conferidas', 'em', 'batida_id'),
    lerTudo('aprovacoes_semana', 'em'), lerTudo('orcamentos_obra', 'em'), lerTudo('localizacoes', 'em'),
  ]).then(([equipes, funcionarios, valores, encargos, regras, batidas, conferidas, aprovacoes, orcamentos, localizacoes]) =>
    ({ equipes, funcionarios, valores, encargos, regras, batidas, conferidas, aprovacoes, orcamentos, localizacoes }));
}

export function batidaDoBanco(b, conferidas) {
  const c = conferidas && conferidas.get(b.id);
  const ajuste = b.modo === 'ajuste';
  return {
    id: b.id, funcionarioId: b.funcionario_id, tipo: b.tipo, obraId: b.obra_id, etapa: b.etapa || null, em: ms(b.em),
    lat: b.lat, lon: b.lon, precisao: b.precisao, dentroCerca: b.dentro_cerca, fonteGps: b.fonte_gps, registradoPor: b.registrado_por,
    modo: b.modo, foto: !!b.foto_path, nota: b.nota || null,
    ajuste: ajuste ? { motivo: b.ajuste_motivo, por: b.registrado_por_nome, em: ms(b.recebida_em) } : null,
    conferida: !!c, conferidaPor: c ? c.por_nome : undefined, _banco: true,
  };
}

/* Monta as partes do Crew em d (a empresa do espelho). `antes` = o que o aparelho tinha: o que ainda não subiu fica. */
export function aplicarCrew(d, lido, usuarios, antes) {
  const nomeDe = new Map(usuarios.map((u) => [u.id, u.nome]));
  const usuarioDoFuncionario = new Map(usuarios.filter((u) => u.funcionarioId).map((u) => [u.funcionarioId, u.id]));
  const valoresDe = new Map();
  for (const v of lido.valores) {
    if (!valoresDe.has(v.funcionario_id)) valoresDe.set(v.funcionario_id, []);
    valoresDe.get(v.funcionario_id).push({ desde: v.desde, valor: Number(v.valor), motivo: v.motivo, por: nomeDe.get(v.por) || '', em: ms(v.em) });
  }
  d.funcionarios = lido.funcionarios.map((f) => ({
    id: f.id, nome: f.nome, funcao: f.funcao, equipeId: f.equipe_id || null, admissao: f.admissao, valores: valoresDe.get(f.id) || [],
    usuarioId: usuarioDoFuncionario.get(f.id) || null, codigo: f.codigo, telefone: f.telefone, emergencia: f.emergencia,
    classificacao: f.classificacao, flsa: f.flsa, situacao: f.situacao, desligamento: f.desligamento || '', avisoGps: f.aviso_gps_em || null,
    certificacoes: f.certificacoes || [],
  }));
  // sem nada configurado: a regra padrão (FLSA federal) vale; encargos sem versão = nenhum (a empresa ainda não definiu)
  if (lido.regras.length) {
    d.settings.regras = lido.regras.map((r) => ({ id: r.id, desde: r.desde, nome: r.nome, semanal: r.semanal, diaria: r.diaria, intervalo: r.intervalo, nota: r.nota, motivo: r.motivo, por: nomeDe.get(r.por) || '', em: ms(r.em) }));
  }
  d.settings.encargos = lido.encargos.length
    ? lido.encargos.map((e) => ({ id: e.id, desde: e.desde, itens: e.itens, motivo: e.motivo, por: nomeDe.get(e.por) || '', em: ms(e.em) }))
    : [{ id: 'en-vazio', desde: '2000-01-01', itens: [], motivo: '', por: '', em: 0 }];

  const conferidas = new Map(lido.conferidas.map((c) => [c.batida_id, c]));
  const doBanco = lido.batidas.map((b) => batidaDoBanco(b, conferidas));
  const locais = ((antes && antes.crew) || {}).batidas || [];
  const pendentes = locais.filter((b) => !b._banco);
  const nosBanco = new Set(doBanco.map((b) => b.id));
  const orcamentos = {};
  for (const o of lido.orcamentos) {   // em ordem: a última versão de cada obra vale
    orcamentos[o.obra_id] = { valor: Number(o.valor), avanco: o.avanco == null ? null : Number(o.avanco), porEtapa: o.por_etapa || {}, por: nomeDe.get(o.por) || '', em: ms(o.em) };
  }
  const locPend = (((antes && antes.crew) || {}).localizacoes || []).filter((l) => !l._banco);
  d.crew = {
    equipes: lido.equipes.map((e) => ({ id: e.id, nome: e.nome, encarregadoUsuarioId: e.encarregado_id || null, obraBaseId: e.obra_base_id || null, ativa: e.ativa })),
    batidas: doBanco.concat(pendentes.filter((b) => !nosBanco.has(b.id))),
    excursoes: [], historico: [], orcamentos,
    aprovacoes: lido.aprovacoes.map((a) => ({ funcionarioId: a.funcionario_id, semana: a.semana, status: a.status, por: a.por_nome, motivo: a.motivo, em: ms(a.em) })),
    localizacoes: lido.localizacoes.map((l) => ({ id: l.id, funcionarioId: l.funcionario_id, em: ms(l.em), lat: l.lat, lon: l.lon, precisao: l.precisao, gatilho: l.gatilho, obraId: l.obra_id, _banco: true }))
      .concat(locPend),
  };
}

/* A presença das prestadoras nas obras desta empresa (presenca_na_obra): cada uma vira uma empresa vizinha, com
 * as batidas que o banco entrega — sem valores nem localização (HS-10). `vizinhas` é o mesmo mapa dos diários recebidos. */
export async function lerPresencaDasPrestadoras(obras, dias = 14) {
  const ate = new Date(), de = new Date(Date.now() - dias * 864e5);
  const iso = (t) => t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
  const respostas = await Promise.all(obras.map((o) => cliente().rpc('presenca_na_obra', { p_obra: o.id, p_de: iso(de), p_ate: iso(ate) })
    .then(({ data, error }) => (error ? [] : data || []).map((x) => ({ ...x, minha_obra: o.id })))));
  return respostas.flat();
}

export function aplicarPresenca(vizinhas, presencas, novaEmpresa, obraDoBanco, minhaEmpresaId) {
  // a quarteirizada (nível 2 em diante) chega com as concorrências (fatia 7): aqui, as prestadoras ligadas direto às minhas obras
  for (const x of presencas.filter((y) => y.nivel === 1)) {
    const emp = x.empresa;
    const v = vizinhas[emp.id] = vizinhas[emp.id] || novaEmpresa({ id: emp.id, nome: emp.nome, atuacao: 'prestadora', modulos: ['daily', 'crew'], logo: null, plano: {} });
    if (!v.obras.some((o) => o.id === x.obra.id)) v.obras.push(obraDoBanco({ ...x.obra, contratante_id: null, lat: null, lon: null }, { empresaId: minhaEmpresaId, obraId: x.minha_obra }));
    for (const p of x.pessoas || []) {
      if (!v.funcionarios.some((f) => f.id === p.id)) {
        v.funcionarios.push({ id: p.id, nome: p.nome, funcao: p.funcao, equipeId: null, admissao: '2000-01-01', valores: [], usuarioId: null, codigo: '', telefone: '', emergencia: '',
          classificacao: 'w2', flsa: 'nao-isento', situacao: 'ativo', desligamento: '', avisoGps: null, certificacoes: [] });
      }
      for (const b of p.batidas || []) {
        if (v.crew.batidas.some((y) => y.id === b.id)) continue;
        v.crew.batidas.push({ id: b.id, funcionarioId: p.id, tipo: b.tipo, obraId: b.obra_id || 'outra-obra', etapa: b.etapa || null, em: ms(b.em), lat: null, lon: null,
          dentroCerca: b.dentro_cerca, fonteGps: 'gps', registradoPor: null, modo: b.ajuste ? 'ajuste' : 'equipe', foto: false, ajuste: null, conferida: false, _banco: true });
      }
    }
  }
}

/* ---------- Cronograma (fatia 5, docs/banco.md §12) ---------- */

export function lerCronograma() {
  return Promise.all([
    lerTudo('cronograma_etapas', 'ordem'), lerTudo('etapa_avancos', 'em'), lerTudo('linhas_base', 'em'), lerTudo('publicacoes_cronograma', 'em'),
    lerTudo('modelos_cronograma', 'nome'),
    cliente().rpc('cronogramas_recebidos', { p_obra: null }).then(({ data, error }) => (error ? [] : data || [])),
  ]).then(([etapas, avancos, bases, publicacoes, modelos, recebidos]) => ({ etapas, avancos, bases, publicacoes, modelos, recebidos }));
}

/* Monta d.cronogramas e d.modelosCronograma no formato de js/cronograma.js; devolve o que a empresa recebeu (compartilhados). */
export function aplicarCronograma(d, lido) {
  const histPor = new Map();
  for (const a of lido.avancos) {
    if (!histPor.has(a.etapa_id)) histPor.set(a.etapa_id, []);
    histPor.get(a.etapa_id).push({ em: ms(a.em), data: a.data, antes: a.antes, pct: a.pct, fonte: a.fonte, rdoId: a.rdo_id, rdoNumero: a.rdo_numero, por: a.por_nome });
  }
  d.cronogramas = {};
  const cron = (obraId) => (d.cronogramas[obraId] = d.cronogramas[obraId] || { etapas: [], bases: [], publicacoes: [] });
  for (const e of lido.etapas) cron(e.obra_id).etapas.push({ id: e.id, nome: e.nome, inicio: e.inicio, fim: e.fim, responsavelId: e.responsavel_id || null, pct: e.pct, historico: histPor.get(e.id) || [] });
  for (const b of lido.bases) cron(b.obra_id).bases.push({ id: b.id, em: ms(b.em), por: b.por_nome, motivo: b.motivo, etapas: b.etapas });
  for (const p of lido.publicacoes) cron(p.obra_id).publicacoes.push({ id: p.id, versao: p.versao, em: ms(p.em), por: p.por_nome });
  d.modelosCronograma = lido.modelos.map((m) => ({ id: m.id, nome: m.nome, etapas: m.etapas }));
  return lido.recebidos.map((p) => ({
    tipo: 'cronograma', id: p.id, versao: p.versao, em: ms(p.em), por: p.por_nome,
    de: p.retrato.de, para: { empresaId: p.para_empresa_id, obraId: p.para_obra_id },
    obraNome: p.retrato.obraNome, cronograma: p.retrato.cronograma, responsaveis: p.retrato.responsaveis || {},
  }));
}

/* ---------- Measure (fatia 6, docs/banco.md §13) ---------- */

export function lerMeasure() {
  return Promise.all([
    lerTudo('projetos', 'nome'), lerTudo('folhas', 'criada_em'), lerTudo('condicoes', 'criado_em'), lerTudo('typicais', 'em'),
    lerTudo('itens', 'nome'), lerTudo('item_precos', 'em'), lerTudo('assemblies', 'nome'), lerTudo('margens_versoes', 'em'), lerTudo('propostas_emitidas', 'emitida_em'),
  ]).then(([projetos, folhas, condicoes, typicais, itens, precos, assemblies, margens, propostas]) => ({ projetos, folhas, condicoes, typicais, itens, precos, assemblies, margens, propostas }));
}

/* Do banco para o formato de js/measure.js. O que não é da empresa (preços e margens sem permissão) simplesmente não vem. */
export function aplicarMeasure(d, lido) {
  const propostasPor = new Map();
  for (const p of lido.propostas) {
    if (!propostasPor.has(p.projeto_id)) propostasPor.set(p.projeto_id, []);
    propostasPor.get(p.projeto_id).push({ id: p.id, numero: p.numero, emitidaEm: p.emitida_em, por: p.por_nome, total: Number(p.total), dados: p.retrato, _banco: true });
  }
  const precosPor = new Map();
  for (const x of lido.precos) {
    if (!precosPor.has(x.item_id)) precosPor.set(x.item_id, []);
    precosPor.get(x.item_id).push({ id: x.id, valor: Number(x.valor), desde: x.desde, fonte: x.fonte, fornecedorId: x.fornecedor_id || null, por: x.por_nome, em: ms(x.em), _banco: true });
  }
  const nomeDoArquivo = (path) => (path || '').split('/').pop().replace(/\.pdf$/i, '');
  d.measure = {
    projetos: lido.projetos.map((p) => ({
      id: p.id, nome: p.nome, contratanteId: p.contratante_id, donoId: p.dono_id || null, endereco: p.endereco, cidade: p.cidade, estado: p.estado, zip: p.zip,
      tipo: p.tipo, situacao: p.situacao, descricao: p.descricao, obraId: p.obra_id || null, estimadorId: p.estimador_id || null, prazoProposta: p.prazo_proposta || null,
      proposta: Object.keys(p.proposta_rascunho || {}).length ? p.proposta_rascunho : undefined, cotacao: Object.keys(p.cotacao || {}).length ? p.cotacao : undefined,
      propostas: propostasPor.get(p.id) || [], criadoEm: ms(p.criado_em), alteradoEm: ms(p.atualizado_em),
    })),
    folhas: lido.folhas.map((f) => ({ id: f.id, projetoId: f.projeto_id, nome: f.nome, arquivo: { tipo: 'storage', path: f.arquivo_path, id: nomeDoArquivo(f.arquivo_path), nome: f.arquivo_nome }, pagina: f.pagina, escala: f.escala || null, criadaEm: ms(f.criada_em) })),
    condicoes: lido.condicoes.map((c) => ({ id: c.id, projetoId: c.projeto_id, nome: c.nome, tipo: c.tipo, cor: c.cor, props: c.props || {}, assemblies: c.assemblies || [], folhas: c.folhas || [], oculta: c.oculta, medicoes: c.medicoes || [], _banco: { versao: c.versao } })),
    typicais: lido.typicais.map((t) => ({ id: t.id, projetoId: t.projeto_id, folhaId: t.folha_id, nome: t.nome, regiao: t.regiao, ocorrencias: t.ocorrencias, por: t.por_nome, em: ms(t.em) })),
    itens: lido.itens.map((i) => ({ id: i.id, codigo: i.codigo, nome: i.nome, categoria: i.categoria, unidade: i.unidade, etapa: i.etapa, nota: i.nota, precos: precosPor.get(i.id) || [] })),
    assemblies: lido.assemblies.map((a) => ({ id: a.id, nome: a.nome, tipo: a.tipo, descricao: a.descricao, linhas: a.linhas })),
    margens: lido.margens.map((m) => ({ id: m.id, overheadPct: Number(m.overhead_pct), lucroPct: Number(m.lucro_pct), modo: m.modo, impostoMaterialPct: Number(m.imposto_material_pct), desde: m.desde, motivo: m.motivo, por: m.por_nome, em: ms(m.em), _banco: true })),
  };
  // as propostas de projetos que já saíram ficam guardadas (consulta pelo número)
  d.measure.propostasSemProjeto = lido.propostas.filter((p) => !lido.projetos.some((x) => x.id === p.projeto_id)).map((p) => ({ numero: p.numero, projetoNome: p.projeto_nome, emitidaEm: p.emitida_em, total: Number(p.total) }));
}
