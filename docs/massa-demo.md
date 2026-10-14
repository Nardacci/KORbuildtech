# Massa de dados de demonstração

Dados fictícios, numa conta de verdade, para o portal e as apresentações mostrarem telas **com movimento** (e não vazias).
Script: `tools/massa-demo.mjs`; catálogo (empresas, pessoas, obras): `tools/massa-demo/dados.mjs`.

## O que existe (fase 1)

| Grupo | Empresas |
|---|---|
| **Construtoras** (só gestão) | Northfield Builders · Harborview Construction · Pine Ridge Homes (2 obras cada, com clientes) |
| **Prestadoras de construtoras** | Ridgeline Siding (Northfield e Pine Ridge) · Summit Framing (Northfield e Harborview) · Granite State Concrete (Northfield e Pine Ridge) · Coastal Roofing (Harborview) · Beacon Electric (Harborview) · Evergreen Drywall (Pine Ridge) |
| **Prestadoras independentes** (sem construtora, obra direto com o dono) | Lakeside Painting · Keystone Masonry · Merrimack Remodeling |

Em cada empresa: logins por papel (Administrador, Gestor nas construtoras; Administrador, Encarregado e Trabalhador nas prestadoras),
funcionários com valor hora e certificações (a pessoa do login é também funcionário), uma equipe, contatos e obras com cerca de GPS.
As obras das prestadoras estão **ligadas** à obra da construtora (a construtora recebe e aprova os diários e vê o ponto, sem dinheiro).

Movimento (feito pelas funções do app, cada uma como o dono do papel):
- **Ponto:** 5 semanas, com a equipe dividida entre as duas obras ativas, GPS em todas as batidas, faltas, algumas batidas fora da cerca,
  semanas aprovadas, uma devolvida e várias ainda por aprovar.
- **Diários:** 3 semanas em todos os estados (aprovado, aguardando aprovação, ajustes pedidos, rascunho de hoje, dia sem atividade por chuva),
  com **fotos** (as cenas desenhadas do protótipo, 2 ou 3 por diário nos últimos 10 dias) e uma obra de propósito sem relatório nos dois últimos dias.
- **Cronograma:** 4 etapas por obra das prestadoras, avanços até hoje, três obras atrasadas contra a linha de base (uma com nova linha de base e motivo)
  e publicação para a construtora (as atrasadas publicadas duas vezes).
- **Concorrências** (só entre empresas ligadas): *Exterior windows and doors* (aberta, duas propostas, pergunta e resposta), *Exterior trim and
  millwork* (fechada; a vencedora, Summit Framing, ainda não criou a obra: a tela dela mostra "Awarded"), *Gutters and downspouts* (aberta, uma
  proposta pendente e uma recusa) e *Final cleaning* (rascunho).
- **Planos:** ativa, teste terminando em 6 dias, teste vencido há 4 dias e uma empresa **suspensa** (Keystone Masonry). A obra "Foundations" da
  Granite State está concluída.

- **Measure** (`tools/massa-measure.mjs`, montado **pelas telas** com o Playwright, como nos testes `measure-oficial`, porque o Measure grava desenhos que só o app
  sabe montar): em 5 empresas (Ridgeline Siding, Summit Framing, Granite State Concrete, Lakeside Painting, Merrimack Remodeling) o catálogo (itens com preço, um assembly,
  margens) e 7 projetos com a planta de exemplo: 4 com escala conferida, medição e **proposta emitida**, 1 medido sem proposta e 2 só com a planta enviada.

## Logins

`demo.<empresa>.<papel>@example.com`, com `<empresa>` = `gc1`, `gc2`, `gc3` (construtoras), `s1` a `s6` (prestadoras de construtoras: Ridgeline,
Summit, Granite, Coastal, Beacon, Evergreen) e `i1` a `i3` (independentes: Lakeside, Keystone, Merrimack); `<papel>` = `admin`, `gestor`
(só construtoras), `encarregado`, `trabalhador` (só prestadoras). Exemplo: `demo.s2.encarregado@example.com`.
A **senha é a mesma para todos e fica só na variável `KOR_DEMO_SENHA`** da máquina de quem roda o script; nunca no repositório.

## Garantias

- **Nenhum e-mail sai.** Os endereços são `example.com` (reservado) e os avisos por e-mail de todos ficam desligados **antes** de qualquer
  evento (o sininho continua). Os membros entram direto, sem o convite por e-mail.
- **Nada é apagado.** O script só cria. Rodar de novo pula o que já existe (empresa, ponto, diários).
- **Fácil de achar e de tirar.** Toda empresa leva `plano.demo = true` (a administração mostra a etiqueta *Demo*). Os testes automáticos só
  limpam o que é `kb-e2e-…` e as cenas "… Local …": a massa nunca é tocada por eles.
- Usa as **mesmas funções do banco que o app**, cada uma como o dono do papel; por SQL só saem os membros, a ligação entre obras e o plano.

## Como rodar

```powershell
$env:KOR_DEMO_SENHA = '<senha inventada, 12+ caracteres, só nesta janela>'   # nunca no chat nem em arquivo
$env:SUPABASE_ACCESS_TOKEN = '<token pessoal>'                                # o mesmo dos testes
node tools/massa-demo.mjs --real                                              # estrutura, ponto, diarios, cronograma, concorrencias, planos
node tools/massa-demo.mjs --real --fase=estrutura,ponto,diarios,cronograma,concorrencias,retroagir,planos   # com os horários do passado
```

Fases: `estrutura`, `ponto`, `diarios`, `cronograma`, `concorrencias`, `retroagir`, `planos`. A fase `planos` sempre roda por último (e a empresa suspensa é
liberada antes de qualquer gravação e suspensa de novo no fim). Local (testa o script sem tocar no projeto): `tools/supabase-local.sh` e
`node tools/massa-demo.mjs` (cerca de 30 s; as fotos ficam em `tools/massa-demo/.cache/`, fora do repositório, e o Storage de mentira dos testes e das capturas
as lê de lá).

O Measure roda **depois**, num segundo comando (precisa do Playwright e da mesma `KOR_DEMO_SENHA`; sobe um servidorzinho local só para servir o app, que fala com o Supabase do `js/config.js`):

```powershell
node tools/massa-measure.mjs --real
```

### A fase `retroagir` (só quando pedida)

As funções do banco gravam "agora" no envio e na aprovação. Sem esta fase, todo diário de 3 semanas atrás aparece "enviado hoje, fora do prazo". Ela acerta, **só
nas empresas de demonstração** (`plano.demo`), o envio (fim da tarde do próprio dia, uns poucos atrasados de propósito), a aprovação (manhã seguinte) e o histórico, e
**refaz o selo** (hash e código) de cada diário aprovado com a mesma conta da função `aprovar_rdo`: a verificação do lacre continua passando (conferida: 150 de 150).
Para isso desliga, dentro de uma única transação, as travas `rdos_guarda` e `rdo_historico_guarda` e as religa no fim. O SQL está em `tools/massa-demo.mjs`
(`SQL_RETROAGIR`). Como contorna a trava de diário lacrado, **só rode no projeto depois de ler e aprovar o SQL**.

## Como tirar a massa (só com aprovação, mostrando o SQL antes)

```sql
-- 1) ver o que seria apagado (só leitura)
select id, nome from public.empresas where plano ->> 'demo' = 'true' order by nome;
-- 2) depois do OK: apagar as empresas de demonstração (o resto cai em cascata, inclusive diários lacrados e a empresa suspensa; testado no banco local)
delete from public.empresas where plano ->> 'demo' = 'true';
```

Os logins (`demo.…@example.com`) ficam e são reaproveitados numa nova carga. As fotos no Storage (bucket `diarios`, pastas das empresas apagadas) não caem sozinhas:
listar com `select name from storage.objects where bucket_id = 'diarios' and name like '<empresa>/%'` e apagar **pela API do Storage**, como a limpeza dos testes faz.
Para tirar também os logins: Admin API do Auth, `DELETE /auth/v1/admin/users/{id}` para cada `demo.%@example.com`.

## Capturas do portal sobre a massa

`tools/capturas-massa.mjs` tira as telas da conta de verdade com a massa (banco **local**, nunca o Supabase do projeto) e alimenta a página
"A live account with sample data" do portal (`portal/fonte/{en,pt}/sample-data.md`). Ordem: `tools/supabase-local.sh`, `python3 -m http.server 8123 &`,
`massa-demo.mjs` (todas as fases), `massa-measure.mjs`, depois `node --experimental-strip-types tools/capturas-massa.mjs` e `--idioma=pt`, e `python3 tools/gerar_portal.py`.
