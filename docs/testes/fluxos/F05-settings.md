# F05 · Settings: usuários, perfis de acesso, empresa e isolamento

**Objetivo:** provar a administração da empresa: o administrador convida uma pessoa por link, ela aceita e entra com o perfil certo (vendo só o que o perfil permite), o administrador cria um perfil novo, troca e desativa acessos, edita os dados da empresa e da própria conta; outra empresa não enxerga nada disto; e tudo fica na auditoria.

**Escopo:** o Settings da 1ª versão tem Início, Contatos, Funções, Usuários, Perfis de acesso, Empresa e Meu perfil. **Contatos e Funções** estão no F01. **Preços e margens** vivem no Takeoff (F01 e F02). Não há tela de auditoria: ela é conferida no banco. Troca de senha e recuperação por e-mail ficam no teste `conta`, para não mandar e-mail de verdade.

**Roda em:** conta real. Em `--real` a Gabi entra pela tela de login de verdade; no banco local (sem o serviço de login) ela entra com a sessão já gravada e o passo 2 pula o "sem login". Os demais passos são iguais.
**Comando:** `node tests/fluxo-05-settings.test.mjs --relatorio` (banco local) ou `… --real --relatorio` (precisa de `SUPABASE_ACCESS_TOKEN`).

**Pré-condições (feitas pelo teste, `tests/_fluxo-dados.mjs`, apagadas no fim):** a empresa dos fluxos com **Fábio Fluxo** (Administrador) e **Eduardo Encarregado** (perfil Encarregado); a pessoa **Gabi Gestora** (`fluxo.gabi@example.com`), com login e sem empresa; a pessoa **Olga Outra** (`fluxo.olga@example.com`) com a empresa "Fluxo Outra Ltda" e um contato dela. Nenhum e-mail sai.

**Dados fixos:** usuário cadastrado direto: **Heitor Novo** (`fluxo.heitor@example.com`, cargo "Encarregado de obra", telefone `(603) 555-0180`, perfil Encarregado); convite para a Gabi com o perfil "Gestor de obras"; perfil novo "Encarregado com diário" a partir do Encarregado; telefone da empresa `(603) 555-0199`; telefone do administrador `(603) 555-0123`.

| # | Quem | Onde | O que faz | Esperado |
|---|---|---|---|---|
| 1 | Fábio (admin) | Settings › Usuários | Ver a lista e convidar a Gabi como "Gestor de obras" | A lista mostra Fábio e Eduardo, e nenhum seletor para mudar o próprio perfil do Fábio; o convite gera um link `#/aceitar/…` e aparece como pendente; no banco: um convite da Gabi com o perfil Gestor |
| 2 | Gabi (convidada, sem empresa) | Link do convite | Abrir o link e entrar | Sem login (só no `--real`) o link diz "Você foi convidado"; depois de entrar, o convite guardado aparece com "Aceitar o convite" |
| 3 | Gabi | Aceitar o convite | Aceitar e olhar o Settings | Entra na empresa como "Gestor de obras"; não vê Usuários nem Perfis de acesso; digitar o endereço de Usuários não abre a tela; a Empresa é só para consulta; no banco: membro ativo com o perfil Gestor |
| 4 | Fábio | Settings › Perfis de acesso | Criar o perfil "Encarregado com diário" a partir do Encarregado | Os 4 perfis padrão viram 5 e o editor de permissões do novo abre sozinho; o novo aparece na lista de perfis do convite; o Administrador continua travado (painel só para ver) |
| 5 | Fábio | Settings › Usuários | Trocar o perfil da Gabi para Trabalhador e depois desativá-la | O perfil muda no banco; ao desativar, `membros.ativo` fica falso; a Gabi, ao recarregar, vê "Seu acesso foi desativado" |
| 6 | Fábio | Settings › Empresa e Meu perfil | Salvar o telefone da empresa e o telefone do próprio perfil | Os dois ficam no banco (`empresas.telefone`, `membros.telefone`) |
| 7 | Olga (outra empresa) | Banco como a Olga | Ler membros, contatos e perfis | Só enxerga os da empresa dela: nenhum membro, contato ou convite da empresa dos fluxos |
| 8 | Fábio (admin) | Settings › Usuários › Novo usuário | Cadastrar o Heitor direto (nome, e-mail, telefone, cargo, perfil Encarregado); tentar o mesmo e-mail de novo; gerar uma nova senha provisória | O painel mostra a senha provisória uma única vez (3 grupos de 4); no banco: membro ativo com perfil, cargo e telefone, e a auditoria atribui o cadastro ao Fábio; o e-mail repetido é recusado ("já tem conta"); a nova senha provisória fica na auditoria. **Só no `--real`:** o Heitor entra com a senha provisória, cai na troca de senha, não abre o resto do sistema antes de trocar e, trocada, entra na empresa |
| 9 | Fábio | Auditoria (no banco) | Conferir o registro do que foi feito | A auditoria da empresa registra o convite, o perfil novo, a troca e a desativação (pelo menos 4 registros); nenhum erro de JavaScript em todo o fluxo |

**Desfaz:** a empresa dos fluxos, a "Fluxo Outra Ltda" e os logins `fluxo.*@example.com` são apagados no fim (`--manter` guarda os dados).
