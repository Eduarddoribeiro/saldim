import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from '@/components/ui/card'

export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        {/* h1 real (o CardTitle do shadcn é um div): cada página tem um título principal */}
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
      {footer && (
        <CardFooter className="flex-col gap-2 text-sm text-muted-foreground">{footer}</CardFooter>
      )}
    </Card>
  )
}
