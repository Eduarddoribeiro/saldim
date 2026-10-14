import { Tag } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import {
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  colorOf,
  COLOR_KEYS,
  ICON_KEYS,
  iconOf,
} from './category-options'
// ?raw: o Vite importa o ficheiro como texto (sem precisar de APIs do Node no código da app)
import migration from '../../../supabase/migrations/20261014182859_categories.sql?raw'

describe('opções de categorias', () => {
  it('as cores coincidem exatamente com o CHECK da base de dados', () => {
    const check = migration.match(/check \(cor in \(([^)]*)\)\)/)?.[1] ?? ''
    const dbColors = [...check.matchAll(/'([a-z]+)'/g)].map((match) => match[1])
    expect(dbColors.sort()).toEqual([...COLOR_KEYS].sort())
  })

  it('os ícones das categorias iniciais existem na lista', () => {
    const seededIcons = [
      ...migration.matchAll(/'(?:despesa|receita)', '[a-z]+', '([a-z0-9-]+)'\)/g),
    ].map((match) => match[1])
    expect(seededIcons.length).toBe(12)
    for (const icon of seededIcons) expect(ICON_KEYS).toContain(icon)
  })

  it('as chaves de ícone respeitam o formato aceite pela base (a-z, 0-9, hífen)', () => {
    for (const key of ICON_KEYS) expect(key).toMatch(/^[a-z0-9-]{1,40}$/)
  })

  it('todas as cores e ícones têm nome em português (usado por leitores de ecrã)', () => {
    for (const color of Object.values(CATEGORY_COLORS)) expect(color.label).not.toBe('')
    for (const icon of Object.values(CATEGORY_ICONS)) expect(icon.label).not.toBe('')
  })

  it('valores desconhecidos caem num valor seguro', () => {
    expect(colorOf('fucsia')).toBe(CATEGORY_COLORS.slate)
    expect(iconOf('nao-existe')).toBe(Tag)
    expect(iconOf('car')).toBe(CATEGORY_ICONS.car.icon)
  })
})
