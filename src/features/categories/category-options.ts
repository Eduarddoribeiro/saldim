import {
  Baby,
  Banknote,
  BookOpen,
  Briefcase,
  Bus,
  Car,
  Coffee,
  Coins,
  Droplet,
  Dumbbell,
  Film,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  Music,
  PartyPopper,
  PawPrint,
  PiggyBank,
  Pill,
  Plane,
  Receipt,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Tag,
  TrendingUp,
  Utensils,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react'

// Cores e ícones guardados na base como CHAVES (ex.: "orange", "utensils"), não como valores visuais:
// assim a mesma categoria adapta-se ao tema claro/escuro e podemos mudar o visual sem migrar dados.
// As chaves de cor TÊM de coincidir com o CHECK de categories.cor na migration.

export const CATEGORY_COLORS = {
  slate: {
    label: 'Cinza',
    badge: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
    swatch: 'bg-slate-500',
  },
  red: {
    label: 'Vermelho',
    badge: 'bg-red-500/15 text-red-700 dark:text-red-300',
    swatch: 'bg-red-500',
  },
  orange: {
    label: 'Laranja',
    badge: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
    swatch: 'bg-orange-500',
  },
  amber: {
    label: 'Âmbar',
    badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    swatch: 'bg-amber-500',
  },
  green: {
    label: 'Verde',
    badge: 'bg-green-500/15 text-green-700 dark:text-green-300',
    swatch: 'bg-green-500',
  },
  teal: {
    label: 'Verde-azulado',
    badge: 'bg-teal-500/15 text-teal-700 dark:text-teal-300',
    swatch: 'bg-teal-500',
  },
  sky: {
    label: 'Azul-céu',
    badge: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
    swatch: 'bg-sky-500',
  },
  blue: {
    label: 'Azul',
    badge: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
    swatch: 'bg-blue-500',
  },
  violet: {
    label: 'Violeta',
    badge: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
    swatch: 'bg-violet-500',
  },
  pink: {
    label: 'Rosa',
    badge: 'bg-pink-500/15 text-pink-700 dark:text-pink-300',
    swatch: 'bg-pink-500',
  },
} as const

export type CategoryColor = keyof typeof CATEGORY_COLORS
export const COLOR_KEYS = Object.keys(CATEGORY_COLORS) as [CategoryColor, ...CategoryColor[]]

export const CATEGORY_ICONS = {
  tag: { label: 'Etiqueta', icon: Tag },
  utensils: { label: 'Refeição', icon: Utensils },
  'shopping-cart': { label: 'Supermercado', icon: ShoppingCart },
  coffee: { label: 'Café', icon: Coffee },
  house: { label: 'Casa', icon: House },
  zap: { label: 'Eletricidade', icon: Zap },
  droplet: { label: 'Água', icon: Droplet },
  wifi: { label: 'Internet', icon: Wifi },
  smartphone: { label: 'Celular', icon: Smartphone },
  receipt: { label: 'Fatura', icon: Receipt },
  car: { label: 'Carro', icon: Car },
  fuel: { label: 'Combustível', icon: Fuel },
  bus: { label: 'Transporte público', icon: Bus },
  plane: { label: 'Viagem', icon: Plane },
  'heart-pulse': { label: 'Saúde', icon: HeartPulse },
  pill: { label: 'Farmácia', icon: Pill },
  dumbbell: { label: 'Esporte', icon: Dumbbell },
  'graduation-cap': { label: 'Educação', icon: GraduationCap },
  'book-open': { label: 'Livros', icon: BookOpen },
  baby: { label: 'Filhos', icon: Baby },
  'paw-print': { label: 'Animais', icon: PawPrint },
  'party-popper': { label: 'Lazer', icon: PartyPopper },
  film: { label: 'Cinema', icon: Film },
  music: { label: 'Música', icon: Music },
  'gamepad-2': { label: 'Jogos', icon: Gamepad2 },
  'shopping-bag': { label: 'Compras', icon: ShoppingBag },
  shirt: { label: 'Roupa', icon: Shirt },
  gift: { label: 'Presentes', icon: Gift },
  sparkles: { label: 'Beleza', icon: Sparkles },
  wrench: { label: 'Manutenção', icon: Wrench },
  briefcase: { label: 'Trabalho', icon: Briefcase },
  banknote: { label: 'Dinheiro', icon: Banknote },
  coins: { label: 'Moedas', icon: Coins },
  'piggy-bank': { label: 'Poupança', icon: PiggyBank },
  'trending-up': { label: 'Investimentos', icon: TrendingUp },
  landmark: { label: 'Banco', icon: Landmark },
} satisfies Record<string, { label: string; icon: LucideIcon }>

export type CategoryIcon = keyof typeof CATEGORY_ICONS
export const ICON_KEYS = Object.keys(CATEGORY_ICONS) as [CategoryIcon, ...CategoryIcon[]]

/** Valores vindos da base podem ser chaves antigas/desconhecidas: caímos sempre num valor seguro. */
export function colorOf(key: string) {
  return CATEGORY_COLORS[key as CategoryColor] ?? CATEGORY_COLORS.slate
}

export function iconOf(key: string): LucideIcon {
  return (CATEGORY_ICONS[key as CategoryIcon] ?? CATEGORY_ICONS.tag).icon
}
