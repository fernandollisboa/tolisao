// @ts-check
// /mesa/?evento=<código>: as plaquinhas trocam o QR do site pelo do evento, e o nome dele entra no lugar do "quem me deve?".
// sem ?evento= (ou com código que não cabe no QR), fica a plaquinha genérica do HTML.
(() => {
  const code = (new URLSearchParams(location.search).get('evento') || '').trim().toLowerCase();
  if (!code) return;
  // o mesmo endereço do QR do evento no app (linkDoQr): a raiz do site, onde quer que ele esteja
  const svg = qrSvg(new URL('../', location.href).href + '?evento=' + encodeURIComponent(code));
  if (!svg) return;
  // o final sorteado ("churras-k7f3q9") é do link, não do nome que a turma reconhece
  const nome = code.replace(/-[a-z0-9]{6}$/, '');
  document.title = `tô lisa · ${nome}`;
  document.querySelectorAll('.placa').forEach((placa) => {
    placa.querySelector('.qr').outerHTML = svg.replace('<svg ', '<svg class="qr" ');
    placa.querySelector('.sub').textContent = nome;
  });
})();
