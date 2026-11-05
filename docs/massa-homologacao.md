# Massa de homologação (antes de liberar)

Dados fictícios, em volume, para **testar à mão** (nós e o parceiro) e para a **homologação automática** antes de liberar o Takeoff. Complementa a massa pv (`docs/massa-primeira-versao.md`: 10 empresas, 50 logins, concorrências). Esta cobre o que veio depois: catálogo com funções e valor hora, projetos em todos os estados, plantas com escala, **muitos desenhos**, projeto liberado para obra, diários com horas por tarefa, % feito no Gantt, tarefa atrasada e valor por tarefa.

**Não muda o banco** (nenhuma migração): só grava dados, com as mesmas funções que o app usa (`criar_empresa`, `salvar_rdo`, `enviar_rdo`, `aprovar_rdo`, `pedir_ajustes`). **Nenhum e-mail sai**: logins `example.com` e avisos por e-mail desligados antes de qualquer evento. Marca nas empresas: `plano.massa = 'hom'`.

## O que é criado
| Empresa | Logins (`hom.<chave>.<papel>@example.com`) |
|---|---|
| **Homologação Prestadora** (`hp`) | `admin` (Hélio, Administrador) · `gestor` (Gina, Gestor de obras) · `encarregado` (Enzo, Encarregado) · `trabalhador` (Tati, Trabalhador) |
| **Homologação Parceira** (`hq`) | `admin` (Paulo, Administrador): só para conferir o isolamento entre empresas |

Senha de todos: a de `KOR_DEMO_SENHA` (12+ caracteres; fica só na máquina de quem roda e é combinada com o parceiro por fora, nunca no GitHub).

Na Prestadora: 4 funções com valor hora (Carpenter 38, Painter 30, Electrician 45, Laborer 24) e encargos de 22%; 10 itens (material, mão de obra ligada à função, equipamento e subempreiteiro); 4 assemblies; margens (overhead 12%, lucro 10%); 6 contatos.

| Projeto | Estado | Serve para testar |
|---|---|---|
| HOM · Casa modelo (orçamento vazio) | orçamento, sem planta | o começo do fluxo; "Liberar" desabilitado |
| HOM · Garagem Pereira (pronta para liberar) | planta de 3 folhas com escala, 16 condições / 128 medições, cronograma com quem faz cada tarefa | "Liberar para obra" habilitado; escolher o início da obra |
| HOM · Reforma Mitchell (em obra) | liberado há 14 dias; 20 condições / 200 medições; 9 diários: **7 aprovados, 1 com ajustes pedidos, 1 enviado** | aprovar o enviado, responder ao ajuste; % feito no Gantt (veio da aprovação); horas apontadas × orçadas; valor por tarefa e curva S |
| HOM · Torre Granite (volume) | liberado há 30 dias; 56 condições / 1.400 medições (padrão `--volume=40x25`); a 1ª tarefa está **atrasada** | desenho e lista de materiais com muitos desenhos; Gantt com tarefa em vermelho; Início com atraso |
| HOM · Loja Birch (perdida) | perdida | não aparece no Gantt nem no andamento do Início |
| HOM · Projeto da Parceira (empresa `hq`) | orçamento | só a Parceira deve ver |

## Logins na tela de login (temporário)
Na homologação (`nardacci.github.io`) o login oficial mostra os cinco e-mails acima, clicáveis (preenchem o campo; **a senha não aparece**). Nunca aparece no domínio de produção. **Remover depois dos testes:** em `js/plataforma.js`, `MOSTRAR_LOGINS_DE_TESTE = false` (some na hora) e, para limpar de vez, apagar `LOGINS_DE_TESTE` e `htmlLoginsDeTeste`, a ação `preencher-email-oficial` em `js/app.js`, o bloco `.logins-teste` do `css/app.css` e `tests/login-logins-teste.test.mjs`.

## Como rodar
```
# 1) a massa (o app aponta para o Supabase do js/config.js; as variáveis ficam só no terminal)
$env:SUPABASE_ACCESS_TOKEN = 'sbp_…'
$env:KOR_DEMO_SENHA = '…'                       # 12+ caracteres
node tools/massa-homologacao.mjs --real          # volume padrão 40x25; --volume=80x40 para mais
# 2) a homologação automática (entra pela tela como cada papel; só lê)
node tests/homologacao-hom.test.mjs --real --relatorio
Remove-Item Env:SUPABASE_ACCESS_TOKEN
```
Pode rodar de novo: o que já existe é pulado. No banco local: `bash tools/supabase-local.sh` e os mesmos comandos sem `--real`.

**Limpeza** (só mostra; para apagar de verdade): `node tools/massa-homologacao.mjs --limpar --apagar --confirmo=apagar-massa-hom`. Apaga as empresas `hom`, os dados delas em cascata e os logins `hom.*@example.com`.

## O que a homologação automática confere (`tests/homologacao-hom.test.mjs`, 29 verificações)
- Os cinco projetos existem; o Início mostra o andamento (Mitchell e Torre), aponta o atraso e não mostra o perdido.
- A lista de projetos tem os cinco e não mostra o da Parceira; o vazio não libera e o pronto libera.
- Gantt do Mitchell: % de cada tarefa **igual ao do banco** (veio da aprovação dos diários no servidor); horas apontadas = soma dos diários aprovados; valor total e curva S; tabela de horas; sem custo real (sem Crew).
- Torre: tarefa atrasada em vermelho, valor por tarefa, desenho com 1.400 medições abre em tempo razoável, lista de materiais.
- Daily: 1 diário aguardando aprovação.
- Papéis: a gestora não vê Usuários; o encarregado vê "Seus projetos" e não cria obra; a trabalhadora não abre o Takeoff; a outra empresa só vê o dela (tela e banco, sem nenhum diário da Prestadora).
- Nenhum erro de JavaScript.

## Roteiro do parceiro (teste à mão)
Entre em `https://nardacci.github.io/KORbuildtech/` com `hom.hp.admin@example.com`.
1. **Início:** conferir o andamento dos projetos e o atraso da Torre.
2. **Garagem Pereira:** abrir, olhar as medições e **liberar para obra** com um início de obra à escolha.
3. **Reforma Mitchell:** abrir o Gantt (valor por tarefa, curva S, horas orçadas × apontadas); entrar como `encarregado` (celular), abrir o diário com ajustes pedidos, corrigir e reenviar; como `admin`, aprovar o diário enviado e ver o % feito subir no Gantt.
4. **Torre Granite:** abrir o desenho com muitas condições, a lista de materiais e a proposta; medir mais algumas coisas e ver o tempo.
5. **Casa modelo (vazio):** montar do zero: enviar um PDF, escala, medir, assembly, cronograma.
6. **Papéis:** entrar como `gestor` e `trabalhador` e ver o que cada um enxerga; como `hom.hq.admin`, conferir que não aparece nada da outra empresa.

Anotar tela, login, hora e o que estranhou, como na lista de checagem (`docs/testes/lista-checagem-primeira-versao.md`).

## Limites
- Os diários não têm fotos (a massa não gera imagens). Fotos e o fluxo do celular com GPS ficam para o teste à mão.
- Não há ponto do Crew: o bloco de custo real do Gantt não aparece.
- As concorrências continuam na massa pv; esta massa não as cria.
- Datas relativas a quando a massa foi criada (o "há 14 dias" envelhece): para refazer, limpar e rodar de novo.
