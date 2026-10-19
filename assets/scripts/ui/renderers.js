import {
  calculateTotals,
  centsToField,
  escapeHtml,
  formatCurrency,
  formatDate,
  formatValidity,
  validateBudget,
} from '../core/budget.js';
import { findThumbnail } from '../services/catalog.js';

export function createRenderer(elements, getState) {
  const getBudget = () => getState().budget;
  const getDatabase = () => getState().database;
  const getCatalog = () => getState().catalog;

  function renderProducts() {
    const query = elements.search.value.trim().toLowerCase();
    const category = elements.categoryFilter.value;
    const products = getCatalog().filter((product) => (
      (!category || product.cat === category) && product.nome.toLowerCase().includes(query)
    ));

    elements.productList.innerHTML = products.length ? products.map((product) => `
      <article class="prod" data-slug="${escapeHtml(product.slug)}">
        <img src="${escapeHtml(product.cores[0]?.img)}" alt="${escapeHtml(product.nome)}" loading="lazy">
        <h3>${escapeHtml(product.nome)}</h3>
        <div class="linha">
          <select class="s-gram" aria-label="Gramatura">${product.gram.map((weight) => `<option>${escapeHtml(weight)}</option>`).join('')}</select>
          <select class="s-cor" aria-label="Cor">${product.cores.map((color) => `<option>${escapeHtml(color.nome)}</option>`).join('')}</select>
          <input class="s-qtd" type="number" min="1" step="1" value="1" aria-label="Quantidade">
        </div>
        <button class="btn btn--main s-add" type="button">Adicionar ao orçamento</button>
      </article>`).join('') : '<p class="vazio">Nenhuma isca encontrada.</p>';
  }

  function renderItems() {
    const budget = getBudget();
    if (!budget.itens.length) {
      elements.items.innerHTML = '<p class="vazio">Nenhum item ainda. Escolha acima e clique em “Adicionar”.</p>';
      return;
    }

    elements.items.innerHTML = `<table class="tbl"><thead><tr><th>Produto</th><th>Gram.</th><th>Cor</th><th>Qtd</th><th>Preço un. (R$)</th><th class="num">Subtotal</th><th><span class="sr-only">Ações</span></th></tr></thead><tbody>${budget.itens.map((item, index) => `<tr data-index="${index}">
      <td data-l="Produto">${escapeHtml(item.produto)}</td><td data-l="Gram.">${escapeHtml(item.gram)}</td><td data-l="Cor">${escapeHtml(item.cor)}</td>
      <td data-l="Qtd"><input class="i-qtd" type="number" min="1" step="1" value="${item.qtd}" aria-label="Quantidade"></td>
      <td data-l="Preço"><input class="i-preco" inputmode="decimal" value="${centsToField(item.preco)}" placeholder="0,00" aria-label="Preço unitário"></td>
      <td data-l="Subtotal" class="num">${formatCurrency(item.qtd * item.preco)}</td>
      <td><button class="btn btn--sm i-del" type="button" aria-label="Remover ${escapeHtml(item.produto)}">Remover</button></td></tr>`).join('')}</tbody></table>`;
  }

  function renderSummary() {
    const budget = getBudget();
    const totals = calculateTotals(budget);
    elements.summary.innerHTML = `<span>${totals.quantity} un. · ${budget.itens.length} item(ns) · ${budget.tipo === 'lojista' ? 'Lojista' : 'Consumidor'}</span><span>Total: <strong>${formatCurrency(totals.total)}</strong></span>`;
  }

  function renderForm() {
    const { budget, database } = getState();
    const fields = {
      c_nome: budget.cliente.nome, c_doc: budget.cliente.doc, c_tel: budget.cliente.tel,
      c_email: budget.cliente.email, c_end: budget.cliente.end, o_data: budget.data,
      o_prazo: budget.prazo, o_pag: budget.pagamento, o_obs: budget.obs,
    };
    Object.entries(fields).forEach(([id, value]) => { elements[id].value = value; });
    elements.o_num.value = budget.numero;
    elements.o_val.value = budget.validade;
    elements.o_frete.value = centsToField(budget.frete);
    elements.o_desc_tipo.value = budget.descTipo;
    elements.o_desc.value = budget.descTipo === 'pct'
      ? String(budget.desc / 100).replace('.', ',')
      : centsToField(budget.desc);
    if (budget.descTipo === 'pct' && !budget.desc) elements.o_desc.value = '';

    [['tel', 'e_tel'], ['cnpj', 'e_cnpj'], ['email', 'e_email'], ['end', 'e_end']]
      .forEach(([property, id]) => { elements[id].value = database.empresa[property] || ''; });
    elements.clientType.querySelectorAll('button').forEach((button) => {
      button.classList.toggle('on', button.dataset.tipo === budget.tipo);
      button.setAttribute('aria-pressed', String(button.dataset.tipo === budget.tipo));
    });
  }

  function renderPreview() {
    const { budget, database, catalog } = getState();
    const totals = calculateTotals(budget);
    const company = database.empresa;
    const client = budget.cliente;
    const companyDetails = [
      company.tel && `WhatsApp ${escapeHtml(company.tel)}`,
      company.email && escapeHtml(company.email),
      company.cnpj && `CNPJ ${escapeHtml(company.cnpj)}`,
      company.end && escapeHtml(company.end),
    ].filter(Boolean).join('<br>');
    const rows = budget.itens.map((item) => `<tr><td><img src="${escapeHtml(findThumbnail(catalog, item.slug, item.cor))}" alt=""></td><td><b>${escapeHtml(item.produto)}</b></td><td>${escapeHtml(item.gram)}</td><td>${escapeHtml(item.cor)}</td>
      <td class="r">${item.qtd}</td><td class="r">${formatCurrency(item.preco)}</td><td class="r">${formatCurrency(item.qtd * item.preco)}</td></tr>`).join('');
    const conditions = [
      ['Validade', `${budget.validade} dia(s) — até ${formatValidity(budget)}`],
      budget.prazo && ['Prazo de entrega', budget.prazo],
      budget.pagamento && ['Pagamento', budget.pagamento],
    ].filter(Boolean);

    elements.sheet.innerHTML = `
      <div class="cab"><img src="../logo-urutau.png" alt="Urutau Jigs"><div class="emp"><h1>ORÇAMENTO Nº ${escapeHtml(budget.numero)}</h1>Emitido em ${formatDate(budget.data)}<br>${companyDetails}</div></div>
      <div class="meta">
        <div class="box"><b>Cliente (${budget.tipo === 'lojista' ? 'Lojista' : 'Consumidor'})</b>${escapeHtml(client.nome) || '—'}${client.doc ? `<br>CPF/CNPJ: ${escapeHtml(client.doc)}` : ''}${client.tel ? `<br>Tel.: ${escapeHtml(client.tel)}` : ''}${client.email ? `<br>${escapeHtml(client.email)}` : ''}${client.end ? `<br>Entrega: ${escapeHtml(client.end)}` : ''}</div>
        <div class="box"><b>Condições comerciais</b>${conditions.map(([label, value]) => `${label}: ${escapeHtml(value)}`).join('<br>')}</div>
      </div>
      <table><thead><tr><th></th><th>Produto</th><th>Gram.</th><th>Cor</th><th class="r">Qtd</th><th class="r">Preço un.</th><th class="r">Subtotal</th></tr></thead><tbody>${rows || '<tr><td colspan="7">Nenhum item.</td></tr>'}</tbody></table>
      <div class="fim"><div class="tot"><div><span>Subtotal (${totals.quantity} un.)</span><span>${formatCurrency(totals.subtotal)}</span></div>
        ${totals.discount ? `<div><span>Desconto${budget.descTipo === 'pct' ? ` (${String(budget.desc / 100).replace('.', ',')}%)` : ''}</span><span>− ${formatCurrency(totals.discount)}</span></div>` : ''}
        ${budget.frete ? `<div><span>Frete</span><span>${formatCurrency(budget.frete)}</span></div>` : ''}
        <div class="final"><span>TOTAL</span><span>${formatCurrency(totals.total)}</span></div></div>
        ${budget.obs.trim() ? `<div class="box" style="margin-bottom:5mm"><b>Observações</b>${escapeHtml(budget.obs).replace(/\n/g, '<br>')}</div>` : ''}
        <div class="rod">Urutau Jigs — obrigado pela preferência.</div></div>`;
  }

  function renderNotices() {
    const { errors, warnings } = validateBudget(getBudget());
    elements.notices.innerHTML = errors.map((message) => `<div class="aviso erro">${escapeHtml(message)}</div>`).join('')
      + warnings.map((message) => `<div class="aviso">${escapeHtml(message)}</div>`).join('');
  }

  function renderHistory() {
    const history = [...getDatabase().lista].sort((a, b) => b.numero.localeCompare(a.numero));
    elements.historyList.innerHTML = history.length ? history.map((budget) => `<article class="hist" data-id="${budget.id}">
      <span><b>Nº ${escapeHtml(budget.numero)}</b> · ${escapeHtml(budget.cliente.nome) || 'sem cliente'} · ${formatDate(budget.data)} · <strong>${formatCurrency(calculateTotals(budget).total)}</strong></span>
      <span><button class="btn btn--sm h-abrir" type="button">Abrir</button> <button class="btn btn--sm h-dup" type="button">Duplicar</button> <button class="btn btn--sm h-del" type="button">Excluir</button></span></article>`).join('')
      : '<p class="vazio">Nenhum orçamento salvo ainda.</p>';
  }

  return {
    renderProducts, renderItems, renderSummary, renderForm, renderPreview, renderNotices, renderHistory,
    renderAll: () => { renderItems(); renderSummary(); renderPreview(); renderNotices(); },
  };
}
