# Obra na 1ª versão: o projeto ganho é a obra (decisão do dono, 27/10)

**Para o usuário, só existe projeto.** Na 1ª versão (Takeoff + Bids + Settings) não há cadastro de obra:
- Settings não tem a tela Obras (nem `#/conta/obras`); o botão Settings do Início abre Contatos.
- Fechar uma concorrência que saiu de um projeto ganho não exige obra (a contratada fica ligada ao projeto). No banco: migração **0019** (`supabase/pendentes/`, aguardando "pode aplicar 0019"); até lá, na conta real o fechamento ainda pede a obra.
- A visão geral do projeto não mostra "Obra vinculada" nem o aviso "Projeto ganho: cadastre a obra"; o formulário Editar projeto não oferece "Obra vinculada".
- O Início não conta obras, não tem o cartão "Projeto ganho sem obra" nem o bloco "Prazo das obras": o andamento é o bloco **Andamento dos projetos** (Gantt).
- Quem venceu uma concorrência vê "Você venceu", sem "Criar obra a partir deste projeto".
- A nova concorrência parte sempre de um projeto (empresa sem projetos: cria um projeto antes). Não existe obra sem projeto.

**Por baixo, nada foi apagado.** Tabelas, migrações, modelos de etapas, "Criar obra a partir do projeto ganho" e o cronograma confirmado continuam no código, dormentes.

**Versão completa (guardado):** o projeto ganho ganha a aba *Execução* (cerca do ponto, dias de trabalho, prestadoras ligadas, situação) e o Daily e o Crew aparecem dentro dele. O registro de obra passa a ser criado automaticamente, 1 para 1, quando o projeto é ganho (ou quando a versão completa for ativada): ninguém cadastra, ninguém vê; é a ligação interna que mantém diário, ponto, aprovações e cronograma como estão no banco. Um projeto = uma obra; as tarefas do cronograma = as etapas da obra.
