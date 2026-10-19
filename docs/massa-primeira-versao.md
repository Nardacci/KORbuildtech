# Massa de testes da 1ª versão (Measure Takeoff, Concorrências e Settings)

Dados fictícios para testar **em volume** a 1ª versão: dez empresas, cinquenta logins, obras, contatos, convites para cotar em todos os pares de empresas e o Measure montado.
Os usuários e os dados **ficam** para a rodada de testes manuais; no fim, a base é limpa (seção "Limpeza").

**Não muda o banco.** O script só grava dados com as funções que o app já usa; nenhuma migração, nenhuma configuração do painel.

## O que é criado

| Chave | Empresa | Tipo |
|---|---|---|
| c1, c2 | Northgate Builders · Stonebridge Construction | construtora |
| a1, a2 | Harbor & Pine Group · Granite Peak Contracting | ambas (constroem e prestam serviço) |
| p1…p6 | Maple Siding · Cobalt Framing · Bedrock Foundations · Lantern Roofing · Cedar Electric · Willow Drywall | prestadora |

Cada empresa tem **cinco logins**: `pv.<chave>.<papel>@example.com` (por exemplo `pv.p1.admin@example.com`). A senha é a mesma para todos, a de `KOR_DEMO_SENHA` (ela fica só na máquina de quem roda; não vai para o git nem para conversas).

| Papel | Perfil de acesso | Deve conseguir |
|---|---|---|
| `admin` | Administrador | tudo, inclusive o Settings › Acesso e a conta |
| `gestor` | Gestor de obras | Measure (medir), enviar e acompanhar concorrências, obras; **não** mexe no catálogo nem no acesso |
| `orcamentista` | Estimator (só da massa) | Measure com catálogo e responder convites; **não** envia concorrência |
| `contatos` | Contacts only (só da massa) | só a lista de contatos no Settings |
| `trabalhador` | Trabalhador | nada na 1ª versão (só o próprio perfil) |

As empresas têm 1 ou 2 obras cada, com contratante (a construtora, o cliente ou o dono da obra), e as obras das prestadoras já estão ligadas às da contratante.
Há também dois **convidados sem conta** (Birchwood Insulation, Redline Excavation): só recebem o link do convite.

## Convites para cotar (Concorrências)

| Par | Serviço | Estado |
|---|---|---|
| construtora → prestadora | Exterior windows and doors (Northgate) | aberta, 2 propostas, 1 pergunta respondida, 1 convidada só com link |
| construtora → prestadora | Interior drywall and finishing (Stonebridge) | fechada, vencedora Willow Drywall |
| construtora → construtora | Structural steel package (Northgate → Stonebridge e Granite Peak) | aberta, 1 proposta |
| construtora → ambas | Site concrete and curbs (Stonebridge) | aberta, 1 recusa e 1 proposta |
| prestadora → prestadora | Metal stud framing (Cobalt → Cedar e Willow + link) | aberta, 1 proposta |
| prestadora → prestadora | Soffit and fascia (Maple → Lantern) | fechada, vencedora Lantern |
| prestadora → ambas | Temporary protection and scaffolding (Lantern → Granite Peak) | aberta, sem resposta |
| ambas → prestadora | Gutters and downspouts (Harbor & Pine) | aberta, 1 recusa, prazo prorrogado |
| ambas → prestadora | Storefront glazing (Granite Peak) | aberta, 3 propostas para comparar |
| ambas → construtora | MEP package (Granite Peak → Northgate e Cedar) | aberta, 1 proposta |
| construtora → prestadora | Final cleaning (Northgate) | rascunho |
| construtora → prestadora | Landscaping (Stonebridge) | cancelada |

## Measure

`node tools/massa-measure.mjs --conjunto=pv` monta, **pelas telas** (como uma pessoa faria): catálogo com preços, assembly, margens, projeto com a planta de exemplo, escala conferida, medição e proposta emitida.
Feito para p1, p2, p3, p4, a1, a2 e c1 (`a2` e `c1` com o login `orcamentista`; c1 só depois da migração 0015).

## Como rodar

```
# 1) o app aponta para o Supabase do projeto (js/config.js); as variáveis ficam só no terminal
$env:SUPABASE_ACCESS_TOKEN = '…'      # token pessoal
$env:KOR_DEMO_SENHA = '…'             # 12+ caracteres, a que você inventou
node tools/massa-primeira-versao.mjs --real
node tools/massa-measure.mjs --conjunto=pv --real
```

Pode rodar de novo: o que já existe é pulado. Para testar antes num banco local: `bash tools/supabase-local.sh && node tests/massa-primeira-versao.test.mjs` (36 verificações de papel, par e isolamento).

## Roteiro de simulação (manual)

1. **Quem pediu**: entre como `pv.c1.admin` → Measure Takeoff › Concorrências. Abra "Exterior windows and doors": compare as 2 propostas, leia a pergunta respondida, **feche** com uma vencedora. Abra "Final cleaning" (rascunho), confira e **envie**.
2. **Quem recebeu**: entre como `pv.p1.admin` → Measure Takeoff › Convites. Veja o convite, **vou cotar** e envie uma proposta; entre como `pv.p3.admin` e confira que "Exterior windows and doors" **não** aparece (não foi convidada).
3. **Par construtora→construtora**: entre como `pv.c2.admin`, responda "Structural steel package" com proposta ou recusa.
4. **Par prestadora→prestadora**: entre como `pv.p5.admin`, responda "Metal stud framing". Entre como `pv.p2.admin` e prorrogue o prazo.
5. **Vencedora cria a obra**: entre como `pv.p6.admin` (ganhou "Interior drywall") e use "Abrir a obra".
6. **Papéis**: `pv.p1.orcamentista` cria item e assembly mas não vê "enviar concorrência"; `pv.p1.gestor` envia concorrência mas não cria item; `pv.p1.contatos` só vê Contatos; `pv.p1.trabalhador` não vê nada de Measure.
7. **Measure**: entre como `pv.p1.admin`, abra "Canal Street Lofts — Siding bid" (medido, com proposta) e "Larkin Barn — Residing" (só a planta): meça, aplique o assembly, emita a proposta, baixe o PDF.
8. **Link sem conta**: no envio de uma concorrência com "Redline Excavation" como convidada, copie o link e abra numa janela anônima.
9. **Celular**: repita 2 e 7 no iPhone e no Android (roteiros em `docs/iphone.md`).

## A construtora no Measure

Até a migração `20261024_0015_measure_construtora.sql`, o banco só liberava o Measure para prestadora e "ambas" (`tenho_measure()`); a construtora via a tela mas não gravava. A 0015 troca só essa função: vale para qualquer empresa com a permissão `measure.medir`, e as políticas continuam presas à própria empresa. **Precisa ser aplicada no Supabase antes de rodar a massa do Measure da c1** (a migração é aplicada à parte, depois da revisão; para voltar atrás, recrie a função com a condição de 0008).

## Limpeza (no fim da rodada de testes)

Nada é apagado sem aprovação. O comando abaixo só **mostra** o que seria apagado e o SQL:

```
node tools/massa-primeira-versao.mjs --limpar --real
```

Para apagar, a pessoa responsável digita, no próprio terminal, a aprovação e roda de novo com `--apagar`:

```
$env:KOR_APROVACAO = 'pode apagar a massa pv'
node tools/massa-primeira-versao.mjs --limpar --apagar --real
```

Apaga só as empresas com `plano.massa = 'pv'` (em cascata: obras, contatos, concorrências, projetos), os arquivos delas no Storage (plantas, concorrências) e os usuários `pv.*@example.com`. **Não** toca na massa de demonstração do protótipo (`demo.*`) nem em contas reais.
