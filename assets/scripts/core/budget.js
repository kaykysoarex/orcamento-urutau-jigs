export const DEFAULT_COMPANY = {
  tel: '(31) 9976-2918',
  wa: '553199762918',
  cnpj: '',
  email: '',
  end: '',
};

export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

export const formatCurrency = (cents) => (cents / 100).toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function parseCents(value) {
  let normalized = String(value ?? '').replace(/[^\d,.-]/g, '');
  if (!normalized) return 0;
  if (normalized.includes(',')) normalized = normalized.replace(/\./g, '').replace(',', '.');

  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : 0;
}

export const centsToField = (cents) => (cents ? (cents / 100).toFixed(2).replace('.', ',') : '');
export const formatDate = (date) => (date ? date.split('-').reverse().join('/') : '');
export const today = () => new Date().toISOString().slice(0, 10);
export const clone = (value) => JSON.parse(JSON.stringify(value));

export function calculateTotals(budget) {
  const subtotal = budget.itens.reduce((sum, item) => sum + item.qtd * item.preco, 0);
  const discount = budget.descTipo === 'pct'
    ? Math.round(subtotal * Math.min(Math.max(budget.desc, 0), 10000) / 10000)
    : Math.min(budget.desc, subtotal);
  const total = subtotal - Math.min(discount, subtotal) + budget.frete;
  const quantity = budget.itens.reduce((sum, item) => sum + item.qtd, 0);

  return { subtotal, discount: Math.min(discount, subtotal), total, quantity };
}

export function createBudget(sequence) {
  return {
    id: `o${Date.now()}`,
    numero: String(sequence).padStart(4, '0'),
    data: today(),
    validade: 7,
    tipo: 'consumidor',
    cliente: { nome: '', doc: '', tel: '', email: '', end: '' },
    itens: [],
    descTipo: 'valor',
    desc: 0,
    frete: 0,
    prazo: '',
    pagamento: '',
    obs: '',
    salvo: false,
  };
}

export function validateBudget(budget) {
  const errors = [];
  const warnings = [];

  if (!budget.itens.length) errors.push('Adicione ao menos um produto.');
  if (!budget.cliente.nome.trim()) errors.push('Informe o nome do cliente (aba 2).');
  if (budget.itens.some((item) => !item.preco)) warnings.push('Há itens sem preço (R$ 0,00).');
  if (budget.descTipo === 'valor' && budget.desc > calculateTotals({ ...budget, desc: 0 }).subtotal) {
    warnings.push('O desconto é maior que o subtotal e foi limitado.');
  }

  return { errors, warnings };
}

export function formatValidity(budget) {
  const date = new Date(`${budget.data}T12:00:00`);
  date.setDate(date.getDate() + budget.validade);
  return date.toLocaleDateString('pt-BR');
}

export function normalizeWhatsApp(phone) {
  let digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return /^55\d{10,11}$/.test(digits) ? digits : '';
}
