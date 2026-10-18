/* KORbuild — portal: busca, sumário ativo, voltar ao topo e menu no celular. */
(function () {
  var raiz = document.body.getAttribute('data-raiz') || '';

  /* ---------- Busca (índice gerado: search.json) ---------- */
  var campo = document.getElementById('busca');
  var caixa = document.getElementById('busca-resultados');
  var indice = null;
  function carregar() {
    if (indice) return Promise.resolve(indice);
    return fetch(raiz + 'search.json').then(function (r) { return r.json(); }).then(function (j) { indice = j; return j; });
  }
  function norm(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function marcar(texto, termos) {
    var t = esc(texto);
    termos.forEach(function (w) { if (w.length > 1) t = t.replace(new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>'); });
    return t;
  }
  function buscar() {
    var q = norm(campo.value.trim());
    if (q.length < 2) { caixa.hidden = true; return; }
    carregar().then(function (lista) {
      var termos = q.split(/\s+/);
      var achados = lista.map(function (e) {
        var alvo = norm(e.titulo + ' ' + e.pagina + ' ' + e.texto);
        if (!termos.every(function (w) { return alvo.indexOf(w) >= 0; })) return null;
        var pontos = termos.reduce(function (s, w) { return s + (norm(e.titulo).indexOf(w) >= 0 ? 3 : 0) + (norm(e.pagina).indexOf(w) >= 0 ? 1 : 0); }, 0);
        return { e: e, pontos: pontos };
      }).filter(Boolean).sort(function (a, b) { return b.pontos - a.pontos; }).slice(0, 12);
      var palavras = campo.value.trim().split(/\s+/);
      caixa.innerHTML = achados.length ? achados.map(function (a) {
        var i = norm(a.e.texto).indexOf(termos[0]);
        var trecho = a.e.texto.slice(Math.max(0, i - 50), i + 110);
        return '<a href="' + raiz + a.e.url + '"><b>' + marcar(a.e.titulo, palavras) + '</b><span>' + esc(a.e.pagina) + ' · ' + marcar(trecho, palavras) + '…</span></a>';
      }).join('') : '<div class="busca-vazio">No results for “' + esc(campo.value) + '”.</div>';
      caixa.hidden = false;
    });
  }
  if (campo) {
    campo.addEventListener('input', buscar);
    campo.addEventListener('focus', function () { carregar(); if (campo.value) buscar(); });
    campo.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') { caixa.hidden = true; campo.blur(); }
      if (ev.key === 'Enter') { var a = caixa.querySelector('a'); if (a) location.href = a.href; }
    });
    document.addEventListener('click', function (ev) { if (!ev.target.closest('.busca') && !ev.target.closest('#busca-resultados')) caixa.hidden = true; });
    document.addEventListener('keydown', function (ev) { if (ev.key === '/' && document.activeElement !== campo) { ev.preventDefault(); campo.focus(); } });
  }

  /* ---------- Sumário: marca a seção visível ---------- */
  var links = Array.prototype.slice.call(document.querySelectorAll('.toc a'));
  if (links.length && 'IntersectionObserver' in window) {
    var alvos = links.map(function (a) { return document.getElementById(decodeURIComponent(a.hash.slice(1))); }).filter(Boolean);
    var obs = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (a) { a.classList.toggle('ativo', a.hash === '#' + en.target.id); });
      });
    }, { rootMargin: '-80px 0px -70% 0px' });
    alvos.forEach(function (h) { obs.observe(h); });
  }

  /* ---------- Voltar ao topo ---------- */
  var topo = document.querySelector('.voltar-topo');
  if (topo) {
    window.addEventListener('scroll', function () { topo.classList.toggle('visivel', window.scrollY > 600); }, { passive: true });
    topo.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
  }

  /* ---------- Celular: menu do módulo e busca ---------- */
  var menu = document.querySelector('.menu-celular');
  if (menu) menu.addEventListener('click', function () {
    if (document.querySelector('.lateral')) { document.body.classList.toggle('lateral-aberta'); window.scrollTo({ top: 0 }); }
    document.querySelector('.topo').classList.toggle('busca-aberta');
    if (campo && document.querySelector('.topo').classList.contains('busca-aberta')) campo.focus();
  });
})();
