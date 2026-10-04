# KORbuild Settings — configuração e parametrização da plataforma

> **Status:** análise de negócio aprovada (seção 8). **Construído no protótipo:** funcionários, encargos e regras de jornada, **usuários e perfis de acesso** e auditoria (seções 5 e 7). Nome definido: **Settings**.
>
> **Mercado-alvo:** Estados Unidos. **Relacionados:** [`saas.md`](saas.md) (empresa, papéis, cobrança), [`crew.md`](crew.md) (módulo Crew).

---

## 1. A ideia, em uma frase

Um lugar único, com acesso controlado, onde a empresa define **seus dados, suas pessoas, seus cadastros e suas regras**, e todos os módulos (Daily, Crew, Measure) leem dali. **Nenhuma regra de negócio fixa no código.**

## 2. Por que faz sentido (e onde estão as armadilhas)

**A favor:**
- **Uma fonte da verdade.** Hoje cada módulo tem a sua lista. As funções do Daily estão em `app.js`, as etapas do Crew em `crew.js`, os prazos do RDO em `prazos.js`. Se o cliente cria a função "Gesseiro", ela tem de aparecer no RDO **e** no ponto.
- **Cada cliente é diferente.** Prazo do RDO, raio da cerca, encargos, regras de hora extra do estado e etapas de obra mudam de empresa para empresa. O SaaS só escala se o cliente se configurar sozinho, sem pedir mudança no código.
- **Pessoas são da empresa, não de um módulo.** O funcionário aparece no ponto (Crew), na equipe do RDO (Daily) e, no futuro, na produtividade (Measure).
- **Venda e implantação.** Uma tela de configuração com padrões prontos encurta a implantação de semanas para horas.

**Os cuidados (o que diferencia uma boa parametrização de uma "tela de 200 campos"):**

1. **Parametrizar o que varia, não tudo.** Um valor vira parâmetro quando muda **entre clientes**, **entre estados ou obras** ou **com o tempo**. Princípios do produto **não** viram parâmetro. Exemplo: "batida nunca é apagada" é garantia legal e de confiança. Se fosse opção, o produto perderia o valor como prova.
2. **Padrões prontos.** Toda configuração nasce preenchida com um padrão sensato (modelo "EUA – federal", modelo "Califórnia"…). O cliente só mexe no que é diferente.
3. **Parâmetro que afeta dinheiro tem vigência.** Mudar os encargos, a regra de hora extra ou um valor hora vale **a partir de uma data** e não reescreve o passado. É o mesmo princípio que já usamos no valor hora.
   > ⚠ **Achado (corrigido):** antes do Settings, mudar os encargos em Custos recalculava o custo de semanas passadas. Agora os encargos têm vigência e as semanas fechadas não mudam.
4. **Toda mudança fica auditada:** quem mudou, quando, valor antes e depois, e motivo. Configuração errada em ponto e folha vira processo trabalhista.
5. **Mostrar o impacto antes de salvar.** Por exemplo: "esta mudança altera o custo de 3 obras a partir de 13/10".
6. **Herança com exceções.** Há padrão da plataforma, a empresa ajusta, e a obra ou a pessoa sobrepõe quando precisa (seção 4).

## 3. O que entra no Settings

| Seção | O que tem | Quem usa |
| --- | --- | --- |
| **Empresa** | Razão social, logo, endereço, **estado(s) onde opera**, fuso horário, moeda, idioma, **início da semana de pagamento**, formato de data | Todos (PDF, CSV, cálculos) |
| **Usuários e permissões** | Usuários, papéis e permissões por módulo (seção 5), convites, desativação | Plataforma |
| **Pessoas** (cadastro de funcionário) | Ver a seção 3.1 | Crew, Daily, Measure |
| **Obras** | Nome, cliente, endereço, **estado** (define a regra trabalhista), cerca (centro e raio), calendário de dias de trabalho, início e prazo, orçamento, responsável pelo RDO | Todos |
| **Cadastros (tabelas)** | **Funções** (com a classe de workers' comp), **etapas / cost codes** (com hierarquia), **equipes**, **equipamentos**, **feriados**, **clientes**, **tipos de ocorrência** do RDO | Todos |
| **Regras de jornada** | Ver a seção 3.2 | Crew |
| **Encargos sobre a folha** | Itens (FICA, FUTA, SUTA, workers' comp, benefícios), com **vigência**, valendo **para todos os funcionários**, com exceção por função quando necessário | Crew (custos) |
| **Ponto e GPS** | Raio padrão da cerca, frequência dos registros de localização, retenção (ex.: 90 dias), foto obrigatória ou não, ponto pela equipe e/ou pessoal, texto do aviso de localização | Crew |
| **Diário de obra** | Horário-limite do RDO (18h), lembrete (16h), escalada para o escritório (8h), quantos dias para trás cobrar, quem aprova | Daily |
| **Custos e projeção** | Faixa de "Atenção" (ex.: até 5% acima), janela do ritmo (ex.: 4 semanas), método de projeção, rateio da hora extra (pelas horas ou pela obra que causou) | Crew |
| **Notificações** | Quais alertas ficam ligados, para quem e em que horário | Todos |
| **Integrações** (futuro) | QuickBooks, Gusto, ADP, contabilidade | Crew |
| **Auditoria** | Histórico de todas as mudanças de configuração | Administrador |

### 3.1 Cadastro de funcionário (vai bem além do valor hora)

**Funcionário não é usuário.** A maioria dos trabalhadores não tem login, e o encarregado bate o ponto por eles. Quando a pessoa tem login, os dois cadastros ficam ligados.

| Grupo | Campos | Por quê |
| --- | --- | --- |
| Identificação | Nome, apelido, foto, código interno (employee ID), telefone, contato de emergência | A foto ajuda o encarregado a confirmar quem é no ponto da equipe |
| Contrato | **Classificação W-2 (empregado) ou 1099 (autônomo)**, **FLSA não isento ou isento**, admissão, desligamento, situação (ativo, afastado, desligado) | Autônomo (1099) não tem hora extra nem encargos. Classificar errado é risco legal sério nos EUA |
| Trabalho | Função (e a **classe de workers' comp** dela), equipe, obra base, encarregado | Custo correto e equipe do RDO |
| Remuneração | **Valor hora com histórico e vigência** (já existe), exceções por obra (prevailing wage, fase 2) | Folha e custo |
| Qualificações | Certificações com validade (OSHA 10/30, licença de eletricista, operador de máquina), com aviso de vencimento | Segurança e exigência do cliente da obra |
| Privacidade | Aceite do aviso de localização (data e versão do texto) | Leis estaduais de monitoramento |
| Documentos | **Não guardar SSN nem documentos de imigração.** Isso fica no sistema de folha; aqui fica só o ID para o cruzamento | Menos risco de vazamento de dado sensível |

### 3.2 Regras de jornada (o "não é hardcode" mais importante)

**Decisão: a regra não fica amarrada a um estado.** A empresa tem uma **regra de jornada** com nome e números (hora extra semanal, hora extra diária opcional, hora dobrada, intervalo), com **vigência**. Os modelos só servem para preencher o formulário. Padrão do protótipo: **New Hampshire**, que segue a FLSA federal (acima de 40 h na semana: 1,5×; sem hora extra diária) e exige 30 min de intervalo depois de 5 h seguidas (RSA 275:30-a).

Nos EUA, vale a regra **do estado onde o trabalho foi feito**. Por isso, a próxima etapa é permitir uma regra diferente **por obra**, para quem trabalha em mais de um estado. Referência de como as regras variam:

| Parâmetro | EUA – federal (FLSA) | Califórnia (exemplo) |
| --- | --- | --- |
| Hora extra semanal | > 40 h → 1,5× | > 40 h → 1,5× |
| Hora extra diária | — | > 8 h → 1,5×; > 12 h → 2× |
| 7º dia seguido | — | 1,5× nas primeiras 8 h; 2× depois |
| Intervalo de refeição | Não exigido | 30 min antes do fim da 5ª hora |
| Arredondamento | Permitido se neutro | Restrito |

Modelos no protótipo: **"New Hampshire (FLSA federal)"** e **"Com hora extra diária (ex.: Califórnia)"**. A empresa escolhe um modelo, ajusta o que precisar (acordo sindical, política interna) e salva com data e motivo. Os modelos não substituem o contador ou o advogado trabalhista.

## 4. Níveis de configuração (herança)

```
Plataforma (padrões e modelos por estado, mantidos pelo KORbuild)
  └─ Empresa (ajusta para o seu jeito)
       └─ Obra (exceções: estado, raio da cerca, calendário, prevailing wage)
            └─ Pessoa (exceções: valor hora, função, equipe)
```

Exemplos:
- **Raio da cerca:** empresa = 150 m; Galpão (terreno grande) = 300 m.
- **Regra de jornada:** empresa = Federal; obra em Los Angeles = Califórnia.
- **Encargos:** empresa = 32%; funções de maior risco (ex.: montador de estrutura) têm workers' comp maior.

A tela sempre mostra **de onde vem o valor** ("padrão da empresa" ou "definido nesta obra"), para ninguém se perder.

## 5. Permissões (construído)

**Decisão:** nada fixo no código. O produto define o **catálogo de permissões** (o que existe para liberar). A empresa define os **perfis de acesso** (quais permissões cada perfil tem) e **quem tem qual perfil**, em **Settings › Perfis** e **Settings › Usuários**. Toda mudança vai para a auditoria.

### 5.1 Catálogo de permissões

| Grupo | Permissão | O que libera |
| --- | --- | --- |
| Crew · ponto | Bater o próprio ponto | Entrada, intervalo e saída no próprio celular (tela **Meu ponto**) |
| Crew · ponto | Bater o ponto da equipe | Encarregado: marca a equipe e vê as horas dela |
| Crew · escritório | Acompanhar ponto e timesheets | Agora, timesheets e mapa do dia |
| Crew · escritório | Aprovar e ajustar timesheets | Aprovar, devolver, ajustar e exportar CSV (inclui "acompanhar") |
| Crew · escritório | **Ver custos e valores em dinheiro** | Custos das obras, orçamento, salários nos timesheets (inclui "acompanhar") |
| Daily | Preencher o diário de obra | Criar e enviar o RDO |
| Daily | Acompanhar todas as obras | Painel, obras e relatórios enviados |
| Daily | Aprovar RDO e enviar ao contratante | Aprovar, pedir ajuste, PDF e link do contratante (inclui "acompanhar") |
| Settings | Cadastro de funcionários | Dados, certificações e valor hora |
| Settings | Encargos e regras de jornada | Versões com vigência |
| Settings | Usuários e perfis de acesso | Quem entra e o que cada perfil pode |
| Settings | Empresa, conta e plano | **Settings › Empresa** (logo, identificação, endereço, licenças e seguros, termos padrão da proposta), plano e módulos |
| Settings | Contatos | **Settings › Contatos**: construtoras, clientes e fornecedores num diretório só, com marcadores (ver [`saas.md` §Atores](saas.md)) |

"Ver valores em dinheiro" é separada de propósito: um engenheiro pode aprovar horas sem ver o salário de cada um.

### 5.2 Perfis que já vêm prontos (editáveis, menos o Administrador)

| Perfil | Permissões | Ao entrar |
| --- | --- | --- |
| **Trabalhador** | Bater o próprio ponto | **Direto no "Meu ponto", sem a tela de módulos** e sem menu |
| **Encarregado** | Próprio ponto, ponto da equipe, preencher o RDO | Tela de módulos (Daily e Crew) |
| **Gestor de obras** | Acompanhar e aprovar no Crew e no Daily, ver custos | Tela de módulos (Daily e Crew), sem o Settings |
| **Administrador** | Tudo do escritório, inclusive o Settings | Tela de módulos (Daily, Crew e Settings) |

Exemplos:
- **"Trabalhador que também faz o RDO":** marque "Preencher o diário de obra" no perfil, ou crie um perfil novo a partir do Trabalhador. Ele passa a ver a tela de módulos com Daily e Crew.
- **"Encarregado com aprovação":** crie um perfil a partir do Encarregado e marque "Aprovar e ajustar timesheets".

### 5.3 Regras
1. **A tela inicial sai das permissões.** Com um módulo só, a pessoa entra direto nele, sem tela de módulos nem botão de módulos. A matriz mostra para onde cada perfil vai ("Ao entrar").
2. **Administrador é fixo:** a empresa nunca fica sem quem gerencie os acessos. Também é preciso sobrar pelo menos um usuário ativo com "Usuários e perfis de acesso", e ninguém desativa o próprio acesso.
3. **Dependências automáticas:** aprovar inclui acompanhar; ver custos inclui acompanhar.
4. **Quem bate o próprio ponto precisa estar ligado ao cadastro de funcionário.** Usuário é quem tem login; funcionário é quem trabalha na obra. O trabalhador que só tem o ponto batido pelo encarregado não precisa de login.
5. **Perfil em uso não pode ser excluído:** primeiro, troque o perfil dos usuários.
6. **Sem permissão, a tela não abre:** o endereço digitado leva de volta à tela inicial da pessoa.

**Próximos passos:** permissão por obra (ex.: encarregado só vê as obras dele, gestor só a sua regional) e convite por e-mail de verdade.

## 6. Inventário: o que hoje está fixo no código

| Hoje (arquivo) | Valor fixo | Vai para |
| --- | --- | --- |
| `crew.js` `REGRAS` | 40 h/semana, 1,5×, intervalo de 30 min após 5 h | Settings › Regras de jornada (por modelo de estado, ligado à obra) |
| `crew.js` `RAIO_CERCA` | 150 m | Settings › Ponto e GPS (padrão) + exceção na obra |
| `crew.js` `ETAPAS` | Fundação… Limpeza e apoio | Settings › Cadastros › Etapas / cost codes |
| `crew.js` `ENCARGOS_PADRAO` | FICA 7,65; desemprego 3,4; WC 14; benefícios 7 | Settings › Encargos (com vigência) |
| `crew.js` `resumoDaObra` | Atenção até 5%; ritmo de 4 semanas | Settings › Custos e projeção |
| `crew-telas.js` `REGISTRO_GPS_MIN` | 15 min (5 min em deslocamento) | Settings › Ponto e GPS |
| `prazos.js` | RDO até 18h, lembrete 16h, escalada 8h, 3 dias para trás, seg–sáb | Settings › Diário de obra (padrão) + calendário da obra |
| `app.js` `FUNCOES`, `EQUIPAMENTOS` | Listas do RDO | Settings › Cadastros (as mesmas do Crew) |
| `relatorio.js` `TIPOS_OCORRENCIA`, `SITUACOES` | Listas do RDO | Settings › Cadastros |
| `plataforma.js` `PAPEIS` | Administrador e Campo | Settings › Usuários e permissões |
| `exemplo.js` `CONSTRUTORA` | Nome, sigla | Settings › Empresa |
| `util.js` formatação | US$, data dd/mm | Settings › Empresa (moeda, idioma, formato) |

**Ficam no código, por decisão de produto:** batida imutável, ajuste como nova batida, auditoria obrigatória, isolamento entre empresas e o princípio "a cerca sinaliza, não bloqueia".

## 7. Construção, em fases

**Já construído no protótipo (etapa 1):** itens 1, 3, 4, 5 (sem regra por obra) e 10 abaixo.
- **Settings** na tela de módulos, só para o escritório (administrador); o campo não vê nem abre.
- **Funcionários:**
  - cadastro completo: código, contato, W-2/1099, FLSA, função, equipe, admissão e desligamento, situação, aviso de localização;
  - certificações com aviso 30 dias antes de vencer, no menu e no sininho;
  - valor hora com histórico.
- **Encargos com vigência:** nova versão "a partir de", nunca no passado. A semana passada não muda.
- **Regras de jornada com vigência:** hora extra semanal, diária opcional e dobrada, e intervalo, lidas pelo ponto, pelos timesheets e pelos custos.
- **Auditoria:** cada mudança com antes, depois, quem, quando e motivo.

**Fase A: o que falta**
1. Bloco **Settings** na tela de módulos (incluído em todo plano, sem cobrança), visível só para quem tem permissão.
2. **Empresa:** dados, estado, fuso, semana de pagamento, moeda e formato.
3. **Pessoas:** cadastro completo de funcionário (3.1). ✓
4. **Encargos com vigência**, para todos os funcionários (corrige o achado do item 2.3). ✓
5. **Regras de jornada** editáveis, com modelos. ✓ Falta: regra por obra.
6. **Ponto e GPS**, **Diário de obra** e **Custos e projeção**: os parâmetros do inventário, lidos pelos módulos em vez das constantes.
7. **Cadastros:** funções, etapas, equipes, equipamentos e feriados.
8. **Obras:** cadastro e edição (hoje elas só existem nos dados de exemplo).
9. **Usuários e permissões:** papéis prontos e a matriz da seção 5, com "ver valores em dinheiro". ✓
10. **Auditoria:** lista das mudanças com antes e depois. ✓

**Fase B:** exceções por obra (prevailing wage, raio, calendário), workers' comp por classe de função, mais estados, integrações com a folha e configuração de notificações por usuário.

## 8. Decisões tomadas

| # | Pergunta | Decisão |
| --- | --- | --- |
| 1 | Nome | **Settings** |
| 2 | Cadastro de funcionário | Sai do Crew e vai para o Settings; o Crew só usa esse cadastro |
| 3 | Quem acessa | Quem tem as permissões do Settings no seu perfil (padrão: o Administrador). Perfis e permissões configuráveis (seção 5) |
| 6 | Trabalhador que só bate ponto | Entra direto no "Meu ponto", sem a tela de módulos |
| 4 | Estados | **Não amarrar a um estado.** Regra configurável, com modelos só para preencher. A empresa está em **New Hampshire** (padrão do protótipo) |
| 5 | Prioridade | Começar por Funcionários + Encargos + Regras de jornada (feito) |
