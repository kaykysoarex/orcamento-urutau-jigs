# Arquitetura e revisão

## Organização

- `assets/styles/`: base visual, estrutura de página e componentes, nesta ordem.
- `assets/scripts/core/`: regras puras de orçamento, formatação e validação.
- `assets/scripts/services/`: integrações com `localStorage` e com o catálogo principal.
- `assets/scripts/ui/`: renderização do DOM.
- `assets/scripts/app.js`: estado da tela, eventos e orquestração dos módulos.
- `tests/`: testes das regras de negócio sem dependência do navegador.

## Pontos corrigidos na revisão

1. A tela anterior concentrava armazenamento, cálculo, DOM, eventos e integrações em um único arquivo. Essas responsabilidades agora estão separadas e importadas como módulos ES.
2. A troca para uma tabela de preços cujo valor fosse `R$ 0,00` era ignorada por uma verificação de valor truthy. Agora o valor é aplicado sempre que estiver definido, inclusive zero.
3. A marcação recebeu regiões semânticas, rótulos de formulário, botões com `type="button"`, estados ARIA nas abas e áreas de atualização anunciáveis.
4. Cálculo, dinheiro e telefone ganharam testes automatizados.

## Dependência mantida

O catálogo continua sendo lido de `../index.html`, que é a fonte única de produtos do site principal. Essa dependência foi isolada em `assets/scripts/services/catalog.js`; uma futura API ou arquivo JSON poderá substituí-la sem alterar a interface ou as regras de orçamento.
