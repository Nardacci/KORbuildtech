# KORbuild — protótipo

Plataforma SaaS de gestão de obra, com três módulos que compartilham os mesmos dados (empresa, obras, pessoas):

| Módulo | O que faz | Situação |
| --- | --- | --- |
| **KORbuild Daily** | Diário de obra (RDO): o que aconteceu na obra, documentado, aprovado e em PDF | Em construção (este protótipo) |
| **KORbuild Crew** | Ponto da equipe: funcionário → horas → obra → custo | Em breve |
| **KORbuild Measure** | Medição de plantas: planta → medições → quantidades → orçamento | Em breve |

A pessoa entra com o login da empresa, vê os módulos e abre o que precisa. A estrutura SaaS (empresa, plano, módulos contratados, usuários e papéis) está descrita em [`docs/saas.md`](docs/saas.md).

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

O mesmo roteiro aparece na tela de login do app.

1. Entre como **Carlos** (campo). Abra o **Daily** → Residencial Jardim das Flores → **Começar copiando o RDO de ontem**. A equipe e os equipamentos já vêm preenchidos.
2. O clima é buscado sozinho pela localização da obra. Tire uma ou duas fotos e veja o carimbo com data, hora e GPS e quanto a foto encolheu.
3. Em uma atividade, toque em **Ditar** (ou digite) *"hj a gente fecho a viga 2 mas faltou cimento pq a entrega atrasou"* e toque em **Melhorar texto**.
4. Toque em **Online**, no topo, para simular a falta de internet, e envie. O RDO fica guardado no aparelho. Toque de novo e ele sobe sozinho.
5. Saia e entre como **Ana** (administradora). No Daily, o farol da obra está verde: abra o RDO, aprove (ele fica lacrado), baixe o PDF e copie o link do cliente.
6. Volte aos módulos: mostre **Crew** e **Measure** (em breve, com o botão "Tenho interesse") e a **Conta da empresa** (plano, uso, módulos e usuários).
7. No Galpão Logístico há um RDO com **ajustes pedidos**: entre como Carlos, corrija e reenvie.

Contas de demonstração: `carlos@construtoraexemplo.com.br` (campo) e `ana@construtoraexemplo.com.br` (administradora). A senha não é conferida.

"Recomeçar a demonstração", na tela de login, apaga tudo e recria os dados de exemplo. As datas de exemplo são sempre relativas a hoje, então o farol mostra verde, amarelo e vermelho em qualquer dia.

## O que o protótipo faz

**Plataforma**
- **Login** com e-mail (a senha não é conferida no protótipo) e duas contas de demonstração. Sem login, só abre o link do cliente.
- **Módulos:** Daily (incluído no plano), Crew e Measure (em breve, com uma página do que vão fazer, como se ligam ao Daily e o botão "Tenho interesse", que fica registrado na conta).
- **Papéis:** administrador (escritório: painel, aprovação e conta da empresa) e campo (canteiro: preencher e enviar). O campo não abre o painel nem a conta.
- **Conta da empresa** (só administrador): dados da empresa, assinatura em teste grátis, uso (obras ativas do plano), módulos contratados, interesse nos módulos futuros e usuários.

**Daily: canteiro (celular)**
- Lista de obras com a situação do RDO de hoje e o aviso de ajustes pedidos pelo escritório.
- Lista dos RDOs de cada obra com duas fotos em miniatura (320 px, geradas junto com a foto), "+N" quando há mais fotos e o começo da primeira atividade do dia.
- **Copiar o RDO anterior:** traz a equipe (com as faltas zeradas), os equipamentos e só as atividades que ainda estavam em andamento.
- **Clima automático** pela coordenada da obra ([Open-Meteo](https://open-meteo.com/), gratuito e sem chave): manhã (7h às 12h) e tarde (13h às 17h). Com mais de 2 mm de chuva no turno, o turno fica "impraticável". Tudo pode ser corrigido à mão, e o relatório diz se o clima foi automático, ajustado ou manual.
- **Equipe e equipamentos** com botões de + e −, chips das funções e equipamentos mais comuns e campo para "outro".
- **Fotos**: câmera ou galeria. Cada foto recebe o carimbo de evidência *dentro da imagem* (obra, data, hora e coordenadas do GPS), é reduzida para 1600 px e cerca de 300 KB no próprio celular, e guarda o hash SHA-256 do arquivo original. Sem GPS, usa o local da obra e deixa isso escrito no carimbo.
- **Ditado** pelo reconhecimento de voz do navegador (Chrome no Android; em outros, o microfone do teclado) e **Melhorar texto**, que reescreve a fala informal em linguagem técnica, mostrando o antes e o depois.
- **Offline-first**: tudo é salvo no aparelho enquanto a pessoa preenche. Sem internet, o envio vai para uma fila e sobe sozinho, foto por foto, quando a conexão volta. O app inteiro abre sem internet depois do primeiro acesso (service worker).

**Daily: escritório (computador)**
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
| `css/app.css` | Visual (mesma identidade do KORbuild Match), cores de cada módulo e layout de impressão do PDF |
| `js/app.js` | Navegação (com login e permissões), telas do Daily, ações e fila de envio |
| `js/plataforma.js` | Plataforma SaaS: sessão, papéis, módulos e as telas de login, módulos, "em breve" e conta |
| `js/armazem.js` | Dados no localStorage e fotos no IndexedDB |
| `js/fotos.js` | GPS, carimbo, compressão e fotos de exemplo desenhadas |
| `js/clima.js` | Clima automático (Open-Meteo) |
| `js/ia.js` | "Melhorar texto" (simulado) e ditado |
| `js/lacre.js` | Hash do RDO aprovado e conferência do lacre |
| `js/relatorio.js` | O relatório usado na tela, no PDF e no link do cliente |
| `js/exemplo.js` | Empresa, plano, usuários, obras e RDOs fictícios |
| `sw.js` | Service worker: o app abre sem internet |

Rotas: `#/entrar`, `#/inicio` (módulos), `#/conta`, `#/crew`, `#/measure`; no Daily, `#/daily` (abre o canteiro ou o painel conforme o papel), `#/daily/campo`, `#/daily/campo/obra/ID`, `#/daily/campo/rdo/ID`, `#/daily/painel`, `#/daily/painel/rdo/ID` e `#/daily/pdf/ID`; e o link público `#/cliente/CÓDIGO`.

## Testes

`tests/demo.test.mjs` percorre o roteiro inteiro num Chromium com tela de celular (57 verificações): login, módulos e permissões por papel, interesse nos módulos futuros, conta da empresa, copiar o dia anterior, clima, equipe, texto melhorado, foto com GPS e compressão, envio sem internet e a subida automática, farol, aprovação e código, link do cliente, detecção de adulteração, PDF, ajustes, persistência e abertura sem internet. A API de clima é simulada no teste.

```bash
npm install playwright   # uma vez
python3 -m http.server 8123 &
node tests/demo.test.mjs http://localhost:8123/
```
