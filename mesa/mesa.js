// @ts-check
// /mesa/?evento=<código>: as plaquinhas trocam o QR do site pelo do evento, e o nome dele entra no lugar do "quem me deve?".
// sem ?evento= (ou com código que não cabe no QR), fica a plaquinha genérica do HTML.
(() => {
  const code = (new URLSearchParams(location.search).get('evento') || '').trim().toLowerCase();
  if (!code) return;
  // o mesmo endereço do QR do evento no app (linkDoQr): a raiz do site, onde quer que ele esteja
  const svg = qrSvg(new URL('../', location.href).href + '?evento=' + encodeURIComponent(code));
  if (!svg) return;
  // o nome vem no &nome= (o código sorteado não diz nada); os eventos de antes ainda têm ele no começo ("churras-k7f3q9")
  const velho = /-[a-z0-9]{6}$/.test(code) ? code.replace(/-[a-z0-9]{6}$/, '') : '';
  const nome = (new URLSearchParams(location.search).get('nome') || '').trim().slice(0, 40) || velho;
  if (nome) document.title = `tô lisa · ${nome}`;
  document.querySelectorAll('.placa').forEach((placa) => {
    placa.querySelector('.qr').outerHTML = svg.replace('<svg ', '<svg class="qr" ');
    if (nome) placa.querySelector('.sub').textContent = nome;
  });
})();
