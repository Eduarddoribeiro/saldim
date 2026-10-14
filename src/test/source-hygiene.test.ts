import { describe, expect, it } from 'vitest'

// Caracteres invisíveis (espaços não separáveis, zero-width…) no código são quase sempre acidentais e
// tornam regex/strings impossíveis de ler. Usa-se a sequência de escape (ex.: \u00a0) em vez do carácter.
const INVISIBLE = /[\u00a0\u200b-\u200d\u202f\u2060\ufeff]/

const sources = import.meta.glob(['/src/**/*.{ts,tsx,css}', '/tests/**/*.ts', '/e2e/**/*.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

describe('higiene do código-fonte', () => {
  it('encontra ficheiros para verificar', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(20)
  })

  it('nenhum ficheiro tem caracteres invisíveis', () => {
    const offenders = Object.entries(sources)
      .filter(([, text]) => INVISIBLE.test(text))
      .map(([file]) => file)
    expect(offenders).toEqual([])
  })
})
