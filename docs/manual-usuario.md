# Manual do usuário (PDF, português e inglês)

O manual da 1ª versão (Takeoff, Daily e Settings) sai em dois PDFs, com as capturas de tela feitas por um percurso automatizado e o registro dessa conferência no último capítulo ("Evidências do teste").

## Onde está
- **Para o usuário:** depois do login, o menu da conta (as iniciais) tem **Manual do usuário (PDF)**; na barra simples do Settings (antes de o menu carregar) há o botão **Manual (PDF)**. O arquivo vem no idioma da tela. Os PDFs ficam em `manual/` e são servidos como arquivos comuns (o service worker não os guarda no cache do app).
- **Texto (fonte):** `manual-usuario/fonte/pt/*.md` e `manual-usuario/fonte/en/*.md`, um arquivo por capítulo, na mesma ordem e com as mesmas imagens. Mude as duas línguas juntas. Imagem: `![legenda](img:chave)`.
- **Capturas e conferência:** `manual-usuario/evidencias/<idioma>/*.png` e `manifesto.json` (cada captura, se passou, quando, versão e commit).

## Como regenerar
1. `python3 -m http.server 8123 &` e `bash tools/supabase-local.sh` (banco local).
2. `node tools/manual-capturas.mjs` (os dois idiomas; `--idioma=pt` ou `en` para um só). Cada captura só vale se a tela mostra o que o manual diz; o script sai com erro se alguma falhar.
3. Rode os fluxos `node tests/fluxo-01-empresa-nova.test.mjs --relatorio` (e F02, F03, F05): a última rodada de cada um entra no capítulo de evidências.
4. `node tools/gerar-manual.mjs` gera `manual/KORbuild_Manual_do_Usuario_pt.pdf` e `manual/KORbuild_User_Manual_en.pdf`.
5. Publique: os PDFs vão no mesmo commit do app. `node tools/gerar-producao.mjs` copia os dois para `producao/manual/`.

## Dados de exemplo
Empresa **Northfield Builders**, administrador Daniel Rivera, encarregado Eduardo Lima, cliente Hartwell Homes LLC, projeto Mitchell Garage Remodel (`tools/manual-capturas.mjs`). Nada toca o Supabase do projeto; a limpeza apaga tudo no fim.

## Quando refazer
Sempre que uma tela citada no manual mudar de aparência ou de texto, ou a cada versão que for ao parceiro. Se o script falhar numa captura, o manual não deve ser publicado: ou o sistema mudou, ou o texto do manual ficou desatualizado.
