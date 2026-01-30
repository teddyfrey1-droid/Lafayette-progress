"use client"

import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { PermissionGate } from "@/components/auth/permission-gate"
import { PermissionsManager } from "@/components/permissions/permissions-manager"

export default function GestionAccesPage() {
  // Accessible depuis le Hub de Gestion.
  // Double sécurité : il faut voir le hub + avoir des droits d'édition (Paramètres ou Centre de contrôle)
  return (
    <PermissionGate moduleId="gestion" redirect>
      <PermissionGate moduleId={["parametres", "centre_controle"]} match="any" requireEdit redirect>
        <div className="min-h-screen bg-background pb-32">
          <Header />

          <PermissionsManager backHref="/dashboard" />

          <BottomNav />
        </div>
      </PermissionGate>
    </PermissionGate>
  )
}
