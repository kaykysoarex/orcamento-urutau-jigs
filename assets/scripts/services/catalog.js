export async function loadCatalog() {
  const response = await fetch('../index.html');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const source = new DOMParser().parseFromString(await response.text(), 'text/html');
  return [...source.querySelectorAll('.produto-card[data-slug]')].map((card) => ({
    slug: card.dataset.slug,
    nome: card.dataset.nome,
    cat: card.dataset.categoria || '',
    gram: (card.dataset.gramaturas || '').split(',').filter(Boolean),
    cores: [...card.querySelectorAll('.cor-item')].map((color) => ({
      nome: color.dataset.nome,
      img: `../${color.dataset.img}`,
    })),
  }));
}

export const findProduct = (catalog, slug) => catalog.find((product) => product.slug === slug);

export function findThumbnail(catalog, slug, colorName) {
  const product = findProduct(catalog, slug);
  return (product?.cores.find((color) => color.nome === colorName) || product?.cores[0])?.img || '';
}
