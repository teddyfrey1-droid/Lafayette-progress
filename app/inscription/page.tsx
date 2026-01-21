import { Suspense } from "react"

import InscriptionClient from "./InscriptionClient"

export default function InscriptionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-sm text-muted-foreground">Chargement…</div>
        </div>
      }
    >
      <InscriptionClient />
    </Suspense>
  )
}
