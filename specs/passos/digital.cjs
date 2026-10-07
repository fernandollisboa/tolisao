const { Given, When, Then, expect } = require('./_mundo.cjs');

// a digital do celular: o autenticador virtual do Chromium (CDP), com passkey que o celular lembra
// sozinho e a digital sempre aceita. `credenciais` são passkeys que ele já traz (as sincronizadas)
async function digital(ctx, p, credenciais = []) {
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
  for (const credential of credenciais) await cdp.send('WebAuthn.addCredential', { authenticatorId, credential });
  return { cdp, authenticatorId };
}

Given('que meu celular tem digital', async ({ mundo }) => {
  mundo.naPagina = async (ctx, p) => { mundo.digital = await digital(ctx, p); };
});
// o ?digital do endereço, que o aparelho guarda
Given('que eu pedi pra testar a digital', async ({ mundo }) => {
  const a = (mundo.antes ||= {});
  a.tolisa = JSON.stringify({ ...JSON.parse(a.tolisa || '{}'), passkeyOn: true });
});

When('eu abro o tô lisa', async ({ mundo }) => {
  if (mundo.p) await mundo.p.goto(mundo.base + '/');
  else await mundo.abre({ semEvento: true });
  await mundo.p.waitForSelector('#gateCode');
});
When('eu abro o tô lisa pelo endereço de testar a digital', async ({ mundo }) => {
  await mundo.p.goto(mundo.base + '/?digital');
  await mundo.p.waitForSelector('#gateCode');
});

When('eu guardo meus eventos na digital', async ({ mundo }) => { await mundo.p.click('#digGuarda'); });

// o celular novo: aparelho limpo, que só tem a digital com a passkey sincronizada do primeiro
When('eu entro com a digital num celular novo', async ({ mundo }) => {
  const { cdp, authenticatorId } = mundo.digital;
  const { credentials } = await cdp.send('WebAuthn.getCredentials', { authenticatorId });
  expect(credentials, 'a passkey guardada').toHaveLength(1);
  mundo.antes = { tolisa: JSON.stringify({ passkeyOn: true }) };
  mundo.naPagina = async (ctx, p) => { mundo.digital = await digital(ctx, p, credentials); };
  await mundo.abre({ semEvento: true });
  await mundo.p.waitForSelector('#gateCode');
  await expect(mundo.p.locator('#overlayBox .ev')).toHaveCount(0);
  await mundo.p.click('#digEntra');
});

Then('o {string} volta pra lista, comigo como {word}', async ({ mundo }, nome, quem) => {
  const ev = mundo.p.locator('#overlayBox .ev', { hasText: nome });
  await expect(ev.locator('.l')).toHaveText(nome);
  await expect(ev).toContainText(`sou ${quem}`);
});

Then('o cartão não oferece a digital', async ({ mundo }) => {
  await expect(mundo.p.locator('#overlayBox h2').first()).toBeVisible();
  await expect(mundo.p.locator('#overlayBox .digital')).toHaveCount(0);
});
Then('o cartão oferece {string}', async ({ mundo }, txt) => {
  await expect(mundo.p.locator('#overlayBox .digital')).toContainText(txt);
});
