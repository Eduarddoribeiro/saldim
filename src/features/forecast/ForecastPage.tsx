import { PageHeader } from '@/components/layout/PageHeader'
import { ForecastCard } from './ForecastCard'

/** A previsão do fim do mês que vem (/previsao), aberta pelo bloco do Início. */
export function ForecastPage() {
  return (
    <>
      <PageHeader
        title="Previsão"
        description="Como fica o seu dinheiro depois de pagar tudo e receber o que está previsto."
      />
      <div className="md:max-w-2xl">
        <ForecastCard />
      </div>
    </>
  )
}
