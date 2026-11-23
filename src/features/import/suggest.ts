import { normalize } from './parse'

// Categoria e pessoa sugeridas para uma linha importada (docs/features/importar.md, regra 5).

export type HistoryItem = {
  descricao: string
  category_id: string
  pessoa_id: string | null
  tipo: string
}

/** "Merc Acougue Autodromo *123" → "merc acougue" (as duas primeiras palavras, sem números). */
export function descriptionKey(description: string): string {
  return normalize(description)
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1 && !['pg', 'mp', 'ec', 'pag'].includes(word))
    .slice(0, 2)
    .join(' ')
}

/** Palavra-chave → nome da categoria inicial (só se o utilizador ainda tiver essa categoria). */
const KEYWORDS: [RegExp, string][] = [
  [
    /mercad(o|inho)(?!\s?(livre|pago))|acougue|padaria|ifood|restaurante|lanchonete|pastel|acai|pizza|burger|hortifruti|atacad|supermerc|cafe/,
    'Alimentação',
  ],
  [/uber|\b99\b|posto|combust|shell|ipiranga|estaciona|pedagio|onibus|metro/, 'Transporte'],
  [/farmacia|drogaria|droga|raia|pague menos|hospital|clinica|medic|doutor|dentist/, 'Saúde'],
  [/netflix|spotify|cinema|ingresso|show|disney|prime video|hbo|steam|playstation/, 'Lazer'],
  [
    /shopee|mercado ?livre|amazon|magalu|magazine|shein|aliexpress|americanas|renner|riachuelo|loja/,
    'Compras',
  ],
  [
    /\bluz\b|energia|enel|cemig|copel|agua|sabesp|internet|vivo|claro|\btim\b|\boi\b|net |gas/,
    'Contas e serviços',
  ],
  [/aluguel|condominio|iptu/, 'Moradia'],
  [/escola|faculdade|curso|udemy|alura/, 'Educação'],
  [/salario|folha|pagamento de salario/, 'Salário'],
]

/**
 * Sugestão para uma linha: a categoria (e a pessoa) do lançamento mais recente com a mesma
 * descrição; senão, por palavras; senão, "Outras despesas"/"Outras receitas".
 */
export function suggestFor(
  description: string,
  tipo: 'despesa' | 'receita',
  history: readonly HistoryItem[],
  categories: readonly { id: string; nome: string; tipo: string; arquivada: boolean }[],
): { categoryId: string; pessoaId: string | null } {
  const active = categories.filter((category) => category.tipo === tipo && !category.arquivada)
  const ids = new Set(active.map((category) => category.id))
  const key = descriptionKey(description)
  if (key) {
    // O histórico vem do mais antigo para o mais recente: procura-se do fim
    for (let i = history.length - 1; i >= 0; i--) {
      const item = history[i]
      if (
        item.tipo === tipo &&
        ids.has(item.category_id) &&
        descriptionKey(item.descricao) === key
      ) {
        return { categoryId: item.category_id, pessoaId: item.pessoa_id }
      }
    }
  }
  const text = normalize(description)
  const byName = (nome: string) => active.find((category) => category.nome === nome)?.id
  for (const [pattern, nome] of KEYWORDS) {
    const id = pattern.test(text) ? byName(nome) : undefined
    if (id) return { categoryId: id, pessoaId: null }
  }
  return {
    categoryId:
      byName(tipo === 'despesa' ? 'Outras despesas' : 'Outras receitas') ?? active[0]?.id ?? '',
    pessoaId: null,
  }
}
