// @ts-check
// o QR do tô lisa, num arquivo só porque duas páginas desenham: o app (index.html) e a plaquinha de mesa (mesa/).
// script comum, sem módulo: qrMatriz e qrSvg ficam globais pra quem carregar depois.
// ---------- QR (modo byte, correção M, versões 1 a 6) ----------
// escrito à mão como o code128Widths e o crc16 do app.js: sai uma matriz de sim/não, e quem desenha
// é a página (qrSvg) ou a comanda (fillRect). A versão 6 leva 106 bytes, o bastante pro link
// do evento. O copia e cola do pix (~150 bytes) vai pedir as versões 7 a 9: bits de versão,
// alinhamento em grade e blocos de tamanhos diferentes.
// [blocos, bytes de dados por bloco, bytes de correção por bloco], da versão 1 à 6, correção M
const QR_BLOCOS = [
  [1, 16, 10],
  [1, 28, 16],
  [1, 44, 26],
  [2, 32, 18],
  [2, 43, 24],
  [4, 27, 16],
];
/** a matriz do QR, linha a linha (true é módulo preto), sem a borda branca; null se o texto passa de 106 bytes
 * @param {string} texto @returns {boolean[][] | null} */
function qrMatriz(texto) {
  const bytes = [...new TextEncoder().encode(texto)];
  const v = QR_BLOCOS.findIndex(([b, d]) => 12 + 8 * bytes.length <= b * d * 8) + 1;
  if (!v) return null;
  const [nb, nd, ne] = QR_BLOCOS[v - 1],
    cabe = nb * nd * 8;
  // modo byte (0100), o tamanho em 8 bits, os bytes, até 4 zeros de fim e o byte completado com zero
  let bits = '0100' + [bytes.length, ...bytes].map((b) => b.toString(2).padStart(8, '0')).join('');
  bits += '0000'.slice(0, cabe - bits.length);
  bits += '0'.repeat((8 - (bits.length % 8)) % 8);
  const dados = bits.match(/.{8}/g).map((b) => parseInt(b, 2));
  for (let i = 0; dados.length < nb * nd; i++) dados.push(i % 2 ? 0x11 : 0xec); // enchimento: 0xEC, 0x11, 0xEC…
  // Reed-Solomon no corpo de 256 do QR (x⁸+x⁴+x³+x²+1); o gerador é (x-α⁰)…(x-α^(ne-1))
  const exp = [],
    log = [];
  for (let i = 0, x = 1; i < 255; i++, x = (x << 1) ^ (x & 0x80 ? 0x11d : 0)) {
    exp[i] = x;
    log[x] = i;
  }
  const vezes = (a, b) => (a && b ? exp[(log[a] + log[b]) % 255] : 0);
  let gerador = [1];
  for (let i = 0; i < ne; i++) gerador = [...gerador, 0].map((c, j) => c ^ (j ? vezes(gerador[j - 1], exp[i]) : 0));
  const blocos = [...Array(nb)].map((_, i) => dados.slice(i * nd, (i + 1) * nd));
  const correcoes = blocos.map((bloco) => {
    const resto = Array(ne).fill(0);
    for (const b of bloco) {
      const f = b ^ /** @type {number} */ (resto.shift());
      resto.push(0);
      for (let i = 0; i < ne; i++) resto[i] ^= vezes(gerador[i + 1], f);
    }
    return resto;
  });
  // os blocos se intercalam byte a byte: primeiro os dados, depois a correção
  const palavras = [];
  for (let i = 0; i < nd; i++) for (const b of blocos) palavras.push(b[i]);
  for (let i = 0; i < ne; i++) for (const c of correcoes) palavras.push(c[i]);

  const n = 17 + 4 * v;
  const m = [...Array(n)].map(() => Array(n).fill(false)),
    fixo = [...Array(n)].map(() => Array(n).fill(false));
  const poe = (x, y, preto) => {
    m[y][x] = preto;
    fixo[y][x] = true;
  };
  // os três quadrados dos cantos, já com a faixa branca em volta
  for (const [cx, cy] of [
    [3, 3],
    [n - 4, 3],
    [3, n - 4],
  ])
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        if (cx + dx >= 0 && cx + dx < n && cy + dy >= 0 && cy + dy < n) poe(cx + dx, cy + dy, d !== 2 && d !== 4);
      }
  // o pontilhado entre os cantos, o quadradinho de alinhamento (um só até a versão 6) e o módulo preto fixo
  for (let i = 8; i < n - 8; i++) {
    poe(i, 6, i % 2 === 0);
    poe(6, i, i % 2 === 0);
  }
  if (v > 1)
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) poe(n - 7 + dx, n - 7 + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  poe(8, n - 8, true);
  // o formato (correção e máscara) mora em volta dos cantos, em duas cópias
  /** @param {number} formato os 15 bits, já com o BCH e o xor */
  const poeFormato = (formato) => {
    const bit = (i) => ((formato >> i) & 1) === 1;
    for (let i = 0; i < 6; i++) poe(8, i, bit(i));
    poe(8, 7, bit(6));
    poe(8, 8, bit(7));
    poe(7, 8, bit(8));
    for (let i = 9; i < 15; i++) poe(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) poe(n - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) poe(8, n - 15 + i, bit(i));
  };
  poeFormato(0); // reserva o lugar antes dos dados
  // os dados sobem e descem em colunas de duas, da direita pra esquerda, pulando a coluna 6
  let k = 0;
  for (let dir = n - 1; dir >= 1; dir -= 2) {
    if (dir === 6) dir = 5;
    for (let i = 0; i < n; i++)
      for (const x of [dir, dir - 1]) {
        const y = (dir + 1) & 2 ? i : n - 1 - i;
        if (fixo[y][x]) continue;
        m[y][x] = k < palavras.length * 8 && ((palavras[k >> 3] >> (7 - (k & 7))) & 1) === 1;
        k++;
      }
  }
  // das 8 máscaras fica a que dá menos penalidade (blocos, faixas e falsos cantos que confundem o leitor)
  const MASCARAS = [
    (x, y) => (x + y) % 2 === 0,
    (x, y) => y % 2 === 0,
    (x) => x % 3 === 0,
    (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
    (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
  ];
  const dado = fixo.map((l) => [...l]),
    base = m.map((l) => [...l]);
  let melhor = null,
    menor = Infinity;
  MASCARAS.forEach((mascara, qual) => {
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) m[y][x] = dado[y][x] ? base[y][x] : base[y][x] !== mascara(x, y);
    // correção M é 00; os 10 bits de BCH saem do resto por 0x537
    let r = qual;
    for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >> 9) * 0x537);
    poeFormato(((qual << 10) | r) ^ 0x5412);
    const linhas = m.map((l) => l.map(Number).join('')),
      colunas = m.map((_, x) => m.map((l) => +l[x]).join(''));
    let pena = 0,
      pretos = 0;
    for (const s of [...linhas, ...colunas]) {
      for (const run of s.match(/0+|1+/g) || []) if (run.length >= 5) pena += run.length - 2;
      // a borda branca conta como claro: falso canto encostado na beira também confunde
      pena += 40 * (('0000' + s + '0000').match(/(?=10111010000|00001011101)/g) || []).length;
    }
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        pretos += +m[y][x];
        if (x && y && m[y][x] === m[y - 1][x] && m[y][x] === m[y][x - 1] && m[y][x] === m[y - 1][x - 1]) pena += 3;
      }
    pena += 10 * Math.floor(Math.abs((pretos * 100) / (n * n) - 50) / 5);
    if (pena < menor) [menor, melhor] = [pena, m.map((l) => [...l])];
  });
  return melhor;
}
/** o QR em SVG, com a borda branca de 4 módulos que o leitor precisa @param {string} texto */
const qrSvg = (texto) => {
  const m = qrMatriz(texto);
  if (!m) return '';
  let d = '';
  m.forEach((l, y) => l.forEach((preto, x) => preto && (d += `M${x} ${y}h1v1h-1z`)));
  const t = m.length + 8;
  return `<svg viewBox="-4 -4 ${t} ${t}" shape-rendering="crispEdges" role="img" aria-label="QR do link"><rect x="-4" y="-4" width="${t}" height="${t}" fill="#fff"/><path d="${d}" fill="#222"/></svg>`;
};
