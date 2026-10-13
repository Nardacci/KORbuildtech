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

Movimento: **5 semanas de ponto** (entrada, intervalo, saída, com GPS; faltas, batidas fora da cerca, semanas aprovadas, uma devolvida e
várias ainda por aprovar) e **3 semanas de diários** em todos os estados (aprovado, aguardando aprovação, ajustes pedidos, rascunho de hoje,
dia sem atividade por chuva). Situações de plano para a administração: ativa, teste terminando em 6 dias, teste vencido há 4 dias e
uma empresa **suspensa** (Keystone Masonry; a obra "Foundations" da Granite State está concluída).

Fica para a fase 2: fotos nos diários, cronograma das obras, projetos do Measure, concorrências entre as empresas.

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
$env:KOR_DEMO_SENHA = '<senha longa, só nesta janela>'          # nunca no chat nem em arquivo
$env:SUPABASE_ACCESS_TOKEN = '<token pessoal>'                   # já usado nos testes
node tools/massa-demo.mjs --real                                 # tudo
node tools/massa-demo.mjs --real --fase=estrutura                # ou por fase: estrutura, ponto, diarios, planos
```

Local (testa o script sem tocar no projeto): `tools/supabase-local.sh` e `node tools/massa-demo.mjs` (leva uns 20 s).
Capturas do portal em cima desses dados: `docs/massa-demo.md` será atualizado quando o roteiro de telas existir.

## Como tirar a massa (só com aprovação, mostrando o SQL antes)

```sql
-- 1) ver o que seria apagado (só leitura)
select id, nome from public.empresas where plano ->> 'demo' = 'true' order by nome;
-- 2) depois do OK: apagar as empresas (o resto cai em cascata) e, em seguida, os usuários example.com "demo.%" pela API de administração do Auth
-- delete from public.empresas where plano ->> 'demo' = 'true';
```
