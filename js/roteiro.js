/* KORbuild — roteiros de teste no celular (teste-iphone.html, teste-android.html): mostra a senha de teste que vem no fim do link (#s=…),
 * para quem convida mandar um link só. A senha nunca fica no repositório nem no servidor: o que vem depois do # não é enviado a ninguém. */
const alvo = document.getElementById('senha-teste');
if (alvo) {
  const m = /[#&]s=([^&]{1,64})/.exec(location.hash);
  if (m) {
    let senha = '';
    try { senha = decodeURIComponent(m[1]); } catch { senha = m[1]; }
    alvo.textContent = senha;
    alvo.classList.add('com-senha');
    try { history.replaceState(null, '', location.pathname + location.search); } catch { /* sem histórico: segue */ }   // tira a senha da barra de endereço
  }
}
