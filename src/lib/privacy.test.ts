// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  PRIVACY_CLASS,
  PRIVACY_STORAGE_KEY,
  applyHiddenValues,
  readHiddenValues,
  storeHiddenValues,
} from './privacy'

afterEach(() => {
  localStorage.clear()
  document.documentElement.className = ''
  vi.restoreAllMocks()
})

describe('esconder valores', () => {
  it('guarda e lê a escolha', () => {
    expect(readHiddenValues()).toBe(false)
    storeHiddenValues(true)
    expect(localStorage.getItem(PRIVACY_STORAGE_KEY)).toBe('1')
    expect(readHiddenValues()).toBe(true)
    storeHiddenValues(false)
    expect(localStorage.getItem(PRIVACY_STORAGE_KEY)).toBeNull()
    expect(readHiddenValues()).toBe(false)
  })

  it('sem armazenamento disponível, mostra os valores e não parte', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    expect(readHiddenValues()).toBe(false)
    expect(() => storeHiddenValues(true)).not.toThrow()
  })

  it('aplica e retira a classe no <html>', () => {
    applyHiddenValues(true)
    expect(document.documentElement).toHaveClass(PRIVACY_CLASS)
    applyHiddenValues(false)
    expect(document.documentElement).not.toHaveClass(PRIVACY_CLASS)
  })
})
