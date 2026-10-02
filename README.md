# KORbuild — protótipo

Plataforma SaaS de gestão de obra, com três módulos que compartilham os mesmos dados (empresa, obras, pessoas):

| Módulo | O que faz | Situação |
| --- | --- | --- |
| **KORbuild Daily** | Diário de obra (RDO): o que aconteceu na obra, documentado, aprovado e em PDF | Em construção (este protótipo) |
| **KORbuild Crew** | Ponto da equipe: funcionário → horas → obra → custo | Protótipo pronto |
| **KORbuild Measure** | Medição de plantas: planta → medições → quantidades → orçamento | Em breve |

Todos entram pelo mesmo login e caem na página dos módulos. Os papéis (campo e administrador) valem dentro de cada módulo: no Daily, o campo preenche e o escritório acompanha e aprova. A estrutura SaaS (empresa, plano, módulos contratados, usuários e papéis) está descrita em [`docs/saas.md`](docs/saas.md). A proposta do **Global** (configuração e parametrização da plataforma: empresa, pessoas, cadastros, regras por estado, encargos com vigência e permissões) está em [`docs/global.md`](docs/global.md). A documentação completa do Crew (telas, regras de negócio, fluxos, custos, requisitos e glossário) está em [`docs/crew.md`](docs/crew.md); a análise de negócio (funcionalidades, GPS, regras legais nos EUA e no Brasil, concorrência e MVP), em [`docs/crew-analise.md`](docs/crew-analise.md).

**Mercado-alvo: Estados Unidos.** O protótipo está em português só para a conversa interna; termos, unidades, formatos e dados de exemplo americanos entram na localização.

**Protótipo de validação com dados fictícios.** Não há servidor: tudo fica no navegador do aparelho (localStorage para os dados, IndexedDB para as fotos). Campo e escritório são simulados no mesmo navegador, trocando de usuário.

## Idioma

O protótipo é em português para a validação. **A versão final do produto será toda em inglês.** A tradução fica para quando o projeto estiver finalizado; até lá, tudo segue em português. As regras para não amarrar o código ao português estão em `CLAUDE.md`.

## Como abrir

É um site estático, sem build. Qualquer servidor serve:

```bash
python3 -m http.server 8123
# abra http://localhost:8123/
```

Para mostrar no celular, publique no GitHub Pages: **Settings → Pages → Deploy from a branch**, escolha a branch `main` e a pasta `/ (root)`. Precisa ser HTTPS (o GitHub Pages já é) para a câmera, o GPS, o modo offline e o hash SHA-256 funcionarem.

## Roteiro da demonstração (5 minutos)

1. No login, toque no e-mail do **Carlos** (campo) e em **Entrar**. Abra o **Daily** → Residencial Jardim das Flores → **ou copiar de um RDO anterior** (link discreto embaixo de "Adicionar nova RDO") e escolha um dia. A equipe e os equipamentos já vêm preenchidos.
2. O clima é buscado sozinho pela localização da obra. Tire uma ou duas fotos e veja o carimbo com data, hora e GPS e quanto a foto encolheu.
3. Em uma atividade, toque em **Ditar** (ou digite) *"hj a gente fecho a viga 2 mas faltou cimento pq a entrega atrasou"* e toque em **Melhorar texto**.
4. Toque em **Online**, no topo, para simular a falta de internet, e envie. O RDO fica guardado no aparelho. Toque de novo e ele sobe sozinho.
5. No menu do usuário (as iniciais, no canto superior direito), toque em **Sair** e entre como **Ana** (administradora). No Daily, o farol da obra está verde: em **Aprovações**, abra o RDO, aprove (ele fica lacrado), baixe o PDF e copie o link do cliente.
6. Volte aos módulos (ícone de quadradinhos no topo): mostre o **Measure** (em breve, com o botão "Tenho interesse") e, no menu do usuário, a **Conta da empresa** (plano, uso, módulos e usuários).
8. **Crew** como Carlos: em **Ponto**, selecione todos e bata a **entrada** (o GPS diz se está dentro da cerca da obra). Mande o Lucas para outra obra (**Trocar obra** → **Chegou**) e o Marcos para o **intervalo**. Volte ao Daily e comece um RDO: a equipe vem preenchida pelo ponto.
9. **Crew** como Ana: **Agora** (quem está trabalhando em cada obra e a batida fora da obra para conferir), **Timesheets** (semana anterior: aprove a equipe do Roberto, que fez hora extra, e exporte o CSV), o **mapa do dia** do Diego na terça da semana anterior (saiu da obra com o ponto aberto), **Custos** (orçado × realizado × projeção: o Edifício Atlântico aparece com estouro previsto; também por mês e por semana) e **Funcionários** (valor hora com histórico: altere o do Lucas a partir da próxima segunda).
10. O **sininho**, no topo, reúne os alertas do Daily e do Crew.
7. No Galpão Logístico há um RDO com **ajustes pedidos**: entre como Carlos, corrija e reenvie.

Usuários do Daily: `carlos@construtoraexemplo.com.br` (campo) e `ana@construtoraexemplo.com.br` (administradora). Eles aparecem numa linha embaixo do login; tocar no e-mail preenche o campo. A senha não é conferida.

"Recomeçar demonstração", no menu do usuário, apaga tudo e recria os dados de exemplo. As datas de exemplo são sempre relativas a hoje, então o farol mostra verde, amarelo e vermelho em qualquer dia.

## O que o protótipo faz

**Plataforma**
- **Login** já preenchido (mockup; a senha não é conferida). Todos vão para a página dos módulos. Sem login, só abre o link do cliente.
- **Barra superior** em todas as telas: marca KORbuild (volta aos módulos), o módulo atual, a situação da internet (no Daily), o atalho para os módulos e o menu do usuário (conta da empresa, recomeçar demonstração e sair).
- **Módulos:** Daily (contratado), Crew e Measure (em breve, com uma página do que vão fazer, como se ligam ao Daily e o botão "Tenho interesse", que fica registrado na conta).
- **Conta da empresa** (só administrador, pelo menu do usuário): dados da empresa, assinatura em teste grátis, uso (obras ativas do plano), módulos contratados, interesse nos módulos futuros e usuários.

**Navegação do Daily, por papel.** No computador, um menu na coluna da esquerda; no celular, abas embaixo. O editor do RDO esconde as abas para a pessoa se concentrar no preenchimento.

| Papel | Itens | Começa em |
| --- | --- | --- |
| Campo | **Hoje** (obras e o RDO do dia, com o aviso de ajustes) e **Histórico** (todos os RDOs) | Hoje |
| Administrador | **Painel** (números do dia, farol e fila), **Aprovações** (fila, ajustes e aprovados) e **Obras** (cada obra com os RDOs recebidos) | Painel |

Cada papel só abre a própria área: o campo não abre o painel, e o administrador não abre as telas do campo.

**Daily: campo (celular)**
- Lista de obras com a situação do RDO de hoje e o aviso de ajustes pedidos pelo escritório.
- Lista dos RDOs de cada obra com duas fotos em miniatura (320 px, geradas junto com a foto), "+N" quando há mais fotos e o começo da primeira atividade do dia.
- **Adicionar nova RDO** (botão de destaque) começa em branco. Embaixo, discreto, **ou copiar de um RDO anterior**: a pessoa escolhe qualquer RDO da obra (ontem, 28/09…) e o novo traz a equipe (com as faltas zeradas), os equipamentos e as atividades que ainda estavam em andamento.
- **Clima automático** pela coordenada da obra ([Open-Meteo](https://open-meteo.com/), gratuito e sem chave): manhã (7h às 12h) e tarde (13h às 17h). Com mais de 2 mm de chuva no turno, o turno fica "impraticável". Tudo pode ser corrigido à mão, e o relatório diz se o clima foi automático, ajustado ou manual.
- **Equipe e equipamentos** com botões de + e −, chips das funções e equipamentos mais comuns e campo para "outro".
- **Fotos**: câmera ou galeria. Cada foto recebe o carimbo de evidência *dentro da imagem* (obra, data, hora e coordenadas do GPS), é reduzida para 1600 px e cerca de 300 KB no próprio celular, e guarda o hash SHA-256 do arquivo original. Sem GPS, usa o local da obra e deixa isso escrito no carimbo.
- **Ditado** pelo reconhecimento de voz do navegador (Chrome no Android; em outros, o microfone do teclado) e **Melhorar texto**, que reescreve a fala informal em linguagem técnica, mostrando o antes e o depois.
- **Offline-first**: tudo é salvo no aparelho enquanto a pessoa preenche. Sem internet, o envio vai para uma fila e sobe sozinho, foto por foto, quando a conexão volta. O app inteiro abre sem internet depois do primeiro acesso (service worker).

**Notificações:** o **sininho** na barra superior reúne os alertas de todos os módulos, com contador de não lidas e "marcar todas como lidas". O Daily também usa a notificação do sistema no celular. Sem SMS nem e-mail por enquanto.

**Crew: ponto da equipe** (documentação em [`docs/crew.md`](docs/crew.md); análise em [`docs/crew-analise.md`](docs/crew-analise.md))
- **Encarregado (celular):** bate o ponto da equipe inteira num aparelho: entrada, intervalo e volta, troca de obra (com o deslocamento, que conta como hora), chegada e saída. Cada batida guarda a hora, a obra, a etapa (cost code), o GPS com a precisão, se estava dentro da **cerca** da obra (150 m), quem registrou e se teve foto. Fora da cerca, a batida não é bloqueada: fica marcada para conferência. Vê as horas da equipe na semana, com alertas (sem saída, fora da obra, sem intervalo).
- **Escritório:** **Agora** (quem está trabalhando em cada obra, em intervalo ou em deslocamento, e as batidas fora da obra para conferir); **Timesheets** por semana (horas por dia, total, extra acima de 40 h com 1,5×, custo, aprovar ou devolver, ajustar com motivo e exportar CSV para a folha); **Custos** de mão de obra: por obra (orçamento, realizado, projeção ao final pelo avanço físico ou pelo ritmo, sobra ou estouro previsto, gráfico acumulado e detalhe por etapa), por mês e por semana (salários, adicional de hora extra e encargos sobre a folha); **Funcionários** com o valor hora vigente, o custo carregado e o **histórico de valores** (cada mudança vale a partir de uma data, com motivo; não pode começar em semana já aprovada); **mapa do dia** de cada pessoa, em largura total, com mapa de ruas (OpenStreetMap), zoom, arrastar e tela cheia: obras numeradas na ordem da visita com nome e endereço, cerca da obra, trilha simulada (só com o ponto aberto), deslocamentos entre obras e saídas da cerca desenhados pelas ruas (OSRM), batidas com horário e endereço aproximado das batidas fora da obra (Nominatim); embaixo, o **Percurso do dia** (obra → deslocamento → obra, com km e minutos), os **Registros de localização** (da entrada à saída: batidas, troca de obra, abertura do app e um ponto a cada 15 min, nada no intervalo; tocar mostra o ponto no mapa) e a linha do tempo. O mapa marca entrada (E) e saída (S), liga os pontos com setas no sentido do percurso e tem o botão **Reproduzir** (playback do dia). OSRM e Nominatim públicos servem para o protótipo; em produção, usar um provedor pago. Sem internet, o mapa vira um desenho simples.
- **Regras:** batida nunca é editada nem apagada (ajuste é uma batida nova com quem, quando e por quê); sem arredondamento de minutos; hora extra semanal (FLSA, sobre a média ponderada quando o valor muda na semana); deslocamento entre obras é hora paga; cada dia usa o valor hora vigente naquele dia; custo da obra = salário + adicional de hora extra rateado pelas horas + encargos (32,05% no padrão).
- **Ligação com o Daily:** ao começar um RDO, a equipe vem de quem bateu entrada na obra no dia (botão para atualizar).

**Daily: RDO obrigatório** (regras em [`docs/alertas.md`](docs/alertas.md))
- Prazo diário às **18h**, lembrete às **16h**, alerta de atraso às 18h e aviso ao escritório às **8h do dia seguinte**, tudo pelo **sininho** e pela notificação do celular (sem SMS).
- Tela Hoje com faixa de RDOs atrasados e do que falta hoje ("faltam 1h30"); contador de pendências na aba e no ícone do app.
- RDO atrasado pode ser preenchido (até 3 dias de trabalho para trás) e fica marcado como "enviado com atraso" no relatório e no PDF.
- "Sem atividade hoje / neste dia" com motivo (chuva, feriado, obra parada…): registra o dia e para os alertas.
- "Testar no celular" mostra a régua e dispara uma notificação de verdade.

**Daily: administrador (computador)**
- **Farol das obras:** verde (RDO de hoje recebido), amarelo (1 dia de atraso) e vermelho (2 dias ou mais). Também mostra os números do dia.
- **Fila de aprovação:** aprovar ou pedir ajustes (com o motivo, que aparece no celular do canteiro).
- **Lacre na aprovação:** o conteúdo do RDO, incluindo o hash de cada foto, recebe um hash SHA-256. Os 12 primeiros caracteres viram o código de verificação. Depois de aprovado, ninguém edita.
- **Histórico** de cada RDO: quem começou, enviou, quando chegou, quem pediu ajustes e quem aprovou.
- **PDF A4** com o logo da construtora, os dados da obra, o clima, as tabelas, as fotos com legenda, data e GPS, o lacre e as assinaturas.
- **Link do cliente** (somente leitura, sem conta) que confere o lacre: se o conteúdo mudar depois da aprovação, o link avisa.

## O que é simulado

| No protótipo | Na versão real |
| --- | --- |
| Dados no navegador; campo e escritório no mesmo aparelho | Servidor com banco de dados e armazenamento de fotos (ex.: Supabase), separado por construtora |
| "Enviar" troca o estado e mostra o progresso | Upload de verdade, com nova tentativa automática |
| "Melhorar texto" com regras no aparelho | Modelo de IA no servidor, guardando o texto original |
| PDF pela impressão do navegador ("Salvar como PDF") | PDF gerado no servidor |
| Link do cliente só abre no mesmo navegador | Link público com validade |
| Login sem senha, uma empresa só | Autenticação de verdade e várias empresas isoladas no servidor (veja `docs/saas.md`) |
| Assinatura e convite de usuários só na tela | Cobrança recorrente, convite por e-mail e gestão de usuários |
| Botão "Online / Sem internet" para simular a queda | Detecção da rede do aparelho (ela também já funciona no protótipo) |

## Estrutura

| Arquivo | O que faz |
| --- | --- |
| `index.html` | Página única; as telas são rotas `#/…` |
| `css/app.css` | Identidade visual do KORbuild (grafite e laranja, fonte Inter, uma cor por módulo), layout com menu lateral e abas, e impressão do PDF |
| `js/app.js` | Navegação (com login e permissões), telas do Daily, ações e fila de envio |
| `js/plataforma.js` | Plataforma SaaS: sessão, papéis, módulos, a casca das telas (barra superior, menu do usuário, menu lateral e abas) e as telas de login, módulos, "em breve" e conta |
| `js/icones.js` | Ícones, o símbolo K e o logotipo KORbuild com a assinatura "Build better teams. Run better operations." |
| `js/armazem.js` | Dados no localStorage e fotos no IndexedDB |
| `js/fotos.js` | GPS, carimbo, compressão e fotos de exemplo desenhadas |
| `js/clima.js` | Clima automático (Open-Meteo) |
| `js/ia.js` | "Melhorar texto" (simulado) e ditado |
| `js/lacre.js` | Hash do RDO aprovado e conferência do lacre |
| `js/relatorio.js` | O relatório usado na tela, no PDF e no link do cliente |
| `js/exemplo.js` | Empresa, plano, usuários, obras e RDOs fictícios |
| `js/crew.js` | Crew: modelo do ponto (batidas, jornada, semana, hora extra), valor hora com vigência, encargos, orçamentos, motor de custo e projeção, e os dados de exemplo (duas semanas detalhadas + histórico consolidado desde o início das obras) |
| `js/crew-telas.js` | Crew: telas do encarregado e do escritório, mapa do dia e notificações |
| `js/prazos.js` | Daily: prazo do RDO e régua de alertas |
| `vendor/leaflet/` | Leaflet 1.9.4 (biblioteca de mapas, licença BSD-2), guardada no projeto para funcionar sem CDN |
| `sw.js` | Service worker: o app abre sem internet |

Rotas: `#/entrar`, `#/inicio` (módulos), `#/conta`, `#/measure`; no Crew, `#/crew` (abre a área do papel), encarregado em `#/crew/equipe` e `#/crew/horas`, escritório em `#/crew/agora`, `#/crew/timesheets/SEMANA`, `#/crew/semana/FUNCIONÁRIO/SEMANA`, `#/crew/custos` (obras), `#/crew/custos/mes/AAAA-MM`, `#/crew/custos/semana/SEMANA`, `#/crew/funcionarios` e `#/crew/funcionario/ID`, e o dia em `#/crew/dia/FUNCIONÁRIO/DATA`; no Daily, `#/daily` (abre a área do papel), campo em `#/daily/campo`, `#/daily/campo/obra/ID`, `#/daily/campo/rdo/ID` e `#/daily/historico`, administrador em `#/daily/painel`, `#/daily/aprovacoes`, `#/daily/obras`, `#/daily/obras/ID` e `#/daily/painel/rdo/ID`, e o PDF em `#/daily/pdf/ID`; e o link público `#/cliente/CÓDIGO`.

## Testes

`tests/demo.test.mjs` percorre o roteiro inteiro num Chromium com tela de celular (87 verificações, com horário fixo para os alertas): login, módulos, menu do usuário, navegação e permissões por papel, interesse nos módulos futuros, conta da empresa, copiar o dia anterior, clima, equipe, texto melhorado, foto com GPS e compressão, envio sem internet e a subida automática, farol, aprovação e código, link do cliente, detecção de adulteração, PDF, ajustes, persistência e abertura sem internet. A API de clima é simulada no teste.

`tests/crew.test.mjs` cobre o Crew (74 verificações, quarta-feira às 16h30): ponto da equipe com GPS e cerca, troca de obra e chegada, intervalo, horas, permissões, equipe do RDO vinda do ponto, "Agora", batida para conferir, sininho, aprovação, CSV, ajuste de saída esquecida, custos por obra/mês/semana com projeção, orçamento e encargos, valor hora com histórico (inclusive a trava de semana aprovada), mapa do dia, percurso com endereços, registros de localização e reprodução.

```bash
npm install playwright   # uma vez
python3 -m http.server 8123 &
node tests/demo.test.mjs http://localhost:8123/
node tests/crew.test.mjs http://localhost:8123/
```
