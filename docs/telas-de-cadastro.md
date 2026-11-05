# Telas de cadastro: o mesmo layout e o mesmo comportamento

Decisão do dono (05/11/2026): as telas de administração e cadastro não podem parecer "formulário dos anos 1960" ao lado do dashboard. Todas seguem o padrão de produto atual, com o mesmo layout e o mesmo comportamento.

## O padrão (`js/padrao-cadastro.js` + `abrirPainel` em `js/util.js`)
1. **Cabeçalho da página:** título, uma linha de explicação e, à direita, o botão primário de criar ("Novo usuário", "Novo perfil", "Novo contato", "Nova função").
2. **Busca e filtros em chips** (Todos / Ativos / Desativados, ou por marcador), com a contagem de cada um. Só escondem linhas: não recarregam nada.
3. **Grade em cartão:** cabeçalho em maiúsculas, linhas altas, avatar com iniciais, chips de perfil e de marcador, situação com bolinha, números alinhados, ações da linha à direita ("Editar").
4. **Painel lateral para criar e editar:** abre à direita, com cabeçalho, corpo rolável e rodapé fixo (Cancelar / Salvar; ações perigosas, como Excluir, à esquerda). Erros aparecem no painel e ele não fecha. Esc, o × ou clicar fora fecham; mudar de endereço (Voltar) também fecha.
5. **Sem formulário aninhado:** o painel já é um `<form>`; os campos são lidos com `lerCampos`.

## O que já está no padrão
| Tela | Como ficou |
|---|---|
| **Settings › Usuários** | grade (pessoa, perfil, situação, último acesso); perfil trocado direto na linha; **Editar** (nome, telefone, cargo, perfil, situação); **Novo usuário** (convite por link, em painel) |
| **Settings › Perfis de acesso** | grade (perfil, tipo Sistema/Modelo/Personalizado, quantas permissões, quem usa); **Novo perfil** em branco ou a partir de outro; editor com nome, descrição e permissões em chaves, agrupadas **só pelos módulos que o cliente tem** (o Crew aparece quando existir); excluir qualquer perfil sem uso, **menos o Administrador** |
| **Settings › Contatos** | grade com busca e filtro por marcador; painel com dados, marcadores, endereço, etapas e notas; excluir |
| **Settings › Funções** | grade (valor hora, custo da hora, funcionários, itens); painel com nome, situação, **histórico do valor hora** e "Novo valor hora" |
| **Settings › Empresa e Meu perfil** | cabeçalho de página no mesmo estilo (continuam formulários de uma tela só) |
| **Takeoff › Itens, Assemblies e Projetos** | mesma grade (cabeçalho, linhas, chips). O editor de item (histórico de preços) e o de assembly (linhas com fórmulas) continuam em página própria: são áreas de trabalho, não formulários curtos |
| Funcionários, Obras (lista) | mesma grade; os formulários grandes continuam em página até o Crew chegar |

## Regras de comportamento
- O administrador cuida do cadastro de todas as pessoas e de todos os perfis. A própria pessoa muda só os dados pessoais, em "Meu perfil"; **nunca o próprio perfil nem as permissões** (regra do banco: ninguém altera o próprio acesso).
- A empresa sempre mantém alguém ativo que cuide dos acessos: o Administrador não se exclui nem perde as permissões.
- Perfil "Modelo" (Gestor, Encarregado, Trabalhador) é só ponto de partida: pode ser renomeado, alterado e excluído quando ninguém o usa. Perfil em uso não se exclui: a tela diz quem usa.
- Nenhuma migração de banco foi preciso para isto: as regras (RLS e gatilhos) já permitiam. O banco continua sendo a autoridade.

## Para criar uma tela nova neste padrão
Monte com `cabecalhoDePagina`, `barraDeBusca`, `gradeEmCartao` e `atributosDeLinha`; abra a edição com `abrirPainel({ titulo, corpo, aoSalvar })` e leia os campos com `lerCampos(painel)`. Cada linha da grade tem um botão `data-acao` que abre o painel; deixe o painel voltar à lista ao fechar se foi aberto por endereço.

## Pendente
- Cadastro **direto** da pessoa pelo administrador (login com senha provisória, sem convite), planejado: exige função no servidor e migração.
- Opção "é funcionário" (ponto e valor hora) na mesma tela de Pessoas, junto com o Crew.
- Editor de itens e de assemblies em painel, se o uso mostrar que vale.
