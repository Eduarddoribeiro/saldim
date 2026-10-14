import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Desmonta o que cada teste renderizou, para os testes não interferirem entre si
afterEach(() => cleanup())
