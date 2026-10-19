import {
  calculateTotals,
  clone,
  createBudget,
  escapeHtml,
  normalizeWhatsApp,
  parseCents,
  validateBudget,
} from './core/budget.js';
import { findProduct, loadCatalog } from './services/catalog.js';
import { loadDatabase, saveDatabase } from './services/storage.js';
import { createRenderer } from './ui/renderers.js';

const byId = (id) => document.getElementById(id);
const elements = {
  tabs: byId('abas'),
  summary: byId('resumoBar'),
  search: byId('busca'),
  categoryFilter: byId('filtroCat'),
  productList: byId('listaProdutos'),
  items: byId('itens'),
  clientType: byId('tipoSeg'),
  notices: byId('avisos'),
  historyList: byId('listaHist'),
  sheet: byId('folha'),
  toast: byId('toast'),
  saveButton: byId('btnSalvar'),
  pdfButton: byId('btnPdf'),
  whatsappButton: byId('btnWa'),
  newButton: byId('btnNovo'),
  c_nome: byId('c_nome'), c_doc: byId('c_doc'), c_tel: byId('c_tel'), c_email: byId('c_email'), c_end: byId('c_end'),
  o_num: byId('o_num'), o_data: byId('o_data'), o_val: byId('o_val'), o_prazo: byId('o_prazo'),
  o_pag: byId('o_pag'), o_frete: byId('o_frete'), o_desc: byId('o_desc'), o_desc_tipo: byId('o_desc_tipo'), o_obs: byId('o_obs'),
  e_tel: byId('e_tel'), e_cnpj: byId('e_cnpj'), e_email: byId('e_email'), e_end: byId('e_end'),
};

const formFields = {
  c_nome: ['cliente', 'nome'], c_doc: ['cliente', 'doc'], c_tel: ['cliente', 'tel'],
  c_email: ['cliente', 'email'], c_end: ['cliente', 'end'], o_data: ['data'],
  o_prazo: ['prazo'], o_pag: ['pagamento'], o_obs: ['obs'],
};

let database = loadDatabase();
let budget = database.atual || createNextBudget();
let catalog = [];
let toastTimeout;

const renderer = createRenderer(elements, () => ({ database, budget, catalog }));
window.__calc = calculateTotals; // compatibilidade com os testes existentes

function createNextBudget() {
  database.seq += 1;
  return createBudget(database.seq);
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('on');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => elements.toast.classList.remove('on'), 2600);
}

function persistDraft() {
  database.atual = budget;
  if (!saveDatabase(database)) showToast('Não foi possível salvar neste navegador.');
}

function syncFormToState() {
  Object.entries(formFields).forEach(([id, path]) => {
    if (path.length === 2) budget[path[0]][path[1]] = elements[id].value;
    else budget[path[0]] = elements[id].value;
  });
  const validity = Math.floor(Number(elements.o_val.value));
  budget.validade = validity >= 1 ? validity : 1;
  budget.frete = parseCents(elements.o_frete.value);
  budget.descTipo = elements.o_desc_tipo.value;
  budget.desc = budget.descTipo === 'pct'
    ? Math.min(Math.round(parseCents(elements.o_desc.value)), 10000)
    : parseCents(elements.o_desc.value);
  [['tel', 'e_tel'], ['cnpj', 'e_cnpj'], ['email', 'e_email'], ['end', 'e_end']]
    .forEach(([property, id]) => { database.empresa[property] = elements[id].value.trim(); });
}

function refreshDraft() {
  renderer.renderAll();
  persistDraft();
}

function addItem(slug, weight, color, quantity) {
  const product = findProduct(catalog, slug);
  const parsedQuantity = Math.floor(quantity);
  if (!product || parsedQuantity < 1) {
    showToast('Informe uma quantidade válida (mínimo 1).');
    return;
  }

  const existingItem = budget.itens.find((item) => item.slug === slug && item.gram === weight && item.cor === color);
  if (existingItem) existingItem.qtd += parsedQuantity;
  else {
    budget.itens.push({
      slug,
      produto: product.nome,
      gram: weight,
      cor: color,
      qtd: parsedQuantity,
      preco: database.precos[slug]?.[budget.tipo] || 0,
    });
  }
  refreshDraft();
  showToast(`${product.nome} adicionado.`);
}

function saveBudget(silent = false) {
  syncFormToState();
  const index = database.lista.findIndex((item) => item.id === budget.id);
  budget.salvo = true;
  if (index >= 0) database.lista[index] = clone(budget);
  else database.lista.push(clone(budget));
  if (saveDatabase(database) && !silent) showToast('Orçamento salvo.');
  renderer.renderHistory();
}

function openBudget(savedBudget, tab) {
  budget = clone(savedBudget);
  renderer.renderForm();
  refreshDraft();
  if (tab) switchTab(tab);
}

function switchTab(tabName) {
  document.querySelectorAll('.aba').forEach((tab) => tab.classList.toggle('on', tab.id === `tab-${tabName}`));
  elements.tabs.querySelectorAll('button').forEach((button) => {
    const selected = button.dataset.tab === tabName;
    button.classList.toggle('on', selected);
    button.setAttribute('aria-selected', String(selected));
  });
  document.body.classList.toggle('tab-previa', tabName === 'previa');
  if (tabName === 'previa') {
    syncFormToState();
    refreshDraft();
  }
  if (tabName === 'hist') renderer.renderHistory();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function printBudget() {
  syncFormToState();
  refreshDraft();
  const { errors } = validateBudget(budget);
  if (errors.length) {
    switchTab('previa');
    showToast(errors[0]);
    return;
  }

  saveBudget(true);
  const previousTitle = document.title;
  document.title = `orcamento-urutau-${budget.numero}`;
  window.print();
  setTimeout(() => { document.title = previousTitle; }, 1000);
}

function openWhatsApp() {
  syncFormToState();
  refreshDraft();
  const { errors } = validateBudget(budget);
  if (errors.length) {
    switchTab('previa');
    showToast(errors[0]);
    return;
  }

  const phone = normalizeWhatsApp(budget.cliente.tel);
  if (!phone) showToast('Telefone do cliente inválido ou vazio: escolha o contato no WhatsApp.');
  const total = calculateTotals(budget).total;
  const message = `Olá, ${budget.cliente.nome.trim()}! Segue o orçamento nº ${budget.numero} da Urutau Jigs, no valor total de ${(total / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}. Válido por ${budget.validade} dia(s). Estou enviando o PDF em anexo.`;
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
}

function bindEvents() {
  elements.tabs.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-tab]');
    if (button) switchTab(button.dataset.tab);
  });
  elements.search.addEventListener('input', renderer.renderProducts);
  elements.categoryFilter.addEventListener('change', renderer.renderProducts);

  elements.productList.addEventListener('click', (event) => {
    const button = event.target.closest('.s-add');
    if (!button) return;
    const card = button.closest('.prod');
    addItem(card.dataset.slug, card.querySelector('.s-gram').value, card.querySelector('.s-cor').value, Number(card.querySelector('.s-qtd').value));
  });

  elements.items.addEventListener('change', (event) => {
    const row = event.target.closest('tr[data-index]');
    if (!row) return;
    const item = budget.itens[Number(row.dataset.index)];
    if (event.target.classList.contains('i-qtd')) {
      const quantity = Math.floor(Number(event.target.value));
      if (quantity >= 1) item.qtd = quantity;
      else showToast('Quantidade mínima: 1.');
    }
    if (event.target.classList.contains('i-preco')) {
      item.preco = parseCents(event.target.value);
      (database.precos[item.slug] ||= {})[budget.tipo] = item.preco;
    }
    refreshDraft();
  });
  elements.items.addEventListener('click', (event) => {
    const button = event.target.closest('.i-del');
    if (!button) return;
    budget.itens.splice(Number(button.closest('tr').dataset.index), 1);
    refreshDraft();
  });

  elements.clientType.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-tipo]');
    if (!button) return;
    budget.tipo = button.dataset.tipo;
    budget.itens.forEach((item) => {
      const price = database.precos[item.slug]?.[budget.tipo];
      if (price !== undefined) item.preco = price;
    });
    renderer.renderForm();
    refreshDraft();
  });

  document.querySelectorAll('#tab-dados input, #tab-dados select, #tab-dados textarea').forEach((field) => {
    field.addEventListener('input', () => {
      syncFormToState();
      renderer.renderSummary();
      renderer.renderPreview();
      persistDraft();
    });
  });
  elements.saveButton.addEventListener('click', () => saveBudget());
  elements.pdfButton.addEventListener('click', printBudget);
  elements.whatsappButton.addEventListener('click', openWhatsApp);
  elements.newButton.addEventListener('click', () => {
    if (budget.itens.length && !confirm('Começar um novo orçamento? O atual continua salvo apenas se você já clicou em “Salvar rascunho”.')) return;
    budget = createNextBudget();
    renderer.renderForm();
    refreshDraft();
    switchTab('produtos');
  });
  elements.historyList.addEventListener('click', (event) => {
    const row = event.target.closest('.hist');
    if (!row) return;
    const savedBudget = database.lista.find((item) => item.id === row.dataset.id);
    if (!savedBudget) return;
    if (event.target.closest('.h-abrir')) openBudget(savedBudget, 'produtos');
    else if (event.target.closest('.h-dup')) {
      const newBudget = createNextBudget();
      openBudget({ ...clone(savedBudget), id: newBudget.id, numero: newBudget.numero, data: newBudget.data, salvo: false }, 'produtos');
      showToast(`Duplicado como nº ${newBudget.numero}.`);
    } else if (event.target.closest('.h-del') && confirm(`Excluir o orçamento nº ${savedBudget.numero}? Esta ação não pode ser desfeita.`)) {
      database.lista = database.lista.filter((item) => item.id !== savedBudget.id);
      saveDatabase(database);
      renderer.renderHistory();
      showToast('Orçamento excluído.');
    }
  });
}

async function start() {
  renderer.renderForm();
  refreshDraft();
  switchTab('produtos');
  bindEvents();

  try {
    catalog = await loadCatalog();
    [...new Set(catalog.map((product) => product.cat).filter(Boolean))].forEach((category) => {
      const label = `${category[0].toUpperCase()}${category.slice(1)}`;
      elements.categoryFilter.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(category)}">${escapeHtml(label)}</option>`);
    });
    renderer.renderProducts();
    renderer.renderPreview();
  } catch {
    elements.productList.innerHTML = '<p class="vazio">Não foi possível carregar o catálogo. Abra este orçamento a partir do site principal.</p>';
  }
}

if (elements.tabs) start();
