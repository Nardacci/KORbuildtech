# Lançamento da 1ª versão: Measure Takeoff + Settings

**Decisão (outubro de 2026):** o domínio **korbuildtech.com** recebe só a 1ª versão (o **Measure Takeoff** e o **Settings**, para computador). O app inteiro (Daily, Crew, concorrências, cronograma) continua no **GitHub Pages** (`https://nardacci.github.io/KORbuildtech/`) para homologar com calma. Assim o time dos EUA já usa o Measure sem esperar o resto.

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
- **Convites para cotar (recebidos):** **ficam** no Measure Takeoff (aba *Convites*, a faixa no projeto, "Vou cotar" e "Enviar pela plataforma"), junto com os avisos do sininho. Quem **manda** concorrências ("Cotar com prestadoras", comparar propostas, fechar) é o módulo Concorrências e **fica oculto**; por isso, nesta versão, os convites que chegam vêm de empresas que usam o app completo (homologação) ou de outro projeto.
- **Oculto:** Daily, Crew, concorrências (o lado de quem convida), cronograma, Obras, Funcionários, Encargos, Regras, aviso de GPS, aviso de instalar no celular, protótipo, roteiros de teste, sininho de outros módulos.
- **O Measure Takeoff vale para qualquer empresa** (na versão completa ele é só de prestadoras e de quem é ambos).
- O que fica oculto **continua existindo no banco e nas regras de acesso**: nada foi apagado.

## Passo a passo para publicar (no seu computador, com a sessão local)

1. `git pull origin main`
2. Guia: `portal-measure/` já vem no repositório. Se o texto do guia mudar: `python3 tools/gerar_portal.py --edicao=measure`
3. Montar a pasta: `node tools/gerar-producao.mjs` → cria `producao/`
   - Com **outro projeto Supabase** para produção (recomendado, veja abaixo): defina antes, na janela do PowerShell, `$env:KOR_SUPABASE_URL = 'https://<projeto>.supabase.co'` e `$env:KOR_SUPABASE_ANON_KEY = '<chave pública anon/publishable>'`. Essa chave é pública por desenho; **nunca** use a `service_role`.
4. Conferir: `node tests/producao.test.mjs` (14 verificações: sem protótipo, sem roteiros, guia só do Measure Takeoff, service worker coerente).
5. Enviar **o conteúdo** de `producao/` para a pasta do domínio na hospedagem (Hostinger: `public_html`, por FTP ou pelo Gerenciador de Arquivos). O `.htaccess` já força https e não lista pastas.
6. Abrir `https://korbuildtech.com/` em janela anônima, entrar e conferir: só Measure Takeoff e Settings.

## Banco de dados: um só ou dois?

- **Um só (o de hoje):** mais rápido, mas os usuários e os dados de teste da homologação ficam ao lado dos clientes reais. Os e-mails (convite, avisos) usam **um** endereço de volta (`SITE_URL`), então os links só apontariam para um dos dois sites.
- **Dois (recomendado):** um projeto Supabase novo para produção (região us-west-2), com as mesmas migrações (`supabase/migrations/`, em ordem), as funções de borda, o bucket de Storage e os segredos. A homologação segue no projeto atual. Cada ambiente tem o próprio `SITE_URL`. A pasta `producao/` já sabe trocar a URL e a chave (passo 3).

## Supabase: o que ajustar para o domínio (feito pela sessão local, com revisão)

Em **cada** projeto que atende o domínio:

1. **Authentication › URL Configuration:** `Site URL` = `https://korbuildtech.com/`; em *Redirect URLs* acrescente `https://korbuildtech.com/**` (e deixe os endereços da homologação e `http://localhost…` no projeto de teste).
2. **Segredo `SITE_URL`** das funções de borda = `https://korbuildtech.com/` (com a barra no fim). É para onde vão os links dos e-mails.
3. **E-mails (SMTP):** remetente `KORbuild <no-reply@korbuildtech.com>`; a senha do SMTP só em `KOR_SMTP_PASS`, nunca no chat.
4. **CORS das funções de borda:** hoje `*`. Para a produção, restrinja a `https://korbuildtech.com` (decisão marcada para depois do lançamento).
5. **CSP:** a política está pronta mas desligada (`node tools/csp-meta.mjs --ligar`). Ligue depois de rodar o Measure Takeoff com ela (testes em `tests/_csp.mjs`).

## DNS e domínio

- O domínio aponta para a hospedagem (registro A/CNAME que a Hostinger indicar). Se o domínio estiver na Hostinger, é só escolher a pasta do site.
- HTTPS (certificado gratuito da hospedagem) ligado **antes** de mandar o link ao time dos EUA: o service worker e o login exigem https.

## Antes de mandar o link ao time dos EUA

- [ ] `https://korbuildtech.com/` abre, entra com uma conta de verdade e mostra só Measure Takeoff e Settings.
- [ ] Criar uma empresa nova (qualquer tipo) e abrir o Measure Takeoff: envia o PDF, define a escala, mede, emite uma proposta.
- [ ] Convidar um usuário: o e-mail chega, o link abre `korbuildtech.com` e a pessoa entra.
- [ ] Recuperar senha: o e-mail chega e o link volta para o domínio.
- [ ] `https://korbuildtech.com/portal/` mostra o guia só do Measure Takeoff e do Settings (EN e PT).
- [ ] Os testes de segurança passam contra o projeto de produção (`tests/seguranca.test.mjs --real`).
- [ ] Preço e pagamento: continuam por último (decisão anterior).

## O que continua na homologação

Daily, Crew, concorrências, cronograma, o protótipo e os roteiros de celular (iPhone e Android) seguem no GitHub Pages com os testes do WebKit e dos aparelhos. Quando cada módulo estiver pronto, ele entra em `js/versao.js` (lista `MODULOS_DA_VERSAO`) e o guia da edição ganha as páginas dele.
