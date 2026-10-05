# KORbuild nas lojas (App Store e Google Play)

Decidido em outubro de 2026. O app das lojas é o mesmo código web (PWA) embrulhado com o **Capacitor**: não há reescrita.

## Escopo da primeira versão
- **Daily**, **Crew** (ponto) e o **sininho**.
- **Measure só para consulta e envio** (projetos, quantidades, materiais, lista para cotação, proposta emitida). Desenhar e medir fica no computador. Ver [`measure.md` §3e](measure.md).

## Pré-requisitos (nesta ordem)
1. Banco de dados e login de verdade (a Apple testa com conta real; o iPhone pode apagar o armazenamento local do app).
2. Produto em inglês.
3. Ajustes nativos: câmera, localização, PDF (servidor ou "Compartilhar"), ditado por voz e fila offline com sincronização.
4. Exigências da Apple: excluir a conta pelo app, política de privacidade publicada, formulário de privacidade da loja, conta de demonstração para a revisão.
5. Assinatura vendida fora do app (pelo site); o app só faz login.

## Contas e compilação
- **Apple Developer Program como pessoa física** (US$ 99/ano). Na loja, o vendedor aparece com o nome da pessoa. Quando houver empresa, migrar para conta de organização (pede D-U-N-S); o app pode ser transferido sem perder avaliações nem usuários.
- **Sem Mac:** o app do iPhone é compilado e assinado na nuvem (Codemagic ou GitHub Actions com macOS), com os certificados criados pela API do App Store Connect. Testes no iPhone pelo **TestFlight**.
- **Google Play** (US$ 25, uma vez). Conta pessoal nova exige um teste fechado com pelo menos 12 testadores por 14 dias antes de publicar.
