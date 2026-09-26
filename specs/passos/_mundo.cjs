const { test: base, createBdd, defineParameterType } = require('playwright-bdd');
const { expect } = require('@playwright/test');
const servir = require('../_serve.cjs');
const { Banco } = require('../_banco.cjs');

defineParameterType({ name: 'num', regexp: /\d+(?:\.\d{3})*(?:,\d+)?/, transformer: s => Number(s.replace(/\./g, '').replace(',', '.')) });
defineParameterType({ name: 'gente', regexp: /[^"]+?/, transformer: s => s.split(/\s*,\s*|\s+e\s+/).filter(Boolean) });

const idDe = nome => nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

class Mundo {
  constructor(browser, base) {
    this.browser = browser; this.base = base; this.banco = new Banco();
    this.evento = null; this.sala = ''; this.p = null; this.nota = {};
    this.erros = []; this.dialogos = []; this.contextos = []; this.antes = null; this.recusasEsperadas = 0;
  }
  get link() { return `${this.base}/?senha=${this.evento.name}`; }
  pessoa(nome) { const eu = this.evento.people.find(x => x.name === nome); if (!eu) throw new Error(`${nome} não está no evento`); return eu; }
  criaEvento(dados) { this.evento = dados; this.sala = this.banco.sala(dados); return dados; }

  async abre({ quem, toque = false, semEvento = false } = {}) {
    const ctx = await this.browser.newContext({ acceptDownloads: true, hasTouch: toque, isMobile: toque });
    this.contextos.push(ctx);
    await this.banco.liga(ctx);
    await ctx.addInitScript(() => {
      const w = window;
      w.open = u => { w.__aberto = u; return null; };
      // a CSP do index.html barrou alguma coisa do próprio site: vira erro do cenário
      document.addEventListener('securitypolicyviolation', e => setTimeout(() => { throw new Error(`CSP barrou ${e.violatedDirective}: ${e.blockedURI || 'inline'}`); }));
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: async t => { w.__copiado = t; } } });
    });
    // o que o aparelho já tinha guardado antes desta visita (só na primeira carga da aba)
    if (this.antes) await ctx.addInitScript(antes => { if (sessionStorage.getItem('__antes')) return; sessionStorage.setItem('__antes', '1');
      for (const [k, v] of Object.entries(antes)) localStorage.setItem(k, v); }, this.antes);
    const p = await ctx.newPage(); this.p = p;
    p.on('pageerror', e => this.erros.push(e.message));
    p.on('dialog', d => { this.dialogos.push(d.message()); d.accept(); });
    await p.goto(semEvento ? this.base + '/' : this.link);
    if (quem) await this.souEu(quem);
    return p;
  }

  async souEu(quem) {
    const p = this.p; await p.click('#whoBtn'); await p.waitForSelector('#whoSel');
    await p.selectOption('#whoSel', { label: quem });
  }

  async fechaCartao() { await this.p.click('#overlay', { position: { x: 5, y: 5 } }); await this.p.waitForSelector('#overlay', { state: 'hidden' }); }
  linhas(sel) { return this.p.$eval(sel, e => e.innerText.split('\n').map(l => l.trim()).filter(Boolean)); }

  async fecha() {
    for (const c of this.contextos) await c.close().catch(() => {});
    expect(this.erros, 'erros na página').toEqual([]);
    expect(this.dialogos, 'diálogos nativos').toEqual([]);
    expect(this.banco.listagens, 'tentativas de listar eventos').toBe(0);
    expect(this.banco.recusas, 'salas que o banco recusou pelas regras').toBe(this.recusasEsperadas);
  }
}

const test = base.extend({
  servidor: [async ({}, use) => { const { srv, porta } = await servir(); await use(`http://localhost:${porta}`); srv.close(); }, { scope: 'worker' }],
  mundo: async ({ browser, servidor }, use) => { const m = new Mundo(browser, servidor); await use(m); await m.fecha(); },
});

module.exports = { test, expect, idDe, ...createBdd(test) };
