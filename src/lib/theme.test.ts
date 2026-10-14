import { describe, expect, it } from 'vitest'
import { isTheme, nextTheme, resolveTheme } from './theme'

describe('resolveTheme', () => {
  it('respeita a escolha explícita', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('"system" segue a preferência do sistema', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })
})

describe('nextTheme', () => {
  it('percorre Claro → Escuro → Sistema → Claro', () => {
    expect(nextTheme('light')).toBe('dark')
    expect(nextTheme('dark')).toBe('system')
    expect(nextTheme('system')).toBe('light')
  })
})

describe('isTheme', () => {
  it('aceita só valores válidos', () => {
    expect(isTheme('dark')).toBe(true)
    expect(isTheme('azul')).toBe(false)
    expect(isTheme(null)).toBe(false)
  })
})
