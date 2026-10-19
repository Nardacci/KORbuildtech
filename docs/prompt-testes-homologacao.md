# Prompt — testes e homologação da 1ª versão (sessão local)

Cole na sessão local (a que alcança o Supabase). Não contém senha nem token: `SUPABASE_ACCESS_TOKEN` e `KOR_DEMO_SENHA` ficam só no terminal.

```
Contexto: KORbuild (pasta korbuildtech), 1ª versão para computador: Measure Takeoff (com Concorrências e convites), Settings e o painel do Início. Vamos ampliar a massa de testes no Supabase real com vários assemblies, listas de materiais e cotações, e homologar o sistema.
Regras: nunca me peça nem imprima token, chave ou senha (SUPABASE_ACCESS_TOKEN e KOR_DEMO_SENHA só nas variáveis de ambiente deste terminal; diga apenas "definida / não definida"). Não apague nada e não rode limpeza. Não aplique migração. Só grave dados com os scripts abaixo. Não corrija código sem eu pedir: relate.

1. git pull origin main. Confirme o último commit e que o sw.js tem CACHE 'korbuild-v92' ou mais novo.
2. Confira as variáveis (só "definida / não definida"; a senha com 12+ caracteres).
3. Garanta a massa-base (idempotente; o que existe é pulado):
   node tools/massa-primeira-versao.mjs --real
   node tools/massa-measure.mjs --conjunto=pv --real
4. Amplie o catálogo, as condições e as cotações (só dados; idempotente):
   node tools/massa-catalogo-pv.mjs --real
   Mostre a saída inteira. Esperado, na primeira execução: em cada uma das 7 empresas (Maple Siding, Cobalt Framing, Bedrock Foundations, Lantern Roofing, Harbor & Pine, Granite Peak, Northgate) novos itens, assemblies, 2 fornecedores, condições e 1 a 2 cotações.
5. Confira por consultas SOMENTE de leitura (me mostre os números por empresa):
   select e.nome, (select count(*) from public.itens i where i.empresa_id = e.id) itens, (select count(*) from public.assemblies a where a.empresa_id = e.id) assemblies, (select count(*) from public.contatos c where c.empresa_id = e.id and 'fornecedor' = any (c.papeis)) fornecedores, (select count(*) from public.condicoes c where c.empresa_id = e.id) condicoes, (select count(*) from public.item_precos p where p.empresa_id = e.id) precos from public.empresas e where e.plano ->> 'massa' = 'pv' and exists (select 1 from public.itens i where i.empresa_id = e.id) order by e.nome;
   select e.nome, p.nome projeto, jsonb_array_length(coalesce(p.cotacao -> 'envios', '[]')) envios, jsonb_array_length(coalesce(p.cotacao -> 'respostas', '[]')) respostas from public.projetos p join public.empresas e on e.id = p.empresa_id where e.plano ->> 'massa' = 'pv' and p.cotacao <> '{}'::jsonb order by 1, 2;
6. Homologação automática contra o endereço de homologação (o GitHub Pages precisa estar com a versão nova: confira abrindo o sw.js do site):
   node tests/homologacao-pv.test.mjs https://nardacci.github.io/KORbuildtech/ --real --relatorio=docs/homologacao-<AAAA-MM-DD>.md
   Ela entra pela tela de login com os 7 administradores (pv.<chave>.admin@example.com) e só lê: painel, catálogo, assemblies, condições, lista para cotação por fornecedor, PDF do pedido de cotação e proposta (107 verificações). Mostre o resultado e, para cada FALHOU, o que a tela mostrou.
7. Se o relatório foi gerado, faça commit só dele (docs/homologacao-….md) e push no main. O relatório não contém senha.
8. Resuma: o que passou, o que falhou (com a causa provável) e o que fica para a homologação manual: a lista de checagem docs/testes/lista-checagem-primeira-versao.md (T01 a T106; blocos 12 e 13: painel, menu lateral, assemblies, listas de materiais, PDF de cotação e proposta).
9. Opcional, SÓ se eu digitar neste terminal "pode rodar os testes e2e reais": rode as suítes reais (tests/measure-oficial.test.mjs --real, tests/concorrencias-oficial.test.mjs --real, tests/seguranca.test.mjs --real). Elas criam e apagam os próprios usuários kb-e2e-*; sem essa frase, não rode.
Se algo pedir o que não está aqui, pare e pergunte.
```

Antes de colar, defina no PowerShell:

```
$env:SUPABASE_ACCESS_TOKEN = '…'
$env:KOR_DEMO_SENHA = '…'
```
