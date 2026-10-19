import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTotals, normalizeWhatsApp, parseCents } from '../assets/scripts/core/budget.js';

test('calcula subtotal, desconto percentual e frete em centavos', () => {
  const totals = calculateTotals({
    itens: [{ qtd: 2, preco: 1250 }, { qtd: 1, preco: 500 }],
    descTipo: 'pct', desc: 1000, frete: 750,
  });
  assert.deepEqual(totals, { subtotal: 3000, discount: 300, total: 3450, quantity: 3 });
});

test('não permite desconto em valor maior que o subtotal', () => {
  const totals = calculateTotals({
    itens: [{ qtd: 1, preco: 1000 }],
    descTipo: 'valor', desc: 1500, frete: 0,
  });
  assert.equal(totals.discount, 1000);
  assert.equal(totals.total, 0);
});

test('converte dinheiro e normaliza telefone brasileiro para WhatsApp', () => {
  assert.equal(parseCents('R$ 1.234,56'), 123456);
  assert.equal(normalizeWhatsApp('(31) 99762-9180'), '5531997629180');
  assert.equal(normalizeWhatsApp('123'), '');
});
