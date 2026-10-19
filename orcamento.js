// =============================================
//   URUTAU JIGS — GERADOR DE ORÇAMENTOS v1
//   Lê os produtos direto de ../index.html (fonte única).
// =============================================
(() => {
'use strict';
const KEY = 'urutau_orc_v1';
const EMPRESA_PADRAO = { tel: '(31) 9976-2918', wa: '553199762918', cnpj: '', email: '', end: '' };
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ── Dinheiro em centavos (inteiros) ──────────
const brl = c => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
function parseCents(v) {
  let s = String(v ?? '').replace(/[^\d,.-]/g, '');
  if (!s) return 0;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0;
}
const centsToField = c => c ? (c / 100).toFixed(2).replace('.', ',') : '';
function calc(o) {
  const sub = o.itens.reduce((s, i) => s + i.qtd * i.preco, 0);
  let desc = o.descTipo === 'pct'
    ? Math.round(sub * Math.min(Math.max(o.desc, 0), 10000) / 10000)
    : Math.min(o.desc, sub);
  desc = Math.min(desc, sub);
  const total = sub - desc + o.frete;
  return { sub, desc, total, qtd: o.itens.reduce((s, i) => s + i.qtd, 0) };
}
window.__calc = calc; // usado nos testes

// ── Armazenamento (localStorage, com tratamento de erro) ──
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && d.v === 1) return d;
  } catch { /* corrompido: recomeça */ }
  return { v: 1, seq: 0, lista: [], precos: {}, empresa: { ...EMPRESA_PADRAO }, atual: null };
}
let db = load();
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); return true; }
  catch { toast('Não foi possível salvar neste navegador.'); return false; }
}

// ── Estado do orçamento ──────────────────────
const hoje = () => new Date().toISOString().slice(0, 10);
const pad = n => String(n).padStart(4, '0');
function novoOrc() {
  db.seq += 1;
  return { id: 'o' + Date.now(), numero: pad(db.seq), data: hoje(), validade: 7, tipo: 'consumidor',
    cliente: { nome: '', doc: '', tel: '', email: '', end: '' },
    itens: [], descTipo: 'valor', desc: 0, frete: 0, prazo: '', pagamento: '', obs: '', salvo: false };
}
let orc = db.atual || novoOrc();
let catalogo = [];

// ── Catálogo: lê os cards de ../index.html ───
async function carregarCatalogo() {
  const res = await fetch('../index.html');
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
  catalogo = [...doc.querySelectorAll('.produto-card[data-slug]')].map(c => {
    const imgs = [...c.querySelectorAll('.cor-item')].map(e => ({ nome: e.dataset.nome, img: '../' + e.dataset.img }));
    return { slug: c.dataset.slug, nome: c.dataset.nome, cat: c.dataset.categoria || '',
      gram: (c.dataset.gramaturas || '').split(',').filter(Boolean), cores: imgs };
  });
}
const prod = slug => catalogo.find(p => p.slug === slug);
const thumb = (slug, cor) => (prod(slug)?.cores.find(c => c.nome === cor) || prod(slug)?.cores[0])?.img || '';

// ── Interface: produtos ──────────────────────
function renderProdutos() {
  const q = $('busca').value.trim().toLowerCase(), cat = $('filtroCat').value;
  const lista = catalogo.filter(p => (!cat || p.cat === cat) && p.nome.toLowerCase().includes(q));
  $('listaProdutos').innerHTML = lista.length ? lista.map(p => `
    <div class="prod" data-slug="${esc(p.slug)}">
      <img src="${esc(p.cores[0]?.img)}" alt="${esc(p.nome)}" loading="lazy">
      <h3>${esc(p.nome)}</h3>
      <div class="linha">
        <select class="s-gram" aria-label="Gramatura">${p.gram.map(g => `<option>${esc(g)}</option>`).join('')}</select>
        <select class="s-cor" aria-label="Cor">${p.cores.map(c => `<option>${esc(c.nome)}</option>`).join('')}</select>
        <input class="s-qtd" type="number" min="1" step="1" value="1" aria-label="Quantidade">
      </div>
      <button class="btn btn--main s-add">Adicionar ao orçamento</button>
    </div>`).join('') : '<p class="vazio">Nenhuma isca encontrada.</p>';
}
function adicionar(slug, gram, cor, qtd) {
  const p = prod(slug); if (!p) return;
  qtd = Math.floor(qtd);
  if (!(qtd >= 1)) return toast('Informe uma quantidade válida (mínimo 1).');
  const ex = orc.itens.find(i => i.slug === slug && i.gram === gram && i.cor === cor);
  if (ex) ex.qtd += qtd;
  else orc.itens.push({ slug, produto: p.nome, gram, cor, qtd, preco: db.precos[slug]?.[orc.tipo] || 0 });
  atualizar(); toast(`${p.nome} adicionado.`);
}
function renderItens() {
  if (!orc.itens.length) { $('itens').innerHTML = '<p class="vazio">Nenhum item ainda. Escolha acima e clique em “Adicionar”.</p>'; return; }
  $('itens').innerHTML = `<table class="tbl"><thead><tr><th>Produto</th><th>Gram.</th><th>Cor</th><th>Qtd</th><th>Preço un. (R$)</th><th class="num">Subtotal</th><th></th></tr></thead><tbody>` +
    orc.itens.map((i, n) => `<tr data-n="${n}">
      <td data-l="Produto">${esc(i.produto)}</td><td data-l="Gram.">${esc(i.gram)}</td><td data-l="Cor">${esc(i.cor)}</td>
      <td data-l="Qtd"><input class="i-qtd" type="number" min="1" step="1" value="${i.qtd}" aria-label="Quantidade"></td>
      <td data-l="Preço"><input class="i-preco" inputmode="decimal" value="${centsToField(i.preco)}" placeholder="0,00" aria-label="Preço unitário"></td>
      <td data-l="Subtotal" class="num">${brl(i.qtd * i.preco)}</td>
      <td><button class="btn btn--sm i-del" aria-label="Remover">Remover</button></td></tr>`).join('') + '</tbody></table>';
}
function renderResumo() {
  const t = calc(orc);
  $('resumoBar').innerHTML = `<span>${t.qtd} un. · ${orc.itens.length} item(ns) · ${orc.tipo === 'lojista' ? 'Lojista' : 'Consumidor'}</span><span>Total: <strong>${brl(t.total)}</strong></span>`;
}

// ── Formulário ↔ estado ──────────────────────
const MAP = { c_nome: ['cliente', 'nome'], c_doc: ['cliente', 'doc'], c_tel: ['cliente', 'tel'], c_email: ['cliente', 'email'], c_end: ['cliente', 'end'],
  o_data: ['data'], o_prazo: ['prazo'], o_pag: ['pagamento'], o_obs: ['obs'] };
function preencherForm() {
  for (const [id, path] of Object.entries(MAP)) $(id).value = path.length === 2 ? orc[path[0]][path[1]] : orc[path[0]];
  $('o_num').value = orc.numero; $('o_val').value = orc.validade; $('o_frete').value = centsToField(orc.frete);
  $('o_desc_tipo').value = orc.descTipo;
  $('o_desc').value = orc.descTipo === 'pct' ? String(orc.desc / 100).replace('.', ',') : centsToField(orc.desc);
  if (orc.descTipo === 'pct' && !orc.desc) $('o_desc').value = '';
  for (const [k, id] of [['tel', 'e_tel'], ['cnpj', 'e_cnpj'], ['email', 'e_email'], ['end', 'e_end']]) $(id).value = db.empresa[k] || '';
  document.querySelectorAll('#tipoSeg button').forEach(b => b.classList.toggle('on', b.dataset.tipo === orc.tipo));
}
function lerForm() {
  for (const [id, path] of Object.entries(MAP)) { if (path.length === 2) orc[path[0]][path[1]] = $(id).value; else orc[path[0]] = $(id).value; }
  const v = Math.floor(Number($('o_val').value)); orc.validade = v >= 1 ? v : 1;
  orc.frete = parseCents($('o_frete').value);
  orc.descTipo = $('o_desc_tipo').value;
  orc.desc = orc.descTipo === 'pct' ? Math.min(Math.round(parseCents($('o_desc').value)), 10000) : parseCents($('o_desc').value);
  for (const [k, id] of [['tel', 'e_tel'], ['cnpj', 'e_cnpj'], ['email', 'e_email'], ['end', 'e_end']]) db.empresa[k] = $(id).value.trim();
}

// ── Prévia / folha A4 ────────────────────────
const fmtData = d => d ? d.split('-').reverse().join('/') : '';
function validade() {
  const d = new Date(orc.data + 'T12:00:00'); d.setDate(d.getDate() + orc.validade);
  return d.toLocaleDateString('pt-BR');
}
function renderFolha() {
  const t = calc(orc), e = db.empresa, c = orc.cliente;
  const emp = [e.tel && 'WhatsApp ' + esc(e.tel), e.email && esc(e.email), e.cnpj && 'CNPJ ' + esc(e.cnpj), e.end && esc(e.end)].filter(Boolean).join('<br>');
  const linhas = orc.itens.map(i => `<tr><td><img src="${esc(thumb(i.slug, i.cor))}" alt=""></td><td><b>${esc(i.produto)}</b></td><td>${esc(i.gram)}</td><td>${esc(i.cor)}</td>
    <td class="r">${i.qtd}</td><td class="r">${brl(i.preco)}</td><td class="r">${brl(i.qtd * i.preco)}</td></tr>`).join('');
  const cond = [['Validade', `${orc.validade} dia(s) — até ${validade()}`], orc.prazo && ['Prazo de entrega', orc.prazo], orc.pagamento && ['Pagamento', orc.pagamento]].filter(Boolean);
  $('folha').innerHTML = `
    <div class="cab"><img src="../logo-urutau.png" alt="Urutau Jigs"><div class="emp"><h1>ORÇAMENTO Nº ${esc(orc.numero)}</h1>Emitido em ${fmtData(orc.data)}<br>${emp}</div></div>
    <div class="meta">
      <div class="box"><b>Cliente (${orc.tipo === 'lojista' ? 'Lojista' : 'Consumidor'})</b>${esc(c.nome) || '—'}${c.doc ? '<br>CPF/CNPJ: ' + esc(c.doc) : ''}${c.tel ? '<br>Tel.: ' + esc(c.tel) : ''}${c.email ? '<br>' + esc(c.email) : ''}${c.end ? '<br>Entrega: ' + esc(c.end) : ''}</div>
      <div class="box"><b>Condições comerciais</b>${cond.map(([k, v]) => `${k}: ${esc(v)}`).join('<br>')}</div></div>
    <table><thead><tr><th></th><th>Produto</th><th>Gram.</th><th>Cor</th><th class="r">Qtd</th><th class="r">Preço un.</th><th class="r">Subtotal</th></tr></thead><tbody>${linhas || '<tr><td colspan="7">Nenhum item.</td></tr>'}</tbody></table>
    <div class="fim">
      <div class="tot"><div><span>Subtotal (${t.qtd} un.)</span><span>${brl(t.sub)}</span></div>
        ${t.desc ? `<div><span>Desconto${orc.descTipo === 'pct' ? ' (' + String(orc.desc / 100).replace('.', ',') + '%)' : ''}</span><span>− ${brl(t.desc)}</span></div>` : ''}
        ${orc.frete ? `<div><span>Frete</span><span>${brl(orc.frete)}</span></div>` : ''}
        <div class="final"><span>TOTAL</span><span>${brl(t.total)}</span></div></div>
      ${orc.obs.trim() ? `<div class="box" style="margin-bottom:5mm"><b>Observações</b>${esc(orc.obs).replace(/\n/g, '<br>')}</div>` : ''}
      <div class="rod">Urutau Jigs — obrigado pela preferência.</div></div>`;
}
function problemas() {
  const erros = [], avisos = [];
  if (!orc.itens.length) erros.push('Adicione ao menos um produto.');
  if (!orc.cliente.nome.trim()) erros.push('Informe o nome do cliente (aba 2).');
  if (orc.itens.some(i => !i.preco)) avisos.push('Há itens sem preço (R$ 0,00).');
  if (orc.descTipo === 'valor' && orc.desc > calc({ ...orc, desc: 0 }).sub) avisos.push('O desconto é maior que o subtotal e foi limitado.');
  return { erros, avisos };
}
function renderAvisos() {
  const { erros, avisos } = problemas();
  $('avisos').innerHTML = erros.map(m => `<div class="aviso erro">${esc(m)}</div>`).join('') + avisos.map(m => `<div class="aviso">${esc(m)}</div>`).join('');
}

// ── Histórico ────────────────────────────────
function renderHist() {
  const l = [...db.lista].sort((a, b) => b.numero.localeCompare(a.numero));
  $('listaHist').innerHTML = l.length ? l.map(o => `<div class="hist" data-id="${o.id}">
    <span><b>Nº ${esc(o.numero)}</b> · ${esc(o.cliente.nome) || 'sem cliente'} · ${fmtData(o.data)} · <strong>${brl(calc(o).total)}</strong></span>
    <span><button class="btn btn--sm h-abrir">Abrir</button> <button class="btn btn--sm h-dup">Duplicar</button> <button class="btn btn--sm h-del">Excluir</button></span></div>`).join('')
    : '<p class="vazio">Nenhum orçamento salvo ainda.</p>';
}
function salvar(silencioso) {
  lerForm();
  const i = db.lista.findIndex(o => o.id === orc.id);
  orc.salvo = true;
  const copia = JSON.parse(JSON.stringify(orc));
  if (i >= 0) db.lista[i] = copia; else db.lista.push(copia);
  if (persist() && !silencioso) toast('Orçamento salvo.');
  renderHist();
}
function atualizar() { // recalcula tudo e guarda o rascunho em andamento
  renderItens(); renderResumo(); renderFolha(); renderAvisos();
  db.atual = orc; persist();
}
function abrir(o, tab) { orc = JSON.parse(JSON.stringify(o)); preencherForm(); atualizar(); if (tab) aba(tab); }

// ── PDF e WhatsApp ───────────────────────────
function gerarPdf() {
  lerForm(); atualizar();
  const { erros } = problemas();
  if (erros.length) { aba('previa'); return toast(erros[0]); }
  salvar(true);
  const antes = document.title;
  document.title = `orcamento-urutau-${orc.numero}`; // sugere o nome do arquivo ao salvar como PDF
  window.print();
  setTimeout(() => { document.title = antes; }, 1000);
}
function abrirWhatsApp() {
  lerForm(); atualizar();
  const { erros } = problemas();
  if (erros.length) { aba('previa'); return toast(erros[0]); }
  const t = calc(orc);
  const msg = `Olá, ${orc.cliente.nome.trim()}! Segue o orçamento nº ${orc.numero} da Urutau Jigs, no valor total de ${brl(t.total)}. Válido por ${orc.validade} dia(s). Estou enviando o PDF em anexo.`;
  let d = orc.cliente.tel.replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) d = '55' + d;
  const valido = /^55\d{10,11}$/.test(d);
  if (!valido) toast('Telefone do cliente inválido ou vazio: escolha o contato no WhatsApp.');
  window.open(`https://wa.me/${valido ? d : ''}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
}

// ── Navegação / utilidades ───────────────────
function aba(nome) {
  document.querySelectorAll('.aba').forEach(a => a.classList.toggle('on', a.id === 'tab-' + nome));
  document.querySelectorAll('#abas button').forEach(b => b.classList.toggle('on', b.dataset.tab === nome));
  document.body.classList.toggle('tab-previa', nome === 'previa');
  if (nome === 'previa') { lerForm(); atualizar(); }
  if (nome === 'hist') renderHist();
  window.scrollTo({ top: 0 });
}
let tt;
function toast(m) { const t = $('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 2600); }

// ── Eventos ──────────────────────────────────
$('abas').addEventListener('click', e => { const b = e.target.closest('button'); if (b) aba(b.dataset.tab); });
$('busca').addEventListener('input', renderProdutos);
$('filtroCat').addEventListener('change', renderProdutos);
$('listaProdutos').addEventListener('click', e => {
  const b = e.target.closest('.s-add'); if (!b) return;
  const c = b.closest('.prod');
  adicionar(c.dataset.slug, c.querySelector('.s-gram').value, c.querySelector('.s-cor').value, Number(c.querySelector('.s-qtd').value));
});
$('itens').addEventListener('change', e => {
  const tr = e.target.closest('tr'); if (!tr) return;
  const it = orc.itens[Number(tr.dataset.n)];
  if (e.target.classList.contains('i-qtd')) {
    const q = Math.floor(Number(e.target.value));
    if (q >= 1) it.qtd = q; else toast('Quantidade mínima: 1.');
  } else if (e.target.classList.contains('i-preco')) {
    it.preco = parseCents(e.target.value);
    (db.precos[it.slug] ||= {})[orc.tipo] = it.preco; // vira o preço padrão da isca para o tipo
  }
  // atualiza só a linha (reconstruir a tabela aqui quebraria o evento de blur)
  tr.querySelector('.i-qtd').value = it.qtd;
  tr.querySelector('.i-preco').value = centsToField(it.preco);
  tr.querySelector('.num').textContent = brl(it.qtd * it.preco);
  renderResumo(); renderFolha(); renderAvisos(); db.atual = orc; persist();
});
$('itens').addEventListener('click', e => {
  if (!e.target.closest('.i-del')) return;
  orc.itens.splice(Number(e.target.closest('tr').dataset.n), 1); atualizar();
});
$('tipoSeg').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  orc.tipo = b.dataset.tipo;
  orc.itens.forEach(i => { const p = db.precos[i.slug]?.[orc.tipo]; if (p) i.preco = p; }); // aplica a tabela do tipo
  preencherForm(); atualizar();
});
document.querySelectorAll('#tab-dados input, #tab-dados select, #tab-dados textarea').forEach(el =>
  el.addEventListener('input', () => { lerForm(); renderResumo(); renderFolha(); db.atual = orc; persist(); }));
$('btnSalvar').addEventListener('click', () => salvar(false));
$('btnPdf').addEventListener('click', gerarPdf);
$('btnWa').addEventListener('click', abrirWhatsApp);
$('btnNovo').addEventListener('click', () => {
  if (orc.itens.length && !confirm('Começar um novo orçamento? O atual continua salvo apenas se você já clicou em “Salvar rascunho”.')) return;
  orc = novoOrc(); preencherForm(); atualizar(); aba('produtos');
});
$('listaHist').addEventListener('click', e => {
  const row = e.target.closest('.hist'); if (!row) return;
  const o = db.lista.find(x => x.id === row.dataset.id); if (!o) return;
  if (e.target.closest('.h-abrir')) abrir(o, 'produtos');
  else if (e.target.closest('.h-dup')) {
    const n = novoOrc(); abrir({ ...JSON.parse(JSON.stringify(o)), id: n.id, numero: n.numero, data: hoje(), salvo: false }, 'produtos'); toast(`Duplicado como nº ${n.numero}.`);
  } else if (e.target.closest('.h-del') && confirm(`Excluir o orçamento nº ${o.numero}? Esta ação não pode ser desfeita.`)) {
    db.lista = db.lista.filter(x => x.id !== o.id); persist(); renderHist(); toast('Orçamento excluído.');
  }
});

// ── Início ───────────────────────────────────
if (typeof document !== 'undefined' && $('abas')) {
  preencherForm(); atualizar(); aba('produtos');
  carregarCatalogo().then(() => {
    [...new Set(catalogo.map(p => p.cat).filter(Boolean))].forEach(c => $('filtroCat').insertAdjacentHTML('beforeend', `<option value="${esc(c)}">${esc(c[0].toUpperCase() + c.slice(1))}</option>`));
    renderProdutos(); renderFolha();
  }).catch(() => { $('listaProdutos').innerHTML = '<p class="vazio">Não foi possível carregar o catálogo. Abra pelo site (Vercel) ou rode um servidor local, por exemplo: <code>npx serve</code> na pasta do projeto.</p>'; });
}
})();
