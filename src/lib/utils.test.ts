import { describe, expect, it } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('junta classes e resolve conflitos do Tailwind (a última ganha)', () => {
    expect(cn('p-2', 'text-sm', 'p-4')).toBe('text-sm p-4')
  })

  it('ignora valores falsos', () => {
    const ativo = false
    expect(cn('a', ativo && 'b', undefined, 'c')).toBe('a c')
  })
})
