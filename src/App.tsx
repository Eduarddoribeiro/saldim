import { Button } from '@/components/ui/button'

function App() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Finanças</h1>
      <p className="text-muted-foreground">O teu controlo financeiro pessoal.</p>
      <Button>Começar</Button>
    </main>
  )
}

export default App
