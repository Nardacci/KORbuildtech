# Lançamento da 1ª versão: Measure Takeoff + Settings

**Decisão (outubro de 2026):** o domínio **korbuildtech.com** recebe só a 1ª versão (o **Measure Takeoff** e o **Settings**, para computador). O app inteiro (Daily, Crew, concorrências, cronograma) continua no **GitHub Pages** (`https://nardacci.github.io/KORbuildtech/`) para homologar com calma. A 1ª versão vai para uma empresa que testa e homologa; assim o time dos EUA não fica esperando o resto.

É o **mesmo código** nos dois lugares. O que muda é só o que aparece:

| | Domínio (produção) | GitHub Pages (homologação) |
|---|---|---|
| Módulos | Measure Takeoff e Settings | Todos |
| Protótipo (`?demo`) e roteiros de celular | Não existem | Existem |
| Guia (`portal/`) | Só Measure Takeoff e Settings (`portal-measure/`) | Guia inteiro |
| Quem decide | `js/versao.js`: o domínio `korbuildtech.com` liga a 1ª versão sozinho | Sem a marca, é o app inteiro |

Para **ver a 1ª versão na homologação**, abra `https://nardacci.github.io/KORbuildtech/?versao=primeira` (fica guardado no navegador). `?versao=completa` volta ao app inteiro. No domínio de produção esses dois pedidos não destravam nada.

## O que muda na 1ª versão

- **Nomes:** Measure → **Measure Takeoff**; **Settings** continua Settings.
- **Fica:** Measure Takeoff (projetos, plantas, escala, medição, assemblies, itens, preços, listas de cotação, propostas) e Settings (Empresa, Contatos, Usuários, Perfis de acesso, Meu perfil).
- **Concorrências (mandar e receber convites):** **ficam**, dentro do Measure Takeoff (menu *Concorrências* e *Convites*), de qualquer empresa para qualquer empresa. Fechar uma concorrência exige a **obra** do projeto ganho: por isso **Obras** também fica (sem diário, ponto nem cronograma: só nome, partes, local e datas). O canal da obra depois do fechamento fica na página de obra do Daily e **não** entra.
- **Convites para cotar (recebidos):** **ficam** no Measure Takeoff (aba *Convites*, a faixa no projeto, "Vou cotar" e "Enviar pela plataforma"), junto com os avisos do sininho. 
- **Oculto:** Daily, Crew, cronograma, modelos de etapas, Funcionários, Encargos, Regras, o canal da obra, aviso de GPS, aviso de instalar no celular, protótipo, roteiros de teste, sininho de outros módulos.
- **O Measure Takeoff vale para qualquer empresa** (na versão completa ele é só de prestadoras e de quem é ambos).
- O que fica oculto **continua existindo no banco e nas regras de acesso**: nada foi apagado.

## Passo a passo para publicar (no seu computador, com a sessão local)

1. `git pull origin main`
2. Guia: `portal-measure/` já vem no repositório. Se o texto do guia mudar: `python3 tools/gerar_portal.py --edicao=measure`
3. Montar a pasta: `node tools/gerar-producao.mjs` → cria `producao/` (mesmo banco de hoje; as variáveis `KOR_SUPABASE_URL` e `KOR_SUPABASE_ANON_KEY` só se usariam com um projeto Supabase novo, e a chave é a pública `anon`/`publishable`, **nunca** a `service_role`)
4. Conferir: `node tests/producao.test.mjs` (14 verificações: sem protótipo, sem roteiros, guia só do Measure Takeoff, service worker coerente).
5. Enviar **o conteúdo** de `producao/` para a pasta do domínio na hospedagem (Hostinger: `public_html`, por FTP ou pelo Gerenciador de Arquivos). O `.htaccess` já força https e não lista pastas.
6. Abrir `https://korbuildtech.com/` em janela anônima, entrar e conferir: só Measure Takeoff e Settings.

## Banco de dados: nada muda por enquanto

**Decisão (outubro de 2026):** a 1ª versão será distribuída a **uma empresa que vai testar e homologar** o sistema. Por isso **não se muda nada no banco**: nenhuma migração, nenhum dado apagado ou criado por nós, e o mesmo projeto Supabase de hoje serve o domínio e a homologação. A pasta `producao/` sai **sem** as variáveis `KOR_SUPABASE_URL` e `KOR_SUPABASE_ANON_KEY`, ou seja, com o `js/config.js` de hoje.

Consequências para se ter em mente:

- Os dados da empresa de teste ficam no mesmo banco da homologação (o app inteiro no GitHub Pages enxerga a mesma conta). Para esta fase é aceitável; antes de clientes de verdade, vale um projeto Supabase só de produção (o `gerar-producao.mjs` já sabe trocar a URL e a chave).
- **Um ponto fora do código, que depende de você:** os e-mails do Supabase (confirmar o cadastro, convite de usuário, recuperar senha) voltam para o endereço do **Site URL** do Auth, que hoje é o da homologação (GitHub Pages, app inteiro). Para o link do e-mail abrir o **domínio** (1ª versão), o Supabase precisa de `https://korbuildtech.com/` em *Authentication › URL Configuration* (Site URL e Redirect URLs) e no segredo `SITE_URL` das funções. É uma configuração do painel, **não** muda tabelas, regras nem dados, mas só se faz com a sua aprovação.
- **Sem essa configuração**, nada quebra: a empresa entra normalmente pelo domínio. Só os links dos e-mails abririam a homologação. Para a fase de teste há um caminho sem tocar no Supabase: a empresa usa sempre `https://korbuildtech.com/`, e quem clicar num link de e-mail e cair na homologação copia o endereço e abre pelo domínio (a sessão não se perde: o login é o mesmo banco).

## DNS e domínio

- O domínio aponta para a hospedagem (registro A/CNAME que a Hostinger indicar). Se o domínio estiver na Hostinger, é só escolher a pasta do site.
- HTTPS (certificado gratuito da hospedagem) ligado **antes** de mandar o link à empresa de teste: o service worker e o login exigem https.

## Antes de mandar o link à empresa de teste

- [ ] `https://korbuildtech.com/` abre, entra com uma conta de verdade e mostra só Measure Takeoff e Settings.
- [ ] Criar uma empresa nova (qualquer tipo) e abrir o Measure Takeoff: envia o PDF, define a escala, mede, emite uma proposta.
- [ ] Convidar um usuário: o e-mail chega, o link abre `korbuildtech.com` e a pessoa entra.
- [ ] Recuperar senha: o e-mail chega e o link volta para o domínio.
- [ ] `https://korbuildtech.com/portal/` mostra o guia só do Measure Takeoff e do Settings (EN e PT).
- [ ] Os testes de segurança seguem passando contra o projeto atual (`tests/seguranca.test.mjs --real`).
- [ ] Preço e pagamento: continuam por último (decisão anterior).

## O que continua na homologação

Daily, Crew, concorrências, cronograma, o protótipo e os roteiros de celular (iPhone e Android) seguem no GitHub Pages com os testes do WebKit e dos aparelhos. Quando cada módulo estiver pronto, ele entra em `js/versao.js` (lista `MODULOS_DA_VERSAO`) e o guia da edição ganha as páginas dele.
