# Pendências de padrão: o que mudou no sistema e ainda não chegou a todos os lugares

Regra (`CLAUDE.md`, "Regra de ouro"): mudou tela, layout, processo ou regra, muda junto o protótipo, os documentos, o guia do portal, o manual do usuário e os testes. Quando algo não couber na entrega, entra aqui, com o motivo, e sai quando for feito.

Levantamento de 09/11/2026 (depois da padronização das telas e do novo Início):

| # | O que | Onde falta | Motivo / como fechar |
|---|---|---|---|
| 1 | Telas de cadastro no padrão grade + painel (Usuários, Perfis, Contatos, Funções, Funcionários, Obras, Modelos, Regras) | **Protótipo `?demo`** (`js/settings-telas.js`, `js/obras-telas.js`): ainda formulários em página e listas antigas | Duplicadas do código da conta real. Refazer com os mesmos ajudantes de `js/padrao-cadastro.js`. |
| 2 | Cadastro direto de usuário com senha provisória, perfis criados pelo cliente | **Protótipo** (não há login real nele) e **guia do portal** (`portal/fonte/*/settings/user-manual.md`) | Texto do portal ainda descreve convite. Atualizar PT e EN e regerar o portal. |
| 6 | Padrão de erro de formulário (`avisarErro`) e confirmação ao remover | **Protótipo** (`js/settings-telas.js` ainda usa aviso que some em alguns pontos) | Trocar junto com o item 1. |
| 7 | Termo "Preparo" (antes "Andamento") na montagem do orçamento | Guia do portal e manual (texto que cita "Andamento" do projeto) | Procurar nos `.md` do portal e do manual e trocar. |
