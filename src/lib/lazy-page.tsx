import { lazy, type ComponentType } from 'react'

type PageModule = Record<string, ComponentType>

const loaders: (() => Promise<void>)[] = []

/**
 * Página carregada à parte (o seu código só é descarregado quando é aberta) e que pode ser
 * pré-carregada: depois de `preloadPages()`, renderiza logo, sem passar pelo <Suspense>.
 */
export function lazyPage<T extends PageModule>(load: () => Promise<T>, name: keyof T) {
  let Loaded: ComponentType | undefined
  const preload = () =>
    load().then((module) => {
      Loaded = module[name]
      return { default: Loaded }
    })
  const Lazy = lazy(preload)
  loaders.push(() => preload().then(() => undefined))

  function Page() {
    return Loaded ? <Loaded /> : <Lazy />
  }
  Page.displayName = `Page(${String(name)})`
  return Page
}

/** Descarrega já o código de todas as páginas (usado nos testes, que renderizam de forma síncrona). */
export function preloadPages(): Promise<void[]> {
  return Promise.all(loaders.map((loader) => loader()))
}
