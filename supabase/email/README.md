# Modelos de e-mail do Auth (Supabase)

Gerados por `tools/gerar-emails.py` (um layout só, com a marca do app): edite lá e rode `python3 tools/gerar-emails.py`.
Aplicados pela API de gerenciamento (PATCH /v1/projects/{ref}/config/auth).

**Idioma:** cada modelo tem os dois idiomas. O Supabase passa o `user_metadata` em `.Data`, e o app grava ali o idioma da
tela (`idioma`): no cadastro, ao entrar e ao trocar PT|EN (`js/conta.js`). "pt" = português; outro valor, ou nenhum, = inglês.

| Arquivo | Campo do modelo | Campo do assunto | Assunto (PT / EN) |
|---|---|---|---|
| `confirmacao.html` | `mailer_templates_confirmation_content` | `mailer_subjects_confirmation` | Confirme sua conta no KORbuild / Confirm your KORbuild account |
| `recuperar-senha.html` | `mailer_templates_recovery_content` | `mailer_subjects_recovery` | Crie uma nova senha no KORbuild / Reset your KORbuild password |
| `troca-de-email.html` | `mailer_templates_email_change_content` | `mailer_subjects_email_change` | Confirme o seu novo e-mail no KORbuild / Confirm your new KORbuild email |

O assunto vai como modelo também, por exemplo:
`{{ if eq (or .Data.idioma "en") "pt" }}Confirme sua conta no KORbuild{{ else }}Confirm your KORbuild account{{ end }}`
(`python3 tools/gerar-emails.py` imprime os três prontos).

O convite para entrar numa empresa não usa o convite do Supabase: é o `convidar_usuario()` do banco (o e-mail dele vem na fatia 8).
O remetente atual (SMTP próprio) é do sistema antigo; troca no lançamento, com o domínio do KORbuild.
