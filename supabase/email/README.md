# Modelos de e-mail do Auth (Supabase)

Aplicados pela API de gerenciamento (PATCH /v1/projects/{ref}/config/auth), em inglês (produto dos EUA):

| Arquivo | Campo do Auth | Assunto |
|---|---|---|
| `confirmacao.html` | `mailer_templates_confirmation_content` | `mailer_subjects_confirmation`: Confirm your KORbuild account |
| `recuperar-senha.html` | `mailer_templates_recovery_content` | `mailer_subjects_recovery`: Reset your KORbuild password |
| `troca-de-email.html` | `mailer_templates_email_change_content` | `mailer_subjects_email_change`: Confirm your new KORbuild email |

O convite para entrar numa empresa não usa o convite do Supabase: é o `convidar_usuario()` do banco (o e-mail dele vem na fatia 8).
O remetente atual (SMTP próprio) é do sistema antigo; troca no lançamento, com o domínio do KORbuild.
