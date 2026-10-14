// O Supabase devolve no máximo `max_rows` linhas por pedido (1000, em supabase/config.toml) e CORTA o
// resto sem erro. Para cálculos que precisam de TODAS as linhas (ex.: saldo), pedimos página a página.

export const PAGE_SIZE = 1000

type PageResult<T> = { data: T[] | null; error: { code?: string; message?: string } | null }

/**
 * Junta todas as páginas de uma consulta. `page(from, to)` deve aplicar `.range(from, to)` a uma
 * consulta com ORDEM TOTAL (ex.: `.order('data').order('id')`), senão linhas podem repetir-se ou
 * faltar entre páginas.
 */
export async function fetchAllPages<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize = PAGE_SIZE,
): Promise<{ data: T[]; error: PageResult<T>['error'] }> {
  const rows: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1)
    if (error) return { data: rows, error }
    rows.push(...(data ?? []))
    // Página incompleta = última página
    if (!data || data.length < pageSize) return { data: rows, error: null }
  }
}
