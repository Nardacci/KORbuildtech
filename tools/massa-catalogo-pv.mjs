/* KORbuild — o catálogo ampliado da massa da 1ª versão (docs/massa-primeira-versao.md): itens de várias etapas com histórico de preço, assemblies com perda e
 * arredondamento, fornecedores por etapa, condições medidas com cada assembly (para a lista de materiais ter de onde sair) e cotações enviadas e respondidas.
 * Grava só dados, como a pessoa (REST), pelas mesmas tabelas do app; NÃO muda o esquema; nunca apaga; pode rodar de novo (o que já existe é pulado).
 * Roda depois de tools/massa-primeira-versao.mjs e tools/massa-measure.mjs --conjunto=pv (precisa dos projetos e da primeira medição).
 * Uso: node tools/massa-catalogo-pv.mjs                              (banco local)
 *      KOR_DEMO_SENHA='…' node tools/massa-catalogo-pv.mjs --real    (Supabase do projeto; SUPABASE_ACCESS_TOKEN no ambiente) */

import { randomUUID } from 'node:crypto';
import { emailDe, SENHA_VARIAVEL, FAMILIAS, FAMILIA_DA_EMPRESA } from './massa-pv/dados.mjs';

const REAL = process.argv.includes('--real');
const { sql, rest, garantirUsuario } = await import(REAL ? '../tests/_supabase-real.mjs' : '../tests/_supabase-local.mjs');
const SENHA = process.env[SENHA_VARIAVEL] || (REAL ? '' : 'Kb1!local-massa-pv');
if (REAL && SENHA.length < 12) { console.error('Defina ' + SENHA_VARIAVEL + ' (12+ caracteres) no ambiente.'); process.exit(2); }
console.log('Catálogo ampliado da massa contra: ' + (REAL ? 'Supabase do projeto' : 'Supabase local'));

const aspas = (t) => String(t).replace(/'/g, "''");
const somar = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const hoje = new Date().toISOString().slice(0, 10);
const CORES = ['#e8590c', '#1d6fd1', '#2f9e44', '#9c36b5', '#d6336c', '#0c8599', '#f08c00', '#5c7cfa'];
const resumo = {};

for (const chave of Object.keys(FAMILIA_DA_EMPRESA)) {
  const fam = FAMILIAS[FAMILIA_DA_EMPRESA[chave]];
  const email = emailDe(chave, 'admin');   // o administrador tem catálogo e contatos (o orçamentista não mexe em contatos)
  const [emp] = await sql(`select e.id, e.nome from public.empresas e join public.membros m on m.empresa_id = e.id join auth.users u on u.id = m.user_id where u.email = '${email}'`);
  if (!emp) { console.log('  ' + chave + ': empresa não encontrada (rode tools/massa-primeira-versao.mjs antes)'); continue; }
  const uid = await garantirUsuario(email, 'Massa', SENHA);
  const por_nome = 'Massa pv';
  const r = resumo[emp.nome] = { itens: 0, precos: 0, assemblies: 0, fornecedores: 0, condicoes: 0, cotacoes: 0 };

  // ---- itens e preços (o antigo só tem preço de 200 dias atrás: acende "sem preço novo")
  const itensJa = await rest(uid, '/itens?select=id,codigo');
  const item = Object.fromEntries(itensJa.map((x) => [x.codigo, x.id]));
  for (const i of fam.itens) {
    if (!item[i.codigo]) {
      const [novo] = await rest(uid, '/itens', { metodo: 'POST', corpo: { codigo: i.codigo, nome: i.nome, categoria: 'material', unidade: i.unidade, etapa: i.etapa } });
      item[i.codigo] = novo.id; r.itens++;
    }
    const precosJa = await rest(uid, '/item_precos?select=id&item_id=eq.' + item[i.codigo]);
    if (!precosJa.length) {
      if (i.antigo) await rest(uid, '/item_precos', { metodo: 'POST', corpo: { item_id: item[i.codigo], desde: somar(hoje, -200), valor: i.preco, fonte: 'digitado', por_nome } });
      else {
        await rest(uid, '/item_precos', { metodo: 'POST', corpo: { item_id: item[i.codigo], desde: somar(hoje, -120), valor: Math.round(i.preco * 0.93 * 100) / 100, fonte: 'digitado', por_nome } });   // histórico: o preço subiu
        await rest(uid, '/item_precos', { metodo: 'POST', corpo: { item_id: item[i.codigo], desde: somar(hoje, -20), valor: i.preco, fonte: 'digitado', por_nome } });
        r.precos++;
      }
      r.precos++;
    }
  }

  // ---- assemblies
  const asmJa = await rest(uid, '/assemblies?select=id,nome');
  const assembly = Object.fromEntries(asmJa.map((x) => [x.nome, x.id]));
  const catalogo = await rest(uid, '/itens?select=id,codigo');
  const itemPor = Object.fromEntries(catalogo.map((x) => [x.codigo, x.id]));
  for (const [nome, linhas] of fam.assemblies) {
    if (assembly[nome]) continue;
    if (linhas.some(([codigo]) => !itemPor[codigo])) { console.log('  ' + emp.nome + ': "' + nome + '" pulado (item que não existe no catálogo)'); continue; }
    const [novo] = await rest(uid, '/assemblies', { metodo: 'POST', corpo: { nome, tipo: 'area', descricao: '', linhas: linhas.map(([codigo, formula, perda]) => ({ id: randomUUID(), passo: 1, perda, itemId: itemPor[codigo], formula })) } });
    assembly[nome] = novo.id; r.assemblies++;
  }

  // ---- fornecedores (contatos com as etapas que fornecem)
  const contatos = await rest(uid, '/contatos?select=id,nome');
  const fornecedor = {};
  for (const [nome, etapas] of fam.fornecedores) {
    let c = contatos.find((x) => x.nome === nome);
    if (!c) {
      [c] = await rest(uid, '/contatos', { metodo: 'POST', corpo: { nome, papeis: ['fornecedor'], pessoa: 'Sales desk', email: 'sales@' + nome.toLowerCase().replace(/[^a-z0-9]+/g, '') + '.example.com', telefone: '(603) 555-0' + (800 + r.fornecedores), cidade: 'Manchester', estado: 'NH', etapas } });
      r.fornecedores++;
    }
    fornecedor[nome] = c.id;
  }

  // ---- condições: cada assembly vira uma condição medida em cada projeto que já tem a primeira medição (geometria escalada, para as quantidades variarem)
  const projetos = await rest(uid, '/projetos?select=id,nome,cotacao&order=nome');
  const comMedicao = [];
  for (const p of projetos) {
    const cs = await rest(uid, '/condicoes?select=id,nome,medicoes,folhas&projeto_id=eq.' + p.id);
    const base = cs.find((x) => (x.medicoes || []).length);
    if (!base) continue;
    comMedicao.push(p);
    let k = 0;
    for (const [nome] of fam.assemblies) {
      k++;
      if (!assembly[nome] || cs.some((x) => x.nome === nome)) continue;
      const fator = [0.55, 0.8, 1.2, 1.5][k % 4];
      const m0 = base.medicoes[0];
      const pontos = m0.pontos.map(([x, y]) => [Math.round((m0.pontos[0][0] + (x - m0.pontos[0][0]) * fator) * 1000) / 1000, Math.round((m0.pontos[0][1] + (y - m0.pontos[0][1]) * fator) * 1000) / 1000]);
      await rest(uid, '/condicoes', { metodo: 'POST', corpo: { projeto_id: p.id, nome, tipo: 'area', cor: CORES[(k + 1) % CORES.length], props: {}, assemblies: [assembly[nome]], folhas: base.folhas, oculta: false, medicoes: [{ id: randomUUID(), em: Date.now(), pontos, folhaId: m0.folhaId, desconto: false }] } });
      r.condicoes++;
    }
  }

  // ---- cotações: o primeiro projeto com lista foi enviado aos dois fornecedores e um respondeu (com preços); o segundo foi enviado e está sem retorno
  const agora = Date.now();
  for (const [n, p] of comMedicao.slice(0, 2).entries()) {
    if (p.cotacao && (p.cotacao.envios || []).length) continue;
    const ids = Object.values(fornecedor);
    const envios = (n === 0 ? ids : ids.slice(0, 1)).map((f, j) => ({ fornecedorId: f, em: new Date(agora - (6 - j) * 864e5).toISOString(), por: 'Massa pv' }));
    const respostas = n === 0 ? [{ fornecedorId: ids[0], em: new Date(agora - 4 * 864e5).toISOString(), por: 'Massa pv', itens: 3 }] : [];
    await rest(uid, '/projetos?id=eq.' + p.id, { metodo: 'PATCH', corpo: { cotacao: { responderAte: somar(hoje, 5), observacoes: 'Delivery to the job site. Include freight in the unit price.', envios, respostas } } });
    if (respostas.length) {   // o preço que o fornecedor deu entra no histórico do item, com o fornecedor
      for (const i of fam.itens.filter((x) => !x.antigo).slice(0, 3)) {
        await rest(uid, '/item_precos', { metodo: 'POST', corpo: { item_id: itemPor[i.codigo], desde: somar(hoje, -4), valor: Math.round(i.preco * 0.96 * 100) / 100, fonte: 'cotacao', fornecedor_id: ids[0], por_nome: 'Massa pv' } });
      }
    }
    r.cotacoes++;
  }
  console.log('  ' + emp.nome + ': +' + r.itens + ' itens, +' + r.assemblies + ' assemblies, +' + r.fornecedores + ' fornecedores, +' + r.condicoes + ' condições, +' + r.cotacoes + ' cotações');
}
console.log('Pronto.');
