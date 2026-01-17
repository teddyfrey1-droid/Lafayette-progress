"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { MODULES, ROLES, DEFAULT_PERMISSIONS } from "@/lib/permissions-config"
import { db } from "@/lib/firebase/client"
import { doc, setDoc, getDoc } from "firebase/firestore"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Loader2, Save, ShieldAlert } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { PermissionGate } from "@/components/auth/permission-gate"

export default function ServiceActivationPage() {
  return (
    // On protège cette page elle-même via le droit "pilotage" ou un droit spécifique "admin_config"
    <PermissionGate moduleId="pilotage" redirect> 
      <ServiceConfigContent />
    </PermissionGate>
  )
}

function ServiceConfigContent() {
  const { toast } = useToast()
  const [permissions, setPermissions] = useState<Record<string, string[]>>(DEFAULT_PERMISSIONS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      const snap = await getDoc(doc(db, "settings", "permissions"))
      if (snap.exists()) {
        setPermissions(snap.data() as Record<string, string[]>)
      }
      setLoading(false)
    }
    load()
  }, [])

  const togglePermission = (moduleId: string, roleId: string) => {
    setPermissions(prev => {
      const currentRoles = prev[moduleId] || []
      const hasRole = currentRoles.includes(roleId)
      
      let newRoles
      if (hasRole) {
        newRoles = currentRoles.filter(r => r !== roleId)
      } else {
        newRoles = [...currentRoles, roleId]
      }
      
      return { ...prev, [moduleId]: newRoles }
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await setDoc(doc(db, "settings", "permissions"), permissions)
      toast({ title: "Configuration sauvegardée", description: "Les droits d'accès ont été mis à jour immédiatement.", variant: "success" })
    } catch (e) {
      toast({ title: "Erreur", description: "Impossible de sauvegarder.", variant: "destructive" })
    }
    setSaving(false)
  }

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />
      <main className="px-4 py-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Activation des Services</h1>
            <p className="text-muted-foreground text-sm">Définissez qui peut accéder à quoi.</p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="rounded-xl gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Enregistrer
          </Button>
        </div>

        <div className="pulse-card overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground uppercase text-xs">
                    <tr>
                    <th className="px-4 py-3 font-medium">Module / Service</th>
                    {ROLES.map(role => (
                        <th key={role.id} className="px-4 py-3 text-center font-medium">{role.label}</th>
                    ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {MODULES.map(module => (
                    <tr key={module.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-medium">
                            {module.label}
                            {module.id === "pilotage" && <span className="block text-[10px] text-orange-500 font-normal">Attention: bloque l'accès à cette section</span>}
                        </td>
                        {ROLES.map(role => {
                        const isAllowed = (permissions[module.id] || []).includes(role.id)
                        return (
                            <td key={role.id} className="px-4 py-3 text-center">
                            <Switch 
                                checked={isAllowed}
                                onCheckedChange={() => togglePermission(module.id, role.id)}
                            />
                            </td>
                        )
                        })}
                    </tr>
                    ))}
                </tbody>
                </table>
            </div>
        </div>

        <div className="flex gap-3 p-4 bg-blue-50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-200 rounded-xl text-sm items-start">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
            <p>
                <strong>Note importante :</strong> Les changements sont immédiats. Si vous retirez votre propre rôle du module "Pilotage", vous serez immédiatement redirigé et ne pourrez plus accéder à cette page de configuration (sauf intervention technique).
            </p>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
