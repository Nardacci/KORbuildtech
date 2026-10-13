/* KORbuild — o espelho do Supabase no aparelho (docs/banco.md §10.4), para as telas do Daily do protótipo
 * funcionarem com a conta de verdade, com e sem internet.
 *
 * Ao entrar no Daily pela página oficial, o app lê a empresa no banco (obras, contatos, usuários, perfis e diários) e
 * monta o mesmo "banco do aparelho" que o protótipo usa: { empresas: { [id]: dados } }. Os diários que a empresa
 * recebe das prestadoras (diarios_recebidos) entram como empresas vizinhas, que é como as telas já esperam (HS-11).
 * Fica numa chave própria de cada usuário: nunca mistura com a demonstração nem com outra conta no mesmo aparelho.
 * O que o aparelho mudou e ainda não subiu (js/sincronizacao.js) é preservado quando o espelho é relido. */

import { tr } from './i18n.js';
import { usarIdsUuid } from './util.js';
import { usarArmazem, bancoDeDados, definirEstado, definirBuscaRemota, idMiniatura } from './armazem.js';
import { criarSettings } from './settings.js';
import { conta, cliente, iniciar, emailAtual } from './conta.js';
import { lerTudo, lerCrew, aplicarCrew, lerPresencaDasPrestadoras, aplicarPresenca, lerCronograma, aplicarCronograma, lerMeasure, aplicarMeasure } from './espelho-crew.js';

export const espelho = { pronto: false, lendo: null, lidoEm: 0, erro: null };
/* Quem tem algo para subir antes de o espelho ser relido (o Measure leva as gravações agrupadas; js/measure-oficial.js). */
const antesDeLer = [];
export function antesDeMontar(fn) { antesDeLer.push(fn); }
const depoisDeLer = [];
export function depoisDeMontar(fn) { depoisDeLer.push(fn); }
/* Antes de o espelho novo entrar no lugar do antigo: quem tem mudanças locais ainda não subidas as carrega para o novo. */
const aoTrocar = [];
export function aoTrocarEspelho(fn) { aoTrocar.push(fn); }

const ms = (t) => (t ? new Date(t).getTime() : null);
const cidadeDe = (o) => [o.municipio, [o.estado, o.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');

/* Fotos que não estão no aparelho: o caminho no Storage de cada id (e da miniatura), para pedir um link temporário. */
const caminhos = new Map();
async function fotoRemota(id) {
  const path = caminhos.get(id);
  if (!path) return '';
  const { data } = await cliente().storage.from('diarios').createSignedUrl(path, 3600);
  return (data && data.signedUrl) || '';
}
export function lembrarCaminhos(fotos) {
  for (const f of fotos || []) {
    if (f.path) caminhos.set(f.id, f.path);
    if (f.pathMini) caminhos.set(idMiniatura(f.id), f.pathMini);
  }
}

/* A área do aparelho deste usuário (chamar antes de ler o espelho). */
export function prepararArmazem(userId) {
  usarIdsUuid();
  usarArmazem({ chave: 'kbt.oficial.v1.' + userId, fotos: 'kbt-oficial-fotos-' + userId, sessao: 'kbt.oficial.sessao' });
  definirBuscaRemota(fotoRemota);
}

/* ---------- Do banco para o formato do protótipo ---------- */

export function conteudoDe(r) {
  return { clima: r.clima, equipe: r.equipe, equipamentos: r.equipamentos, atividades: r.atividades, ocorrencias: r.ocorrencias, observacoes: r.observacoes || '' };
}
/* O que identifica uma mudança feita no aparelho (conteúdo, fotos e o dia sem atividade). */
export function assinatura(r) {
  return JSON.stringify([conteudoDe(r), (r.fotos || []).map((f) => [f.id, f.legenda || '', !!f.path]), r.semAtividade || null]);
}

export function rdoDoBanco(x) {
  const c = x.conteudo || {};
  const r = {
    id: x.id, obraId: x.obra_id, data: x.data, numero: x.numero, status: x.status,
    sync: x.status === 'rascunho' ? 'local' : 'enviado',
    autor: x.autor_nome, criadoEm: ms(x.criado_no_aparelho_em || x.criado_em),
    clima: c.clima || { manha: {}, tarde: {}, fonte: null }, equipe: c.equipe || [], equipamentos: c.equipamentos || [],
    atividades: c.atividades || [], ocorrencias: c.ocorrencias || [], observacoes: c.observacoes || '',
    fotos: (x.fotos || []).map((f) => ({
      id: f.id, legenda: f.legenda || '', tiradaEm: ms(f.tirada_em), lat: f.lat, lon: f.lon, fonteGps: f.fonte_gps, precisao: f.precisao,
      largura: f.largura, altura: f.altura, tamanho: f.tamanho || 0, hashOriginal: f.hash_original, path: f.path, pathMini: f.path_mini,
    })),
    historico: (x.historico || []).map((h) => ({ id: h.id, em: ms(h.em), quem: h.quem, acao: h.acao })),
    semAtividade: x.sem_atividade || null, motivoAjuste: x.motivo_ajuste || null,
    enviadoEm: ms(x.enviado_em), primeiroEnvioEm: ms(x.primeiro_envio_em),
    aprovadoEm: ms(x.aprovado_em), aprovadoPor: x.aprovado_por || null, aprovadoPorEmpresa: x.aprovado_por_empresa || null,
    hashDocumento: x.hash_documento || null, codigo: x.codigo || null,
    _banco: { versao: x.versao, status: x.status },
  };
  r._sinc = assinatura(r);
  lembrarCaminhos(r.fotos);
  return r;
}

function obraDoBanco(o, vinculo) {
  return {
    id: o.id, nome: o.nome, contratanteId: o.contratante_id || null, donoId: o.dono_id || null,
    endereco: o.endereco || '', municipio: o.municipio || '', estado: o.estado || '', zip: o.zip || '', cidade: cidadeDe(o),
    lat: o.lat, lon: o.lon, cerca: { lat: o.lat, lon: o.lon, raio: o.raio || 150 },
    inicio: o.inicio, prazo: o.prazo, responsavelId: o.responsavel_id || null, diasTrabalho: o.dias_trabalho || [1, 2, 3, 4, 5],
    situacao: o.situacao || 'andamento', vinculo: vinculo || (o.vinculo_empresa_id ? { empresaId: o.vinculo_empresa_id, obraId: o.vinculo_obra_id } : undefined),
  };
}

const nomeDoPerfil = (p) => (p.chave ? tr(p.nome) : p.nome);

function dadosBase(empresa, por) {
  const settings = criarSettings('2000-01-01', Date.now(), por);
  settings.auditoria = [];
  return {
    criadoEm: Date.now(), offlineSimulado: false, oficial: true,
    empresa, usuarios: [], contasDemo: [], interesses: [], contatos: [], obras: [], rdos: [], funcionarios: [],
    settings, crew: { equipes: [], batidas: [], excursoes: [], aprovacoes: [], historico: [], orcamentos: {}, localizacoes: [] },
    cronogramas: {}, modelosCronograma: [], measure: { projetos: [], folhas: [], condicoes: [], typicais: [], itens: [], assemblies: [], margens: [] },
  };
}

/* ---------- Montar (e remontar) o espelho ---------- */

/* O diário que ainda tem algo no aparelho para subir (conteúdo, fotos, envio ou o dia sem atividade). */
export function temPendencia(r) {
  if (r.status === 'aprovado') return false;
  if (!r._banco) return true;
  if (r._sinc !== assinatura(r)) return true;
  return r.status === 'enviado' && ['rascunho', 'ajustes'].includes(r._banco.status);
}

const ler = (tabela, ordem) => lerTudo(tabela, ordem);   // de mil em mil: o servidor entrega no máximo 1000 por pedido

/* Lê o banco e remonta o espelho. Quem acabou de gravar algo (aviso aceito, aprovação, envio) chama montar(true): se já
 * há uma leitura em andamento, ela começou antes da gravação e pode estar velha, então vem uma leitura nova logo depois
 * (uma só, para todos que pediram nesse meio-tempo). Sem o argumento, reaproveita a leitura em andamento. */
export function montar(atualizado = false) {
  if (espelho.lendo) {
    if (!atualizado) return espelho.lendo;
    if (!espelho.proxima) {
      espelho.proxima = espelho.lendo.catch(() => {}).then(() => { espelho.proxima = null; return montar(); });
    }
    return espelho.proxima;
  }
  espelho.lendo = (async () => {
    await iniciar();
    for (const fn of antesDeLer) await fn().catch(() => {});
    if (!conta.sessao || !conta.membro || !conta.empresa) throw new Error('sem-conta');
    prepararArmazem(conta.sessao.user.id);
    const e = conta.empresa;
    const [obras, contatos, membros, rdos, fotos, historico, recebidos, crewLido, cronLido, measureLido] = await Promise.all([
      ler('obras', 'nome'), ler('contatos', 'nome'), ler('membros', 'nome'), ler('rdos', 'data'), ler('rdo_fotos', 'ordem'), ler('rdo_historico', 'em'),
      cliente().rpc('diarios_recebidos', { p_obra: null }).then(({ data, error }) => { if (error) throw error; return data || []; }),
      lerCrew(), lerCronograma(), e.atuacao === 'construtora' ? null : lerMeasure(),
    ]);
    const empresa = {
      id: e.id, nome: e.nome, razaoSocial: e.razao_social, sigla: e.sigla, ein: e.ein, atuacao: e.atuacao, especialidades: e.especialidades,
      endereco: e.endereco, cidade: e.cidade, estado: e.estado, zip: e.zip, telefone: e.telefone, email: e.email, site: e.site,
      licencas: e.licencas, seguros: e.seguros, termosProposta: e.termos_proposta, logo: null,
      plano: { nome: (e.plano || {}).nome || '', status: (e.plano || {}).status || 'teste' },
      modulos: ['daily', 'crew', 'measure'],   // fatias 3 a 6; as concorrências chegam na 7 (o plano de cada empresa vem no fim do projeto)
      desde: (e.criada_em || '').slice(0, 10),
    };
    const d = dadosBase(empresa, conta.membro.nome);
    d.settings.perfis = conta.perfis.map((p) => ({ id: p.id, nome: nomeDoPerfil(p), descricao: p.descricao ? (p.chave ? tr(p.descricao) : p.descricao) : '', sistema: p.sistema, permissoes: p.permissoes }));
    d.usuarios = membros.map((m) => ({ id: m.id, nome: m.nome, cargo: m.cargo || '', telefone: m.telefone || '', perfilId: m.perfil_id, ativo: m.ativo, funcionarioId: m.funcionario_id || null, email: m.user_id === conta.sessao.user.id ? emailAtual() : '' }));
    d.contatos = contatos.map((c) => ({ id: c.id, nome: c.nome, pessoa: c.pessoa, papeis: c.papeis, email: c.email, telefone: c.telefone, endereco: c.endereco, cidade: c.cidade, estado: c.estado, zip: c.zip, etapas: c.etapas, notas: c.notas, contaId: c.conta_empresa_id || undefined }));
    d.obras = obras.map((o) => obraDoBanco(o));
    const porRdo = (lista) => lista.reduce((m, x) => { (m[x.rdo_id] = m[x.rdo_id] || []).push(x); return m; }, {});
    const fotosPor = porRdo(fotos), histPor = porRdo(historico);
    const doBanco = rdos.map((x) => rdoDoBanco({ ...x, fotos: fotosPor[x.id] || [], historico: histPor[x.id] || [] }));

    // o que o aparelho ainda não subiu fica (o banco não sabe dele, ou sabe uma versão mais velha)
    const antes = bancoDeDados();
    const minhaAntes = (antes && antes.empresas && antes.empresas[e.id]) || {};
    aplicarCrew(d, crewLido, d.usuarios, minhaAntes);
    const compartilhados = aplicarCronograma(d, cronLido);
    if (measureLido) aplicarMeasure(d, measureLido);
    const locais = minhaAntes.rdos || [];
    const pendentes = locais.filter(temPendencia);
    const ids = new Set(pendentes.map((r) => r.id));
    d.rdos = doBanco.filter((r) => !ids.has(r.id)).concat(pendentes);
    for (const r of pendentes) lembrarCaminhos(r.fotos);

    // diários recebidos das prestadoras (HS-11): cada prestadora vira uma empresa vizinha, com a obra ligada à minha
    const vizinhas = {};
    for (const x of recebidos) {
      const emp = x.empresa;
      const v = vizinhas[emp.id] = vizinhas[emp.id] || dadosBase({ id: emp.id, nome: emp.nome, atuacao: 'prestadora', modulos: ['daily'], logo: null, plano: {} }, '');
      if (!v.obras.some((o) => o.id === x.obra.id)) v.obras.push(obraDoBanco({ ...x.obra, contratante_id: null, lat: null, lon: null }, { empresaId: e.id, obraId: x.obra.vinculo_obra_id }));
      v.rdos.push(rdoDoBanco(x));
    }
    // quem bateu o ponto nas obras ligadas às minhas (sem valores nem localização, HS-10)
    if (e.atuacao !== 'prestadora' && obras.length) {
      aplicarPresenca(vizinhas, await lerPresencaDasPrestadoras(obras).catch(() => []), (emp) => dadosBase(emp, ''), obraDoBanco, e.id);
    }
    // a obra da prestadora chega sem datas: o período vem dos próprios diários recebidos
    for (const v of Object.values(vizinhas)) {
      for (const o of v.obras) {
        const datas = v.rdos.filter((r) => r.obraId === o.id).map((r) => r.data).sort();
        o.inicio = o.inicio || datas[0];
        o.prazo = o.prazo || datas[datas.length - 1];
      }
    }

    for (const fn of aoTrocar) { try { fn(d, minhaAntes); } catch (err) { console.error(err); } }
    definirEstado({ versao: 'oficial', oficial: true, padrao: e.id, empresas: { [e.id]: d, ...vizinhas }, compartilhados, concorrencias: [] });
    try { localStorage.setItem('kbt.oficial.sessao', conta.membro.id); } catch { /* sem armazenamento */ }
    espelho.pronto = true;
    espelho.lidoEm = Date.now();
    espelho.erro = null;
    for (const fn of depoisDeLer) { try { fn(); } catch (err) { console.error(err); } }
  })().catch((err) => { espelho.erro = err; throw err; }).finally(() => { espelho.lendo = null; });
  return espelho.lendo;
}

/* Sem internet ao abrir o app: usa o que já está no aparelho, se for desta conta. */
export function usarOQueTemNoAparelho() {
  if (!conta.sessao) return false;
  prepararArmazem(conta.sessao.user.id);
  const b = bancoDeDados();
  if (!b || !b.oficial) return false;
  espelho.pronto = true;
  return true;
}

/* O diário de um código, para o link do cliente (sem login): vira uma empresa no banco em memória, só para desenhar. */
export function espelhoDoLinkPublico(x) {
  const d = dadosBase({ id: x.empresa.id || 'publico', nome: x.empresa.nome, logo: null, modulos: ['daily'], plano: {} }, '');
  d.obras = [obraDoBanco({ ...x.obra, lat: null, lon: null, inicio: x.data, prazo: x.data })];
  const r = rdoDoBanco({ ...x, empresa_id: d.empresa.id });
  r.fotos.forEach((f, i) => { caminhos.delete(f.id); const foto = (x.fotos || [])[i] || {}; fotosPublicas.set(f.id, foto.url); fotosPublicas.set(idMiniatura(f.id), foto.url_mini || foto.url); });
  d.rdos = [r];
  definirBuscaRemota(async (id) => fotosPublicas.get(id) || '');
  return { versao: 'publico', padrao: d.empresa.id, empresas: { [d.empresa.id]: d }, compartilhados: [], concorrencias: [] };
}
const fotosPublicas = new Map();
