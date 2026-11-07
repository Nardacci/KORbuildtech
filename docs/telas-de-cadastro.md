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
| **Funcionários** | grade com busca e chips (Todos / Ativos / Desligados / Certificação a vencer); **Novo funcionário** e **Editar** em painel largo (identificação, contrato, certificações, privacidade). A página do funcionário (valor hora, histórico, certificações) continua, aberta pelo nome |
| **Regras** (encargos e jornada) | cabeçalho com os dois botões ("Nova versão dos encargos", "Nova regra de jornada"), cada um num painel; as versões vigentes e o histórico continuam na página |
| **Obras** | grade com busca e chips por situação; **Nova obra** e **Editar** em painel largo, com o mapa; depois de criar, o painel reabre com a equipe (incluir e tirar pessoas dentro do painel) |
| **Obras › Modelos de etapas** | grade; **Novo modelo** e **Editar** em painel (etapas com a soma de 100%) |

## Regras de comportamento
- O administrador cuida do cadastro de todas as pessoas e de todos os perfis. A própria pessoa muda só os dados pessoais, em "Meu perfil"; **nunca o próprio perfil nem as permissões** (regra do banco: ninguém altera o próprio acesso).
- A empresa sempre mantém alguém ativo que cuide dos acessos: o Administrador não se exclui nem perde as permissões.
- Perfil "Modelo" (Gestor, Encarregado, Trabalhador) é só ponto de partida: pode ser renomeado, alterado e excluído quando ninguém o usa. Perfil em uso não se exclui: a tela diz quem usa.
- Nenhuma migração de banco foi preciso para isto: as regras (RLS e gatilhos) já permitiam. O banco continua sendo a autoridade.

## Para criar uma tela nova neste padrão
Monte com `cabecalhoDePagina`, `barraDeBusca`, `gradeEmCartao` e `atributosDeLinha`; abra a edição com `abrirPainel({ titulo, corpo, aoSalvar })` e leia os campos com `lerCampos(painel)`. Cada linha da grade tem um botão `data-acao` que abre o painel; deixe o painel voltar à lista ao fechar se foi aberto por endereço.

## Cadastro direto pelo administrador (05/11/2026; migração 0026 + função `criar-usuario`)
- **Settings › Usuários › Novo usuário:** o administrador informa nome, e-mail (é o login), telefone, cargo e perfil. O sistema cria o login com uma **senha provisória** (12 letras e números sem os que se confundem, em três grupos: `k7Pm-3rTz-Wn9d`), mostrada **uma única vez** com o botão "Copiar endereço, e-mail e senha". Não há convite nem espera de aceite. "Convidar por link" continua para quem prefere que a pessoa crie a própria senha.
- **Primeiro acesso:** quem entra com senha provisória é levado à tela de senha nova e não abre mais nada do sistema até trocá-la (marca `trocar_senha` no cadastro do login). **Editar › Gerar nova senha provisória** repete o processo (a senha atual deixa de valer).
- **Segurança:** só a função de borda cria o login (a chave de serviço nunca sai do servidor); **quem pode é o banco** (`settings.acesso`; o perfil e a pessoa têm de ser da empresa de quem cadastra); a finalização só o `service_role` executa; a senha não é gravada nem escrita no log; 20 cadastros por minuto por administrador; e-mail que já tem conta é recusado (use o convite); a auditoria atribui o cadastro e cada senha provisória ao administrador.
- **Limite honesto:** o administrador conhece a senha provisória até a pessoa trocá-la; depois disso só a pessoa sabe. Se o login já tem conta em outra empresa, o caminho é o convite por link.
- Aplicar: `docs/prompt-aplicar-0026.md` (migração, depois a função com verificação de JWT, depois o app). Testes: `supabase/testes/0018_usuario_direto.sql` e o passo 8 do F05 (no `--real` inclui o primeiro acesso e a troca obrigatória).

## Pendente
- Opção "é funcionário" (ponto e valor hora) na mesma tela de Pessoas, junto com o Crew.
- Editor de itens e de assemblies em painel, se o uso mostrar que vale.
- O protótipo local (`?demo`, `js/settings-telas.js` e `js/obras-telas.js`) ainda tem os formulários em página: fica assim enquanto for só demonstração.

## Botões dentro do painel (07/11/2026)
O painel é anexado ao `<body>`, fora do `#app`. O despacho dos botões com `data-acao` dentro dele é feito por um ouvinte próprio em `js/app.js`; sem ele, "Incluir na obra", o modelo da regra de jornada e o "Copiar endereço, e-mail e senha" não faziam nada.
