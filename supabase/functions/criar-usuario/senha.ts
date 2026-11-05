// KORbuild — a senha provisória (função criar-usuario). 12 letras e números sem os que se confundem (0/O, 1/l/I), em três grupos de 4:
// "k7Pm-3rTz-Wn9d" (~69 bits). Sorteio uniforme com crypto.getRandomValues, sem viés; sempre com pelo menos uma maiúscula, uma minúscula e um número (repete o sorteio se faltar um tipo).
export const MAIUSCULAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ', MINUSCULAS = 'abcdefghijkmnpqrstuvwxyz', NUMEROS = '23456789';

function sorteia(alfabeto: string): string {
  const limite = 256 - (256 % alfabeto.length);   // descarta o resto da divisão: todos os símbolos com a mesma chance
  const b = new Uint8Array(1);
  do { crypto.getRandomValues(b); } while (b[0] >= limite);
  return alfabeto[b[0] % alfabeto.length];
}

export function novaSenha(): string {
  const todos = MAIUSCULAS + MINUSCULAS + NUMEROS;
  // sorteio uniforme dos 12 símbolos; se faltar um tipo (maiúscula, minúscula ou número), sorteia de novo (~16% das vezes): sem viés para os números
  for (;;) {
    const c: string[] = [];
    while (c.length < 12) c.push(sorteia(todos));
    const s = c.join('');
    if (/[A-Z]/.test(s) && /[a-z]/.test(s) && /[0-9]/.test(s)) return c.slice(0, 4).join('') + '-' + c.slice(4, 8).join('') + '-' + c.slice(8, 12).join('');
  }
}
