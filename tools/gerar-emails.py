#!/usr/bin/env python3
"""KORbuild — gera os modelos de e-mail do Auth (supabase/email/*.html) a partir de um layout só.

Cada e-mail sai nos dois idiomas num modelo só: o Supabase passa o user_metadata em .Data, e o app grava ali
o idioma da tela (js/conta.js). "pt" = português; outro valor, ou nenhum, = inglês.
Uso: python3 tools/gerar-emails.py   (depois, aplicar no Auth: supabase/email/README.md)
"""
from pathlib import Path

PASTA = Path(__file__).resolve().parent.parent / 'supabase' / 'email'

# Cores da identidade do app (css/app.css)
GRAFITE, MARCA, PRIMARIO, PRIMARIO_ESCURO = '#141B26', '#F26A1B', '#C2410C', '#9A3412'
TEXTO, TEXTO_2, MUDO, CLARO, BORDA, FUNDO, SUPERFICIE_2 = '#101828', '#344054', '#5D6B82', '#98A2B3', '#E4E7EC', '#F5F6F8', '#F9FAFB'

PT = '{{ $pt := false }}{{ with .Data.idioma }}{{ if eq . "pt" }}{{ $pt = true }}{{ end }}{{ end }}'
ASSUNTO = '{{{{ if eq (or .Data.idioma "en") "pt" }}}}{pt}{{{{ else }}}}{en}{{{{ end }}}}'


def b(pt, en):
    """Texto bilíngue dentro do modelo."""
    return '{{ if $pt }}' + pt + '{{ else }}' + en + '{{ end }}'


def passos(itens):
    linhas = []
    for i, (pt, en) in enumerate(itens, 1):
        ultimo = i == len(itens)
        pad = '' if ultimo else 'padding-bottom:12px; '
        linhas.append(
            f'''                    <tr>
                      <td style="{pad}vertical-align:top; width:24px; font-size:14px; color:{PRIMARIO}; font-weight:700;">{i}.</td>
                      <td style="{pad}font-size:14px; line-height:21px; color:{TEXTO_2};">
                        {b(pt, en)}
                      </td>
                    </tr>''')
    return '\n'.join(linhas)


def email(e):
    paragrafos = '\n'.join(
        f'''            <p style="margin:0 0 {28 if i == len(e['paragrafos']) - 1 else 16}px 0; font-size:15px; line-height:24px; color:{TEXTO_2};">
              {b(pt, en)}
            </p>''' for i, (pt, en) in enumerate(e['paragrafos']))
    return f'''{{{{/*
  KORbuild — {e['descricao']} (Supabase Auth → {e['campo_painel']}).
  Gerado por tools/gerar-emails.py: edite lá, não aqui. Um modelo só, nos dois idiomas (user_metadata.idioma).
*/}}}}{PT}<!DOCTYPE html>
<html lang="{b('pt-BR', 'en')}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{b(*e['assunto'])}</title>
</head>
<body style="margin:0; padding:0; background-color:{FUNDO}; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

<div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">
  {b(*e['previa'])}
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:{FUNDO}; padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; background-color:#FFFFFF; border-radius:12px; overflow:hidden; border:1px solid {BORDA};">

        <!-- Cabeçalho: a marca do app (símbolo K laranja + KORbuild) no grafite -->
        <tr>
          <td style="padding:26px 40px; text-align:center; background-color:{GRAFITE};">
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr>
                <td style="width:34px; height:34px; background-color:{MARCA}; border-radius:4px 10px 4px 4px; text-align:center; vertical-align:middle; font-size:20px; font-weight:800; color:#FFFFFF; line-height:34px;">K</td>
                <td style="padding-left:10px; vertical-align:middle; font-size:22px; line-height:1; color:#FFFFFF; letter-spacing:-0.01em;">
                  <strong style="font-weight:800;">KOR</strong><span style="font-weight:400;">build</span>
                </td>
              </tr>
            </table>
            <p style="margin:10px 0 0 0; font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color:{CLARO};">
              {b('Plataforma de operação das equipes', 'Team operations platform')}
            </p>
          </td>
        </tr>

        <!-- Corpo -->
        <tr>
          <td style="padding:36px 40px 8px 40px;">
            <h1 style="margin:0 0 16px 0; font-size:22px; line-height:30px; color:{TEXTO}; font-weight:700;">
              {b(*e['titulo'])}
            </h1>
{paragrafos}

            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 32px 0;">
              <tr>
                <td style="border-radius:8px; background-color:{PRIMARIO};">
                  <a href="{{{{ .ConfirmationURL }}}}" style="display:inline-block; padding:14px 32px; font-size:15px; font-weight:600; color:#FFFFFF; text-decoration:none; border-radius:8px;">
                    {b(*e['botao'])}
                  </a>
                </td>
              </tr>
            </table>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:{SUPERFICIE_2}; border:1px solid {BORDA}; border-radius:10px; margin-bottom:8px;">
              <tr>
                <td style="padding:22px 24px;">
                  <p style="margin:0 0 14px 0; font-size:13px; font-weight:700; color:{PRIMARIO_ESCURO}; text-transform:uppercase; letter-spacing:0.04em;">
                    {b(*e['caixa'])}
                  </p>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
{passos(e['passos'])}
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Aviso de segurança -->
        <tr>
          <td style="padding:8px 40px 32px 40px;">
            <p style="margin:0; font-size:13px; line-height:20px; color:{MUDO};">
              {b(*e['seguranca'])}
            </p>
          </td>
        </tr>

        <!-- Rodapé -->
        <tr>
          <td style="padding:24px 40px; background-color:{SUPERFICIE_2}; border-top:1px solid {BORDA}; text-align:center;">
            <p style="margin:0 0 4px 0; font-size:12px; color:{CLARO};">
              {b(*e['rodape'])}
            </p>
            <p style="margin:0; font-size:12px; color:{CLARO};">
              KORbuild · Build better teams. Run better operations.
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>
'''


EMAILS = [
    {
        'arquivo': 'confirmacao.html', 'descricao': 'e-mail de confirmação de cadastro', 'campo_painel': 'Confirm signup',
        'campo': 'mailer_templates_confirmation_content', 'campo_assunto': 'mailer_subjects_confirmation',
        'assunto': ('Confirme sua conta no KORbuild', 'Confirm your KORbuild account'),
        'previa': ('Falta só um passo para colocar a sua empresa no KORbuild.', 'One more step to bring your company into KORbuild.'),
        'titulo': ('Bem-vindo(a): falta só um passo', 'Welcome, just one more step'),
        'paragrafos': [
            ('Que bom ter você por aqui. O KORbuild coloca a operação das suas obras num lugar só: o <strong>Daily</strong> com os diários de obra, o <strong>Crew</strong> com o ponto das equipes, o <strong>Measure</strong> com as medições nas plantas, o cronograma e as concorrências, do escritório ao canteiro, no celular e no computador.',
             'Glad to have you here. KORbuild brings your jobsite operations into one place: <strong>Daily</strong> for daily reports, <strong>Crew</strong> for crew time, <strong>Measure</strong> for quantities from your plans, plus the schedule and bids, from the office to the field, on phone and desktop.'),
            ('Antes de começar, confirme o seu e-mail. É rápido e garante que só você tenha acesso à sua conta.',
             'Before you start, confirm your email. It only takes a second and makes sure only you can access your account.'),
        ],
        'botao': ('Confirmar meu e-mail →', 'Confirm my email →'),
        'caixa': ('O que vem depois', 'What comes next'),
        'passos': [
            ('Confirme o seu e-mail e entre no KORbuild.', 'Confirm your email and sign in to KORbuild.'),
            ('Cadastre a sua empresa: você entra como Administrador.', "Set up your company. You'll be its Administrator."),
            ('Convide a sua equipe e escolha o que cada pessoa pode ver e fazer.', 'Invite your team and choose what each person can see and do.'),
        ],
        'seguranca': ('O link vale por 1 hora. Se você não criou uma conta no KORbuild, pode ignorar este e-mail com segurança: nada será feito.',
                      "The link is valid for 1 hour. If you didn't create a KORbuild account, you can safely ignore this email. Nothing will happen."),
        'rodape': ('Você recebeu este e-mail porque criou uma conta no <strong>KORbuild</strong>.',
                   'You received this email because you created a <strong>KORbuild</strong> account.'),
    },
    {
        'arquivo': 'recuperar-senha.html', 'descricao': 'e-mail de nova senha', 'campo_painel': 'Reset password',
        'campo': 'mailer_templates_recovery_content', 'campo_assunto': 'mailer_subjects_recovery',
        'assunto': ('Crie uma nova senha no KORbuild', 'Reset your KORbuild password'),
        'previa': ('Recebemos um pedido para trocar a senha da sua conta.', 'We received a request to reset your password.'),
        'titulo': ('Crie uma nova senha', 'Reset your password'),
        'paragrafos': [
            ('Recebemos um pedido para trocar a senha da sua conta no KORbuild (<strong>{{ .Email }}</strong>).',
             'We received a request to reset the password for your KORbuild account (<strong>{{ .Email }}</strong>).'),
            ('Clique no botão para escolher uma senha nova, com pelo menos 8 caracteres. Depois, você já entra com ela.',
             "Click the button to choose a new password with at least 8 characters. You'll be signed in right after."),
        ],
        'botao': ('Criar nova senha →', 'Choose a new password →'),
        'caixa': ('Para manter a conta segura', 'Keep your account safe'),
        'passos': [
            ('Use uma senha que você não usa em outros sites.', "Use a password you don't use on other sites."),
            ('Não compartilhe a sua senha: cada pessoa da equipe tem o próprio acesso.', "Don't share your password. Everyone on your team gets their own access."),
            ('Precisa dar acesso a alguém? O Administrador da empresa envia um convite.', 'Need to give someone access? Your company Administrator can send an invite.'),
        ],
        'seguranca': ('O link vale por 1 hora. Se você não pediu a troca, ignore este e-mail: a sua senha continua a mesma.',
                      "The link is valid for 1 hour. If you didn't ask for this, ignore this email. Your password stays the same."),
        'rodape': ('Você recebeu este e-mail porque foi pedida uma nova senha para a sua conta no <strong>KORbuild</strong>.',
                   'You received this email because a new password was requested for your <strong>KORbuild</strong> account.'),
    },
    {
        'arquivo': 'troca-de-email.html', 'descricao': 'e-mail de troca de e-mail', 'campo_painel': 'Change email address',
        'campo': 'mailer_templates_email_change_content', 'campo_assunto': 'mailer_subjects_email_change',
        'assunto': ('Confirme o seu novo e-mail no KORbuild', 'Confirm your new KORbuild email'),
        'previa': ('Confirme o novo e-mail para entrar no KORbuild.', 'Confirm the new email you will use to sign in to KORbuild.'),
        'titulo': ('Confirme o seu novo e-mail', 'Confirm your new email'),
        'paragrafos': [
            ('Você pediu para trocar o e-mail de acesso ao KORbuild de <strong>{{ .Email }}</strong> para <strong>{{ .NewEmail }}</strong>.',
             'You asked to change the email you use to sign in to KORbuild from <strong>{{ .Email }}</strong> to <strong>{{ .NewEmail }}</strong>.'),
            ('Confirme para concluir. A sua empresa, o seu perfil de acesso e o seu histórico continuam os mesmos.',
             'Confirm to finish. Your company, your access profile and your history stay the same.'),
        ],
        'botao': ('Confirmar novo e-mail →', 'Confirm new email →'),
        'caixa': ('O que muda', 'What changes'),
        'passos': [
            ('Você passa a entrar com <strong>{{ .NewEmail }}</strong>, com a mesma senha.', 'You sign in with <strong>{{ .NewEmail }}</strong>, using the same password.'),
            ('Os avisos do KORbuild passam a chegar no novo e-mail.', 'KORbuild notifications go to the new email.'),
            ('Nada muda na sua empresa, no seu perfil de acesso ou nos seus registros.', 'Nothing changes in your company, your access profile or your records.'),
        ],
        'seguranca': ('O link vale por 1 hora. Se você não pediu essa troca, ignore este e-mail e avise o Administrador da sua empresa.',
                      "The link is valid for 1 hour. If you didn't ask for this change, ignore this email and let your company Administrator know."),
        'rodape': ('Você recebeu este e-mail porque foi pedida uma troca de e-mail na sua conta do <strong>KORbuild</strong>.',
                   'You received this email because an email change was requested for your <strong>KORbuild</strong> account.'),
    },
]


def assunto(e):
    return ASSUNTO.format(pt=e['assunto'][0], en=e['assunto'][1])


if __name__ == '__main__':
    for e in EMAILS:
        (PASTA / e['arquivo']).write_text(email(e), encoding='utf-8')
        print(e['arquivo'], '·', e['campo_assunto'], '=', assunto(e))
