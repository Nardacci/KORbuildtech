# KORbuild — roteiro de testes

> Para rodar no seu computador (Windows, PowerShell), sozinho ou pela sessão local do Claude Code.
> Duas partes: **automática** (um comando, gera um resumo) e **manual** (no navegador, no endereço de homologação).
> Nada aqui muda a estrutura do banco: os testes SQL terminam em ROLLBACK e o teste da conta apaga o que cria.
> Migrações **não** fazem parte do roteiro: são executadas à parte, depois de revisadas (CLAUDE.md).

## 1. Preparar (uma vez)

Na pasta do projeto, no PowerShell:

```powershell
git pull origin main
npm install --no-save playwright@1.56.1
npx playwright install chromium
```

Para os testes do banco, o token pessoal do Supabase fica **só** na variável de ambiente da sessão (nunca no chat nem em arquivo):

```powershell
$env:SUPABASE_ACCESS_TOKEN = "<cole aqui só no PowerShell>"
```

## 2. Parte automática

```powershell
.\tools\testar.ps1                    # tudo (protótipo, telas oficiais e banco)
.\tools\testar.ps1 -Parte prototipo   # só no navegador, sem banco (sem token)
.\tools\testar.ps1 -Parte banco       # só o que fala com o Supabase
.\tools\testar.ps1 -Somente crew,obras
```

O script sobe o servidor local na porta 8123 (se ainda não estiver no ar), roda os testes, encerra o servidor e grava
`.testes\<data-hora>\resumo.md` (a tabela e as falhas) e a saída completa de cada teste. Termina com código 0 se tudo
passou e 1 se algo falhou. A pasta `.testes\` não vai para o git.

| Teste | Onde | O que confere | Tempo |
|---|---|---|---|
| `imperial`, `formulas` | Node | Pés-polegadas, frações, escalas e o motor de fórmulas do Measure | segundos |
| `entrada` | navegador | Tela de entrada: login oficial, portal e protótipo (`?demo`) | ~5 s |
| `demo` | navegador | O protótipo inteiro com os dados de demonstração | ~1 min |
| `saas`, `obras`, `cronograma` | navegador | Empresas, obras e prestadoras; cadastro de obras; cronograma | ~1 min cada |
| `crew` | navegador | Ponto, timesheets, custos | ~10 s |
| `measure` | navegador | Plantas, escala, medições, assemblies, proposta | ~2 min |
| `concorrencias` | navegador | Concorrências, convites, propostas, quarteirização | ~2 min |
| `portal` | navegador | Portal de especificações e manual (PT e EN) | ~1 min |
| `ingles` | navegador | Nenhuma tela em inglês com palavra em português | ~1,5 min |
| `oficial-simulado` | navegador | As telas oficiais (conta e cadastros) com um Supabase **falso** em memória | ~5 s |
| `sql 0001_acesso`, `sql 0002_settings` | Supabase | Regras de acesso das fatias 1 e 2 (cada empresa só vê o que é dela; dinheiro só para quem pode) | segundos |
| `conta` | navegador + Supabase | O caminho real: entrar, criar empresa, perfis, Meu perfil, cadastros, convite, permissões, auditoria | ~2 min |
| `sql 0003_daily` | Supabase | Regras do Daily: quem preenche, envia e aprova; lacre; fotos; link do cliente; sem internet | segundos |
| `sql 0004_crew` | Supabase | Regras do Crew: batida que não se edita, cerca, semana aprovada fechada, dia sem saída, localização só com o ponto aberto, presença para a construtora sem dinheiro |
| `sql 0005_cronograma` | Supabase | Regras do cronograma: quem monta, % só por avanço, etapa com andamento aprovado não sai e só quem aprovou altera, linha de base, publicação por versão, construtora lê só pela função, o RDO aprovado leva o andamento | segundos |
| `crew-oficial` | navegador + Supabase | O Crew de ponta a ponta: o encarregado bate o ponto da equipe (dentro e fora da cerca), sem internet a batida sobe depois com a hora certa, o trabalhador bate o próprio ponto e a localização é gravada, o escritório confere, ajusta, aprova e devolve a semana, orçamento, mapa do dia e a visão da construtora | ~3 min |
| `sql 0006_measure` | Supabase | Regras do Measure: só prestadora, quem mede e quem mexe no catálogo, dinheiro só para quem pode, preços e margens só com insert, versão da condição, typicals sem sobreposição, proposta numerada e congelada, plantas na pasta da empresa | segundos |
| `cronograma-oficial` | navegador + Supabase | O cronograma de ponta a ponta: modelo, etapas, % à mão, linha de base, publicação; o encarregado aponta a etapa no RDO; a construtora aprova e o andamento entra; a etapa fica travada; a construtora vê a versão publicada só leitura | ~2 min |
| `measure-oficial` | navegador + Supabase | O Measure de ponta a ponta: item e assembly, projeto, PDF no Storage, escala, medição e recorte (versão da condição), preço e margens, proposta emitida e numerada; tudo volta ao recarregar; a gestora não vê dinheiro; excluir o projeto leva as plantas | ~2 min |
| `daily` | navegador + Supabase | O Daily de ponta a ponta: o encarregado preenche com foto, com e sem internet; a prestadora aprova a obra própria; a construtora aprova a obra ligada; pedido de ajustes; conflito entre dois aparelhos; o cliente abre o link | ~3 min |

O teste `daily` cria os usuários `kb-e2e-daily-…@example.com`, duas empresas, obras, diários e fotos, e apaga tudo
no fim (inclusive as fotos do Storage).

O teste `conta` cria os usuários `kb-e2e-ana@example.com` e `kb-e2e-beto@example.com` (já confirmados, nenhum
e-mail sai) e a empresa "Construtora E2E", e apaga tudo no fim. Se a limpeza falhar, **não apague nada à mão**:
mande o erro.

## 3. Parte manual (homologação)

Endereço: **https://nardacci.github.io/KORbuildtech/** — use Ctrl+Shift+R para pegar a versão nova.
Use e-mails seus com `+` (ex.: `seunome+t1@gmail.com`): chegam na sua caixa e contam como contas diferentes.
Marque cada item; se algo estranhar, tire um print.

### Conta (fatia 1)
- [ ] Criar conta com a tela em **PT**: chega "Confirme sua conta no KORbuild", em português, com o visual do KORbuild.
- [ ] Criar outra com a tela em **EN**: chega "Confirm your KORbuild account", em inglês.
- [ ] O link do e-mail volta para o site já logado, na tela "Sua empresa", com o nome preenchido.
- [ ] Criar a empresa: entra na área da conta como Administrador.
- [ ] Usuários → convidar o outro e-mail; abrir o link numa janela anônima; entrar; aceitar o convite.
- [ ] Trocar o perfil do convidado; desativar; ele vê "Seu acesso foi desativado".
- [ ] Esqueci a senha: chega "Crie uma nova senha no KORbuild" no idioma da conta; a senha nova funciona.

### Meu perfil (fatia 2)
- [ ] Mudar nome e telefone: o nome aparece no topo.
- [ ] Trocar PT|EN: a tela muda; o próximo e-mail sai no idioma escolhido.
- [ ] Trocar o e-mail para outro `+`: chega "Confirme o seu novo e-mail"; até abrir o link, a tela mostra "Aguardando a confirmação".
- [ ] Trocar a senha e entrar com a nova.

### Daily (fatia 3)
- [ ] Início → "Abrir o Daily": entra no Daily com as obras da empresa (sem o selo "Protótipo").
- [ ] No celular: novo RDO, clima, equipe, atividade e uma foto; enviar. No computador, o RDO aparece para aprovar.
- [ ] Modo avião no celular: preencher e enviar outro RDO (fica "para enviar"); tirar do modo avião: sobe sozinho.
- [ ] Aprovar: aparece o código; "Copiar o link" e abrir numa janela anônima: "Documento autêntico" e a foto.
- [ ] Pedir ajustes: o celular mostra o pedido e "Reenviar".

### Crew (fatia 4)
- [ ] Início → "Abrir o Crew". Como Encarregado, no celular: aceite o aviso de localização e bata a entrada de duas pessoas.
- [ ] Modo avião: bata o intervalo; o aviso de conexão mostra "1 no aparelho". Tire do modo avião: sobe sozinho, com a hora em que foi batido.
- [ ] Como Trabalhador: "Meu ponto" bate a volta do intervalo e a saída; com o app aberto, a localização é registrada.
- [ ] No computador, como Administrador: "Agora" mostra quem está na obra; a batida fora da cerca pede "Conferido".
- [ ] Timesheets: a semana com dia sem saída não aprova; "Ajustar" cria uma batida nova com o motivo; aprovar e devolver.
- [ ] Custos: cadastre o orçamento de uma obra; o mapa do dia mostra os registros de localização reais.
- [ ] Como Construtora, numa obra ligada: a página da obra mostra quem bateu o ponto, sem valores.

### Cronograma (fatia 5)
- [ ] Obras → uma obra → Cronograma → "Começar com um modelo": as etapas aparecem no Gantt com a primeira linha de base.
- [ ] Nova etapa, editar datas (o desvio aparece), "Atualizar %" à mão, subir/descer, "Salvar nova linha de base" com motivo.
- [ ] Numa obra ligada à construtora: "Publicar para o contratante"; como construtora, a obra dela lista "Cronogramas das prestadoras" e abre a versão só leitura.
- [ ] No celular, como encarregado: a obra mostra "Próximas 3 semanas"; na atividade do RDO, escolha a etapa e o %; envie.
- [ ] Aprovar o RDO: o aviso diz que o cronograma recebeu o andamento; a etapa não pode mais ser excluída e só quem aprovou a edita.

### Measure (fatia 6, no computador)
- [ ] Início → Measure: Itens → novo item com código e unidade; Assemblies → novo assembly com uma linha (fórmula `area / 32`).
- [ ] Novo projeto com contratante; enviar um PDF; abrir a folha, escolher a escala da lista e conferir uma cota.
- [ ] Incluir o assembly no desenho e medir uma área; recortar um vão. Recarregar a página: tudo volta do banco.
- [ ] Preços: novo preço no item; nova versão das margens com motivo. Proposta: emitir; o número vem do banco (P-AAAA-001).
- [ ] Entrar como Gestor (sem "Ver custos"): vê o projeto e as quantidades, não vê preços nem margens.

### Cadastros (fatia 2)
- [ ] Contatos: criar uma construtora e um cliente; tentar repetir o nome (recusa).
- [ ] Obras: criar uma obra marcando o local no **mapa** (o círculo é a cerca); salvar; incluir pessoas em "Quem trabalha nesta obra".
- [ ] Obras → Modelos de etapas: criar um modelo que some 100% (com 90% o botão recusa).
- [ ] Funcionários: cadastrar com valor hora e uma certificação; depois "Alterar valor hora" com data e motivo: o histórico mostra os dois.
- [ ] Regras: salvar a primeira versão dos encargos e da jornada; tentar uma data no passado (recusa).
- [ ] Entrar como o convidado (Gestor de obras): vê Obras, não vê Funcionários nem Usuários.
- [ ] No celular: as abas rolam de lado, nada passa da largura da tela.

## 4. Mandar o resultado

Cole no chat o conteúdo de `.testes\<data-hora>\resumo.md` e a lista da parte manual com o que falhou (e os prints).

### Texto para a sessão local do Claude Code

```
git pull origin main
Leia docs/roteiro-de-testes.md e rode .\tools\testar.ps1 (com $env:SUPABASE_ACCESS_TOKEN já definido nesta sessão).
Mostre o resumo.md inteiro. Para cada falha, mostre as linhas "FALHA" e "encontrado:" e o fim da saída do teste.
Não execute migrações, não apague nada à mão e não use session_replication_role. Se a limpeza do teste da conta falhar, pare e mostre o erro.
No fim, confirme com select count(*) que não sobrou usuário kb-e2e-% nem a empresa "Construtora E2E".
```
