# Padrão de telas e de comportamentos

**Regra de ouro:** a mesma coisa se faz do mesmo jeito em todo o sistema. Abrir uma tela e achar outro comportamento onde deveria ser o mesmo tira a confiança em tudo. Quem muda um padrão muda **todas** as telas que o usam, e o teste `tests/padrao-telas.test.mjs` acusa quando uma tela sai do desenho.

## 1. Os tipos de tela
| Tipo | Quando | Como é |
|---|---|---|
| **Lista** | Qualquer conjunto de registros (pessoas, perfis, contatos, funções, projetos, itens, assemblies, obras…) | Cabeçalho, barra de busca e filtros, grade em cartão, ação na linha |
| **Painel lateral** | Criar e editar um registro curto (até uns 12 campos) | `abrirPainel`: abre à direita, rodapé fixo |
| **Página de formulário** | Registro longo ou com áreas de trabalho (item e seus preços, assembly com linhas e fórmulas, projeto) | Cabeçalho, seções em cartão, rodapé do formulário |
| **Configuração de registro único** | Empresa, Meu perfil | Seções em cartão, cada uma com o seu rodapé de formulário |
| **Área de trabalho** | Desenho do Takeoff, Gantt, diário (RDO) | Feitas para a tarefa; seguem o cabeçalho e os avisos abaixo |

## 2. A lista (`js/padrao-cadastro.js`)
1. **Cabeçalho de página** (`cabecalhoDePagina` ou o título da `moldura`): título, uma linha de explicação e, à direita, o botão primário de criar ("Novo …"). O botão do alto tem **sempre o mesmo tamanho**, venha da tela que vier.
2. **Barra de busca e filtros** (`barraDeBusca`): a busca à esquerda; à direita os filtros, em **chips** (poucos valores, com a contagem) ou em **lista** (`filtroSelect`, muitos valores). Mais a contagem de resultados.
3. **Grade em cartão** (`gradeEmCartao`): primeira coluna é a identidade (avatar e nome; o nome abre o registro); última coluna é a **ação da linha**, um botão pequeno de contorno ("Editar", "Abrir", "Ver"). Ações rápidas (como "Novo preço") ficam na mesma célula.
4. **Busca e filtros só escondem linhas.** Uma regra só para todas as grades (`tr[data-linha]`, `data-texto`, `data-grupos`); valem desde que a tela abre (ex.: Itens abre só com os ativos).
5. **Nada encontrado:** a mesma mensagem, no lugar da grade.
6. Nenhuma tela de lista tem busca ou filtro que recarregue a página.

## 3. O painel lateral
Cabeçalho (título e subtítulo), corpo que rola, rodapé fixo: **Cancelar** e **Salvar** à direita, ação que apaga à esquerda. Erros aparecem no próprio painel e ele não fecha. Fecha com Cancelar, ×, Esc, clique fora ou mudança de endereço. Sem `<form>` dentro; os campos se leem com `lerCampos`. Botões com `data-acao` dentro do painel funcionam (despacho em `js/app.js`).

## 4. A página de formulário
Seções em cartão; no fim, o **rodapé do formulário** (`.rodape-form`): botões à direita, o primário por último. Cada seção independente (Empresa, Meu perfil) tem o seu rodapé.

## 5. Comportamentos
| Situação | Regra |
|---|---|
| **Rótulo do botão** | Criar: "Criar <coisa>" (Criar usuário, Criar perfil, Criar obra…). Editar: "Salvar". Nova versão com vigência (valor hora, encargos, regra): "Salvar nova versão". |
| **Cancelar** | Sempre existe e não grava nada. |
| **Sucesso** | Aviso neutro que some (`toast`). |
| **Erro de gravação ou de validação** | `avisarErro(mensagem)` (`js/util.js`): no painel, dentro do painel; na página com formulário, **acima dos botões**; fora disso, aviso vermelho. Some quando a pessoa volta a digitar. Nunca só um aviso que desaparece. |
| **Apagar, desativar, cancelar convite, remover do cronograma** | Sempre pede confirmação (`confirmar`), com o verbo explícito. O botão que apaga é `btn-perigo-contorno`, igual em painel e em página. |
| **Gravação automática** | Só no cronograma do projeto (tarefas e marcos), e a tela diz **"Salva na hora"**. Em toda outra tela, gravar é o botão Salvar. |
| **Idioma** | Todo texto passa por `tr()` e tem inglês em `js/i18n-en.js` (`node tools/i18n-faltando.mjs` lista o que falta). |

## 6. Exceções conhecidas
- **Daily › Projetos em execução** usa cartões, não grade: é a tela do campo, feita para o celular.
- **Cronograma do projeto** grava ao digitar (sinalizado).
- Telas das áreas ainda não liberadas (Crew, Concorrências) e o protótipo `?demo` (`js/settings-telas.js`, `js/obras-telas.js`) ainda têm o desenho antigo. Entram no padrão quando forem liberadas.
- O campo de data usa o formato do navegador do aparelho (pode diferir do idioma da tela). É do navegador.

## 7. Auditoria de 07/11/2026: o que estava diferente e o que foi feito
| Antes | Agora |
|---|---|
| Três jeitos de buscar e filtrar (Settings, Projetos recarregava a tela, Itens com código próprio) | Um motor só (`filtrarGrade`) |
| Cabeçalho de página de dois tipos, com botões de tamanhos diferentes (Settings 40 px, Takeoff 32 px) | Um cabeçalho (`.pg-cab`), botão do mesmo tamanho |
| Projetos com os chips acima da busca; Itens com quatro listas soltas | Busca à esquerda e filtros à direita, em todas |
| Linha da grade sem ação (Projetos) ou com ação diferente por tela; nomes sublinhados no Takeoff | Ação na última coluna e nome com o mesmo estilo |
| Perfis de acesso sem busca e sem filtro | Busca e chips por tipo |
| Erro de gravação: no painel (Settings), num aviso que some (Takeoff e o resto, 67 pontos) | `avisarErro`: onde a pessoa olha |
| Botão de apagar: vermelho cheio no painel, contorno cinza na página | `btn-perigo-contorno` em todo lugar |
| Remover tarefa e marco do cronograma e cancelar convite sem confirmar, apesar de gravarem na hora | Pedem confirmação |
| Empresa e Meu perfil: botão Salvar à esquerda | Rodapé padrão, à direita |
| Cronograma grava sozinho sem avisar | Etiqueta "Salva na hora" |
| "Cadastrar funcionário" no lugar de "Criar …" | "Criar funcionário" |

## 8. Manutenção: mudou aqui, mude em todo lugar
Qualquer mudança de tela, layout, processo ou regra atualiza **na mesma entrega** o protótipo, os documentos, o guia do portal, o manual do usuário (texto, capturas e PDFs) e os testes. A lista completa está em `CLAUDE.md` ("Regra de ouro"). Pendência que não coube na entrega vai para `docs/pendencias-de-padrao.md`.

## 9. Criar uma tela nova
Monte a lista com `cabecalhoDePagina`, `barraDeBusca`, `gradeEmCartao` e `atributosDeLinha`; abra a edição com `abrirPainel`; mostre erros com `avisarErro`; peça `confirmar` antes de apagar. Rode `node tests/padrao-telas.test.mjs`.
