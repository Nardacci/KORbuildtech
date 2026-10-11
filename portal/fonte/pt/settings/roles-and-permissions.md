# Perfis e permissões

No KORbuild, nada de acesso fica fixo no código. O produto define o **catálogo de permissões**; cada empresa decide **quais permissões cada perfil tem** (Settings › Perfis) e **qual perfil cada usuário tem** (Settings › Usuários). Toda mudança vai para a auditoria.

## O catálogo de permissões

| Grupo | Permissão | O que libera |
|---|---|---|
| Crew · ponto | **Bater o próprio ponto** | Meu ponto: entrada, intervalo e saída no próprio celular, com GPS. |
| Crew · ponto | **Bater o ponto da equipe** | Encarregado: bate o ponto da equipe e vê as horas dela. |
| Crew · escritório | **Acompanhar ponto e timesheets** | Agora, timesheets e o mapa do dia. |
| Crew · escritório | **Aprovar e ajustar timesheets** | Aprovar, devolver, ajustar e exportar para a folha. Inclui *Acompanhar*. |
| Crew · escritório | **Ver custos e valores em dinheiro** | Custos das obras, orçamentos, salários nas timesheets. Inclui *Acompanhar*. |
| Daily | **Preencher o diário de obra** | Criar e enviar os diários das suas obras. |
| Daily | **Acompanhar todas as obras** | Painel, obras e diários enviados. |
| Daily | **Aprovar RDO e enviar ao contratante** | Aprovar, pedir ajuste, PDF e link do contratante. Inclui *Acompanhar todas as obras*. |
| Daily | **Montar o cronograma da obra** | Etapas, linha de base, publicar para o contratante e exportar para o Excel. Inclui *Acompanhar todas as obras*. |
| Measure | **Medir plantas (takeoff)** | Projetos, plantas, escala, medição, assemblies, listas para cotação e propostas. |
| Measure | **Itens e assemblies** | Catálogo, fórmulas, preços e margens. Inclui *Medir plantas*. |
| Settings | **Cadastro de funcionários** | Cadastros, certificações e valores hora. |
| Settings | **Encargos e regras de jornada** | Novas versões, com vigência. |
| Settings | **Usuários e perfis de acesso** | Quem entra e o que cada perfil pode fazer; auditoria. |
| Settings | **Empresa, conta e plano** | Cadastro da empresa, plano e módulos. |
| Settings | **Contatos** | O cadastro de construtoras, clientes, fornecedores e subempreiteiros. |
| Settings | **Cadastrar e editar obras** | Obras e modelos de etapas. |

**Ver custos e valores em dinheiro** é separada de propósito: um superintendente pode aprovar horas sem ver o salário de ninguém.

## Perfis prontos

| Perfil | Em resumo | Ao entrar |
|---|---|---|
| **Trabalhador** | Bater o próprio ponto. | Direto no **Meu ponto** — sem tela de módulos, sem menu. |
| **Encarregado** | O próprio ponto, o ponto da equipe, diários de obra. | Tela de módulos (Daily e Crew). |
| **Gestor de obras** | Acompanha e aprova no Daily e no Crew, vê custos, mede, cadastra obras. | Tela de módulos (Daily, Crew, Measure e Settings só com Obras). |
| **Administrador** | Tudo no escritório, inclusive o Settings. **Travado.** | Tela de módulos. |

![A matriz de permissões](img/settings-roles.png)

!!! note "Bom saber"
    - **A tela inicial segue as permissões.** Quem tem um só módulo entra direto nele.
    - **O Administrador é travado**, para a empresa nunca perder a gestão dos acessos. Sempre precisa haver pelo menos um usuário ativo com *Usuários e perfis de acesso*, e ninguém tira o próprio acesso.
    - **As dependências são automáticas:** aprovar inclui acompanhar; ver custos inclui acompanhar.
    - **Um perfil em uso não pode ser excluído:** troque antes o perfil dos usuários.
    - **Sem permissão, a tela não abre**, nem digitando o endereço.
    - **Usuário** é quem entra no sistema; **funcionário** é quem trabalha nas obras. Um trabalhador que bate o ponto no próprio celular precisa dos dois, ligados. Quem tem o ponto batido pelo encarregado não precisa de login.

## Exemplos

- **Um trabalhador que também preenche o diário:** marque *Preencher o diário de obra* no perfil Trabalhador, ou crie um perfil novo a partir dele. Ele vai ver o Daily e o Crew.
- **Um encarregado que aprova timesheets:** crie um perfil a partir do Encarregado e marque *Aprovar e ajustar timesheets*.

## No protótipo

| Usuário de exemplo | Empresa | Perfil |
|---|---|---|
| Ana Ribeiro | Construtora Exemplo (construtora) | Administradora |
| Sandra Lopes | Ridgeline Concrete & Masonry | Administradora |
| Márcia Souza | Ridgeline Concrete & Masonry | Gestora de obras (fora da lista de entrada) |
| Tom Reilly | Northfield Framing & Siding | Administrador |
| Rita Gomes | Northfield Framing & Siding | Gestora de obras |
