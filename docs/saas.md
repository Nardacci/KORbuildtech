# KORbuild — estrutura SaaS

> **Mercado-alvo: Estados Unidos.** Preços em dólar, cobrança recorrente por cartão (ex.: Stripe), impostos sobre venda de software conforme o estado, contratos e termos de uso em inglês, privacidade conforme as leis estaduais (ex.: CCPA na Califórnia).

Documento de análise de negócio. Descreve como a plataforma se organiza como SaaS: quem é o cliente, o que ele contrata, quem usa e como os dados ficam separados. O protótipo já segue esta estrutura com uma empresa fictícia; o que ainda é simulado está marcado.

## Conceitos

| Conceito | O que é | Exemplo |
| --- | --- | --- |
| **Empresa** (tenant) | O cliente da plataforma: quem assina e paga. Tudo pertence a uma empresa. Pode ser uma **prestadora de serviço** (subcontractor) ou uma **construtora** (general contractor). Ver §Atores. | Construtora Exemplo · Northfield Framing & Siding (prestadora) |
| **Assinatura** | O plano da empresa, a situação (teste, ativa, em atraso, cancelada) e os limites. | Plano Profissional, teste grátis até 14/10 |
| **Módulo** | Uma parte da plataforma que a empresa contrata. | Daily, Crew, Measure |
| **Usuário** | Uma pessoa da empresa, com login próprio e um papel. | Carlos (campo), Ana (administradora) |
| **Papel** | O que o usuário pode fazer. | Administrador, Campo |
| **Obra** | Cadastro comum a todos os módulos. Unidade de cobrança. | Residencial Jardim das Flores |
| **Contato** | Os de fora, num diretório só com marcadores: construtora, cliente (dono da obra), fornecedor. Recebem documentos sem ter conta. | Merrimack Valley Builders (construtora), pelo link do diário |

## Hierarquia: construtora → prestadoras → funcionários

Decidido em outubro de 2026. É a regra que organiza o SaaS inteiro:

```
Construtora (empresa assinante)
├── Funcionários da construtora ......... cadastrados e gerenciados pela construtora
└── Prestadoras (N)
    └── Funcionários da prestadora (N) .. cadastrados e gerenciados pela prestadora
```

| ID | Regra | Situação |
| --- | --- | --- |
| HS-01 | **Uma construtora tem N funcionários e N prestadoras; cada prestadora tem N funcionários.** A mesma prestadora pode trabalhar para várias construtoras. | Funcionando |
| HS-02 | **Cada empresa cadastra e gerencia os próprios funcionários.** Os da construtora ficam na conta da construtora; os da prestadora, na conta da prestadora. Uma empresa nunca vê nem edita os funcionários de outra. O cadastro mostra a **empresa (empregador)**, que é sempre a conta onde ele está. | Funcionando |
| HS-03 | **O funcionário só registra as horas** (Meu ponto, ou o encarregado bate pela equipe). Não vê valores. | Funcionando |
| HS-04 | **O gestor da empresa vê tudo dos funcionários dela**: horas, valor hora, encargos e impostos, custo por obra e timesheets. Vale para a construtora e para a prestadora, cada uma com os seus. | Funcionando |
| HS-05 | **A prestadora tem a própria obra, ligada à da construtora** (`vinculo`). Ela registra o ponto dos funcionários dela nessa obra. | Funcionando |
| HS-06 | **(Primeira versão, substituída pelo HS-10.)** A construtora vê as prestadoras da obra em pessoas e horas por função: quem está na obra agora, quantos vieram, horas do dia e da semana. Sem nomes e sem valores: salário, encargos e custo são da prestadora. (Obra › Prestadoras nesta obra.) | Funcionando · **a confirmar** |
| HS-07 | **(Revisto pelo HS-09 e HS-11: quem faz o diário é a prestadora.)** O diário da construtora traz a equipe por empresa: a própria, pelo ponto dela; cada prestadora ligada, pelo ponto da prestadora; e a prestadora que não usa o KORbuild, lançada à mão (empresa, função, quantas pessoas). O relatório, o PDF e o link do cliente separam a mão de obra por empresa. | Funcionando |
| HS-08 | **Prestadora sem KORbuild** é um contato da construtora (marcador prestadora). A equipe dela entra no diário à mão. | Funcionando |

### Quem cadastra o quê (confirmado em outubro de 2026)

**A construtora** é quem gerencia a obra. **Não executa:** não usa o Daily nem o Crew com equipe própria, só acompanha as prestadoras.

| # | A construtora cadastra | Observação |
| --- | --- | --- |
| 1 | **Prestadoras** | Vínculo com a empresa da prestadora (convite). Prestadora sem KORbuild continua como contato |
| 2 | **Os próprios funcionários** | São dela, nunca da prestadora. São o pessoal de gestão (engenheiros, gerentes, administrativo), que entra como usuário. Não batem ponto no KORbuild |
| 3 | **Obras (projetos)** | E quais prestadoras trabalham em cada uma |
| 4 | **Perfis de acesso** dos funcionários dela | Com a visão gerencial de todas as prestadoras (HS-10) |
| 5 | **Settings** | Empresa, obras, usuários, perfis, contatos (dono da obra, fornecedores) |
| + | Concorrência e plano | Concorrências para as prestadoras, com o canal: especificação para o protótipo em `docs/concorrencias.md` (v2) |

**A prestadora** executa o serviço.

| # | A prestadora cadastra | Observação |
| --- | --- | --- |
| 1 | **O cronograma do serviço** em cada obra | Publicado para a construtora |
| 2 | **Os próprios funcionários** e as equipes | Valor hora, encargos, certificações |
| 3 | **Daily** | O diário do serviço dela na obra, **aprovado pela construtora** (HS-11) |
| 4 | **Crew** | Ponto, timesheets, custos |
| 5 | **Measure** | Medição, preços, propostas |
| 6 | **Settings** | Empresa, usuários, encargos, regras de jornada, contatos |
| 7 | **Perfis de acesso** | |
| + | Obras próprias | Quando o dono contrata direto ou a construtora não usa o KORbuild |

| ID | Regra | Situação |
| --- | --- | --- |
| HS-09 | **A construtora não usa o Daily nem o Crew com equipe própria.** O Crew e o Measure nem aparecem para ela; o Daily dela é de acompanhamento (painel, aprovações, obras). No Settings não há encargos nem jornada (são do ponto), e a obra dela não tem responsável pelo diário nem modelo de cronograma. | Funcionando |
| HS-10 | **Visão gerencial da construtora: tudo das prestadoras, menos valores.** Na obra, cada prestadora com quem está agora, quantos vieram, horas do dia e da semana e a lista de pessoas (nome, função, entrada, situação, horas). Os diários e os cronogramas de cada uma. Salário, encargos e custo ficam só com a prestadora. Substitui o HS-06. | Funcionando |
| HS-11 | **O diário da prestadora é aprovado pela construtora.** A prestadora preenche e envia; o diário cai na fila de aprovação da construtora, que aprova e lacra ou pede ajustes. O diário fica na conta da prestadora, com quem aprovou e a empresa ("Ana Ribeiro (Construtora Exemplo)"); o andamento vai para o cronograma da prestadora. A prestadora vê "Com a construtora" e não aprova. O lacre e o link do cliente continuam iguais. Farol, escalada da manhã e sininho da construtora são por prestadora em cada obra. | Funcionando |
| HS-12 | **O cronograma é só das prestadoras.** A construtora não monta um cronograma geral: vê os cronogramas publicados por cada prestadora na obra. | Funcionando |
| HS-13 | **A prestadora pode ser cliente sem construtora.** Ela assina sozinha e tem obras próprias, contratadas direto pelo dono (ou por uma construtora que não usa o KORbuild). Nessas obras, ela mesma aprova o diário e é dona de tudo; a obra não tem `vinculo`. | Funcionando (Northfield: Residência Thompson) |
| HS-14 | **A prestadora também contrata (quarteirização).** Ela pega um serviço de uma construtora e passa parte dele a outra prestadora, pela mesma concorrência e pelo mesmo canal (`docs/concorrencias.md` CO-19 a CO-25). Quem contrata aprova o diário de quem contratou; a construtora vê a presença de toda a cadeia na obra, sem valores. | Funcionando |

**No protótipo**, a construtora calcula essa visão lendo os dados da prestadora em nome dela (`emNomeDaEmpresa` em `js/armazem.js`) e recebe só o resumo. Os diários de fora vêm de `diariosDeFora()`; aprovar grava no diário da própria prestadora. O navegador é o "aparelho" de todos: a fila de envio sem internet e a falta de internet simulada valem para qualquer empresa. **Na versão real**, quem faz isso é o servidor: a construtora nunca recebe as batidas nem os valores da prestadora; recebe uma visão pronta (pessoas e horas por função, por obra ligada), como já acontece com o cronograma publicado.

**No banco de dados** (Supabase): `funcionarios.empresa_id` é obrigatório e as regras de acesso (RLS) só deixam ler e gravar funcionários e batidas da própria empresa. A visão da construtora é uma função do servidor que agrega as batidas das obras ligadas (`obras.vinculo_empresa_id`, `obras.vinculo_obra_id`) e devolve só funções, pessoas e minutos.

## Atores

Decidido em outubro de 2026. Público: **prestadoras de serviço e construtoras/empreiteiras nos EUA**, começando por New Hampshire.

| Ator | No mercado americano | Papel no KORbuild |
| --- | --- | --- |
| **Empresa** | *Subcontractor / trade contractor* (framing, siding, drywall, reforma) ou *general contractor* | **Assina e usa.** Mede e orça (Measure), controla a equipe (Crew), faz o diário (Daily). O perfil (logo, licenças, seguros, termos da proposta) fica em Settings › Empresa |
| **Funcionários** | *Crew* | São da empresa que os emprega (Settings › Funcionários): a construtora cadastra os dela, a prestadora os seus (§Hierarquia). Quem bate o próprio ponto também é usuário, com perfil de acesso |
| **Construtora** | *General contractor (GC)* | **Contato.** Contrata a prestadora; recebe a proposta, o diário e o avanço por link ou PDF |
| **Cliente** | *Owner / homeowner* | **Contato.** Dono da obra. Recebe a proposta quando contrata a prestadora direto (sem construtora) |
| **Fornecedor** | *Supplier / lumber yard* | **Contato.** Recebe a lista de materiais para cotação e devolve os preços. Diz o que fornece (etapas do catálogo) |
| **Prestadora** (vista pela construtora) | *Subcontractor* | **Contato** da construtora: a empresa de serviço que ela contrata. Se a prestadora também assina o KORbuild, ela tem a sua própria empresa, com os seus dados |

**Na demonstração** há três empresas, isoladas (cada uma só vê os seus dados):
- **Construtora Exemplo** (gerencia, não executa): Ana (administradora) e Laura (gestora). As três obras (Jardim das Flores, Atlântico, Galpão), só com o Daily de acompanhamento: aprova os diários das prestadoras e vê quem está em cada obra. Funcionários: só a gestão (Ana e Laura).
- **Ridgeline Concrete & Masonry** (prestadora de estrutura e alvenaria): Sandra (administradora), Márcia (gestora), Carlos e Roberto (encarregados), Diego (trabalhador). Uma obra ligada a cada obra da construtora, com diário, ponto, custos e o caso do Atlântico acima do orçamento. Os diários dela vão para a Ana aprovar.
- **Northfield Framing & Siding** (prestadora de framing e siding): Tom (administrador), Rita (estimadora, gestor de obras), José (encarregado) e Luis (trabalhador); os projetos do Measure (com as plantas), um serviço no Jardim das Flores (ligado à construtora; diários aprovados pela Ana) e a Residência Thompson, cliente direto sem construtora (HS-13; o Tom aprova). Funcionários: José, Luis, Kevin e André, com duas semanas de ponto no Jardim e hoje em campo desde as 7h.
- No aparelho, o armazenamento guarda `{ versao, padrao, empresas: { id: dados } }`; a empresa aberta é a do usuário da sessão (`js/armazem.js`).

**Regras dos atores**
1. **Nada fixo de "construtora".** A empresa assinante é "a empresa"; no perfil ela diz como atua (prestadora, construtora ou as duas).
2. **Um diretório de contatos, com marcadores.** O papel depende do projeto: a mesma empresa contrata como construtora num projeto e é cliente em outro. Contato em uso (projeto, obra) não pode ser excluído.
3. **Partes de cada projeto (Measure) e obra (Daily):**
   - **contratante** (obrigatório): quem recebe a proposta e o diário. É a construtora, ou o dono quando contrata direto;
   - **dono da obra** (opcional): o cliente final, quando não é o contratante.
4. **Para onde vai cada documento:**
   - proposta → contratante;
   - lista de materiais → fornecedores (por etapa);
   - diário de obra (link lacrado) → contratante.
5. **Contato novo sem sair do formulário:** o botão "Novo" ao lado do campo cria o contato (só nome, pessoa, e-mail, telefone e marcador) e já o escolhe.
6. **O Measure é de quem executa o serviço** (prestadora, ou empresa que "contrata e executa"). A construtora **não abre os desenhos**: o módulo nem aparece para ela. No futuro, ela recebe os **relatórios** (proposta, lista de materiais) como contato contratante, por link ou PDF.
7. **Permissões:** o perfil da empresa é de quem tem "Empresa, conta e plano"; o cadastro completo de contatos é de quem tem "Contatos". Escolher e criar um contato dentro do projeto faz parte de medir.

## Regras

1. **Isolamento total entre empresas.** Uma empresa nunca vê dado de outra. Na versão real, cada registro no banco leva o identificador da empresa e as regras de acesso do banco (RLS, no Supabase) garantem o isolamento, não só a tela.
2. **Cadastros comuns.** Obras, pessoas (usuários e funcionários), funções e equipamentos pertencem à empresa, não a um módulo. É isso que permite um módulo alimentar o outro (Crew → equipe do Daily; Measure → meta de avanço do Daily).
3. **Módulo não contratado não abre.** A tela de módulos mostra todos, mas só os contratados entram; os demais levam à página do módulo (conhecer, contratar ou registrar interesse).
4. **Papéis por empresa.** O mesmo e-mail pode ser administrador numa empresa e campo em outra (ex.: um engenheiro que presta serviço para duas construtoras). Ao entrar, ele escolhe a empresa.
5. **Contatos não pagam e não contam como usuário.** O contratante abre relatórios por link, sem conta.
6. **Teste grátis de 14 dias** com todos os módulos disponíveis; ao fim, a empresa assina ou a conta fica só leitura (os dados não são apagados).

## Papéis

> **Atualizado:** os papéis viraram **perfis de acesso configuráveis** no Settings (Trabalhador, Encarregado, Gestor de obras, Administrador e os que a empresa criar). Ver [`settings.md` §5](settings.md). A tabela abaixo é a versão original.

| Papel | Onde trabalha | Pode |
| --- | --- | --- |
| **Administrador** | Escritório | Ver todas as obras, aprovar e pedir ajustes, gerar PDF e link do cliente, gerenciar a conta, o plano e os usuários |
| **Campo** | Canteiro | Preencher e enviar os relatórios das obras em que atua; não vê o painel nem a conta |
| **Cliente (convidado)** | Fora da empresa | Abrir os relatórios aprovados que recebeu por link |

Permissões detalhadas e a configuração da plataforma estão no KORbuild Settings ([`settings.md`](settings.md)). Papéis a avaliar depois: *Gestor* (aprova, mas não mexe no plano), *Financeiro* (só assinatura e custos do Crew) e *Fiscal do cliente* com login (para dar "ciente" no RDO).

## Modelo de cobrança (hipóteses a validar)

- **Por módulo contratado**, com preço por **obra ativa** por mês. Obra é o que a construtora já usa para orçar e cobrar; cresce junto com o cliente.
- **Usuários ilimitados.** Cobrar por usuário faz a construtora economizar acessos justamente no canteiro, que é onde o dado nasce.
- **Pacote** com desconto para quem contrata mais de um módulo, o que incentiva a ligação entre eles.
- Planos por faixa de obras ativas (ex.: até 5, até 20, acima de 20), com teste grátis de 14 dias.

Perguntas para a validação: a obra é mesmo a melhor unidade de cobrança? Quanto a construtora paga hoje por RDO, ponto e orçamento (software, planilha, horas de estagiário)? Quem decide a compra: dono, diretor de obras ou engenheiro?

## No protótipo

| Item | Situação |
| --- | --- |
| Login, tela de módulos, papéis e permissões | Funcionando (login é mockup, sem senha de verdade; todos entram na página dos módulos e o papel vale dentro do Daily) |
| Uma empresa com plano em teste, uso de obras e usuários | Funcionando, com dados fictícios |
| Registro de interesse nos módulos em breve | Funcionando; aparece na conta da empresa |
| Várias empresas isoladas | Funcionando: duas empresas (construtora e prestadora) no navegador, cada uma só com os seus dados |
| Hierarquia construtora → prestadoras → funcionários | Funcionando (§Hierarquia): cada empresa com os seus funcionários e o seu ponto; a construtora vê as prestadoras da obra em horas |
| Cadastro da empresa, convite de usuários, assinatura e cobrança | Só na tela (avisam que vêm na próxima etapa) |
| Cadastro de obras | Funcionando (Settings › Obras e Daily › Obras; ver [`obras.md`](obras.md)) |
