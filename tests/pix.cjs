// Só chave aleatória ou e-mail, o tok de um aparelho só, e o copia e cola com valor.
const { abre } = require('./_app.cjs');

/** o CRC16/CCITT-FALSE do fim do BR Code, escrito aqui de novo de propósito:
 *  teste que importa a conta do app não confere conta nenhuma */
function crc16(s){ let c = 0xFFFF;
  for (let i = 0; i < s.length; i++) { c ^= s.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) c = (c & 0x8000 ? (c << 1) ^ 0x1021 : c << 1) & 0xFFFF; }
  return c.toString(16).toUpperCase().padStart(4, '0'); }

/** quebra o EMV em id -> valor, pra conferir campo por campo em vez de por substring */
function tlv(s){ const o = {}; let i = 0;
  while (i + 4 <= s.length) { const id = s.slice(i, i + 2), n = +s.slice(i + 2, i + 4);
    o[id] = s.slice(i + 4, i + 4 + n); i += 4 + n; }
  return o; }

(async () => {
  const app = await abre({ semente: true, quem: 'Fernando', escala: 2 });
  const p = app.p; const erros = app.erros;
  const exige = (ok, msg) => { if (!ok) erros.push(msg); };
  try {
    const cadastra = async (pg, v) => { await pg.click('#pixBtn'); await pg.waitForSelector('#askInput');
      await pg.fill('#askInput', v); await pg.click('#askForm button.big'); await pg.waitForTimeout(300);
      return pg.$eval('#toast', e => e.textContent); };

    for (const [chave, oque] of [['123.456.789-09', 'CPF'], ['+5583999998888', 'telefone']]) {
      const toast = await cadastra(p, chave);
      exige(/Só chave aleatória ou e-mail/i.test(toast), `${oque} devia ser recusado, veio: ${toast}`);
      exige(Object.keys(app.loja).every(k => !k.startsWith('/pix/')), `${oque} recusado na tela mas gravado no banco`);
      console.log(`${oque} recusado:`, toast);
    }

    const ALEATORIA = '7d9f2a1c-3b4e-4f5a-8c6d-0e1f2a3b4c5d';
    const ok = await cadastra(p, ALEATORIA);
    exige(/salva/i.test(ok), `a chave aleatória devia passar, veio: ${ok}`);
    const no = Object.entries(app.loja).find(([k]) => k.startsWith('/pix/'));
    exige(!!no, 'a chave não chegou no banco');
    const gravado = JSON.parse(no[1]);
    exige(gravado.key === ALEATORIA, `gravou outra chave: ${gravado.key}`);
    exige(typeof gravado.tok === 'string' && gravado.tok.length >= 16, 'gravou sem um tok decente');
    // a linha do pix esvazia junto com a transição, não no mesmo quadro
    await p.waitForFunction(() => !document.querySelector('#pixBtn'), null, { timeout: 3000 })
      .catch(() => erros.push('o botão de cadastrar continuou lá depois de cadastrar'));
    console.log('aleatória:', ok, '| no banco:', gravado.key);

    // outro aparelho: não há por onde sobrescrever pela tela
    const p2 = await app.aba({ quem: 'Fernando' });
    exige(await p2.locator('#pixBtn').count() === 0, 'o outro aparelho podia cadastrar por cima');
    await p2.click('#whoBtn'); await p2.waitForSelector('#whoSel');
    exige(await p2.locator('#whoPix').count() === 0, 'o cartão de quem é você voltou a mexer em pix');
    exige(await p2.locator('#leaveBtn').count() === 0, 'o sair voltou pro cartão de quem é você');
    await p2.click('#overlay', { position: { x: 5, y: 5 } }); await p2.waitForTimeout(200);
    console.log('no outro aparelho não há por onde trocar a chave: ok');

    // e na marra, direto no banco, a regra nega
    const negou = await p2.evaluate(async sala => {
      const r = await fetch(`https://fake-db.firebaseio.com/pix/${sala}/fernando.json`, { method: 'PUT',
        body: JSON.stringify({ key: 'hacker@mal.com', tok: 'token-de-outro-aparelho' }) });
      return r.status; }, app.sala);
    exige(negou === 401, `a troca por outro aparelho devia dar 401, deu ${negou}`);
    exige(JSON.parse(app.loja[no[0]]).key === ALEATORIA, 'a chave no banco foi trocada por outro aparelho');
    console.log('troca por outro aparelho:', negou, '| a chave continua', JSON.parse(app.loja[no[0]]).key);

    // a Lia deve pro Fernando: copia e cola com o valor dela
    await p2.evaluate(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: async t => { window.__copiado = t; } } }));
    await p2.click('#whoBtn'); await p2.waitForSelector('#whoSel'); await p2.selectOption('#whoSel', { label: 'Lia' });
    await p2.waitForSelector('#mineRows [data-pix]', { timeout: 9000 });
    const devido = await p2.$eval('#mineRows .row.sub .v', e => e.innerText.replace(/[^\d,]/g, ''));
    await p2.click('#mineRows [data-pix]'); await p2.waitForTimeout(300);
    const code = await p2.evaluate(() => window.__copiado);
    console.log('BRCODE:', code);
    const campos = tlv(code);
    exige(code.slice(-4) === crc16(code.slice(0, -4)), 'o CRC do BR Code não fecha');
    exige(tlv(campos['26'] || '')['01'] === ALEATORIA, `o BR Code não leva a chave certa: ${campos['26']}`);
    exige(campos['54'] === devido.replace(',', '.'), `o valor do BR Code (${campos['54']}) não é o que a tela diz (${devido})`);
    exige(campos['53'] === '986' && campos['58'] === 'BR', 'moeda ou país errados no BR Code');
    exige(campos['59'] === 'FERNANDO', `nome do recebedor errado: ${campos['59']}`);
    console.log('copia e cola:', `R$ ${campos['54']} pra ${campos['59']}, CRC ok`);

    // quitei -> o zap avisa quem recebe
    await p2.evaluate(() => { window.open = u => { window.__wa = u; }; });
    await p2.click('#mineRows [data-settle]'); await p2.waitForSelector('#okBtn'); await p2.click('#okBtn');
    await p2.waitForSelector('#waAviso'); await p2.click('#waAviso'); await p2.waitForTimeout(300);
    const zap = decodeURIComponent((await p2.evaluate(() => window.__wa)).split('text=')[1] || '');
    exige(/Paguei/i.test(zap), `o aviso do zap não diz que pagou: ${zap}`);
    console.log('zap:', zap.replace(/\n/g, ' | '));

    exige(app.contas.listagens === 0, `o app tentou listar os eventos ${app.contas.listagens}x`);
    console.log('tentativas de listar eventos:', app.contas.listagens, '| errors:', erros);
  } finally { await app.fecha(); }
  if (erros.length) process.exit(1);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
