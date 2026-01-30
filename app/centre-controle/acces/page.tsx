"use client"

import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { PermissionGate } from "@/components/auth/permission-gate"
import { PermissionsManager } from "@/components/permissions/permissions-manager"

export default function CentreControleAccesPage() {
  // Centre de contrôle : réservé aux profils autorisés (admin / super_admin).
  return (
    <PermissionGate moduleId="centre_controle" redirect>
      <div className="min-h-screen bg-background pb-32">
        <Header />
        <PermissionsManager backHref="/centre-controle" title="Gestion des droits" />
        <BottomNav />
      </div>
    </PermissionGate>
  )
}
