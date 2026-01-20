import { Suspense } from "react"

import ConnexionClient from "./ConnexionClient"

export default function ConnexionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-sm text-muted-foreground">Chargement…</div>
        </div>
      }
    >
      <ConnexionClient />
    </Suspense>
  )
}
