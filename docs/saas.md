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

## Atores

Decidido em outubro de 2026. Público: **prestadoras de serviço e construtoras/empreiteiras nos EUA**, começando por New Hampshire.

| Ator | No mercado americano | Papel no KORbuild |
| --- | --- | --- |
| **Empresa** | *Subcontractor / trade contractor* (framing, siding, drywall, reforma) ou *general contractor* | **Assina e usa.** Mede e orça (Measure), controla a equipe (Crew), faz o diário (Daily). O perfil (logo, licenças, seguros, termos da proposta) fica em Settings › Empresa |
| **Funcionários** | *Crew* | São da empresa (Settings › Funcionários) e entram como usuários, com perfil de acesso |
| **Construtora** | *General contractor (GC)* | **Contato.** Contrata a prestadora; recebe a proposta, o diário e o avanço por link ou PDF |
| **Cliente** | *Owner / homeowner* | **Contato.** Dono da obra. Recebe a proposta quando contrata a prestadora direto (sem construtora) |
| **Fornecedor** | *Supplier / lumber yard* | **Contato.** Recebe a lista de materiais para cotação e devolve os preços. Diz o que fornece (etapas do catálogo) |
| **Prestadora** (vista pela construtora) | *Subcontractor* | **Contato** da construtora: a empresa de serviço que ela contrata. Se a prestadora também assina o KORbuild, ela tem a sua própria empresa, com os seus dados |

**Na demonstração** há duas empresas, isoladas (cada uma só vê os seus dados):
- **Construtora Exemplo**: Ana (administradora), Márcia (gestora), Carlos e Roberto (encarregados), Diego (trabalhador); as três obras com diário e ponto (Daily e Crew; o Measure não é dela). Para ela, a Northfield é um contato (prestadora).
- **Northfield Framing & Siding**: Tom (administrador), Rita (estimadora, gestor de obras), José (encarregado) e Luis (trabalhador); os projetos do Measure (com as plantas) e um serviço no Residencial Jardim das Flores, em que a contratante é a Construtora Exemplo e a dona é a Incorporadora Horizonte.
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
| Várias empresas isoladas | Ainda não: há uma empresa só, no navegador |
| Cadastro da empresa, convite de usuários, assinatura e cobrança | Só na tela (avisam que vêm na próxima etapa) |
| Cadastro de obras | Ainda não: as obras vêm dos dados de exemplo |
