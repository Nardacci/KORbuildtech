// KORbuild · configuração pública do Supabase. A chave anon/publishable é pública por desenho (a segurança está na RLS);
// a service_role NUNCA entra no repositório.
export const SUPABASE_URL = 'https://qudyyewfrtfimbytahkv.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_8rfN1dDFrqYRPTx9Uhl9Sg_tU3GMxYc';
// Versão do app (a mesma do CACHE em sw.js: tests/atualizacao.test.mjs confere). Aparece na tela de entrada, para saber se o aparelho já pegou a versão nova.
export const VERSAO_APP = 'v168';
