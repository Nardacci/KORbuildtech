// KORbuild — o administrador cadastra a pessoa direto, com senha provisória (docs/telas-de-cadastro.md; migração 0026).
// Só esta função cria o login: precisa da chave de serviço, que nunca sai do servidor. QUEM PODE é o banco: preparar_usuario_direto e
// preparar_nova_senha rodam com o login de quem chamou e conferem a permissão (settings.acesso); finalizar_usuario_direto só o service_role executa.
// A senha provisória nasce em senha.ts, vai na resposta UMA vez para o administrador e não é gravada nem escrita no log; a pessoa é obrigada a
// trocá-la no primeiro acesso (user_metadata.trocar_senha, que a tela de entrada respeita). A lógica está em tratar.ts (testada no Node).
// Publicar (COM verificação de JWT, o padrão): supabase functions deploy criar-usuario --use-api
// Uso:  POST /functions/v1/criar-usuario   Authorization: Bearer <login do administrador>
//       {acao: 'criar', email, nome, cargo, telefone, perfil}   → { ok, senha, membro }
//       {acao: 'nova-senha', membro}                             → { ok, senha }

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { tratar } from './tratar.ts';

Deno.serve((req) => {
  const url = Deno.env.get('SUPABASE_URL')!;
  return tratar(req, {
    clienteDoChamador: (autorizacao) => createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: autorizacao } }, auth: { persistSession: false } }),
    servico: createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } }),
  });
});
