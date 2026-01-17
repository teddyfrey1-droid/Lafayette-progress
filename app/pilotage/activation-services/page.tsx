"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { MODULES, ROLES, DEFAULT_PERMISSIONS } from "@/lib/permissions-config"
import { db } from "@/lib/firebase/client"
import { doc, setDoc, getDoc } from "firebase/firestore"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Loader2, Save, ShieldAlert, ArrowLeft } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { PermissionGate } from "@/components/auth/permission-gate"
import Link from "next/link"

export default function ServiceActivationPage() {
  // On protège cette page critique via le module "parametres" ou "pilotage"
  return (
    <PermissionGate moduleId="parametres" redirect>
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
      toast({ 
        title: "Configuration sauvegardée", 
        description: "Les restrictions d'accès sont actives immédiatement.", 
        variant: "success" 
      })
    } catch (e) {
      toast({ title: "Erreur", description: "Impossible de sauvegarder.", variant: "destructive" })
    }
    setSaving(false)
  }

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary" /></div>

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />
      <main className="px-4 py-6 max-w-5xl mx-auto space-y-6">
        <Link href="/pilotage" className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="w-4 h-4" /> Retour Pilotage
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Activation des Services</h1>
            <p className="text-muted-foreground text-sm">Contrôle d'accès temps réel par rôle.</p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="rounded-xl gap-2 pulse-gradient text-white">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Appliquer les changements
          </Button>
        </div>

        <div className="pulse-card overflow-hidden border border-border">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground uppercase text-xs">
                    <tr>
                    <th className="px-4 py-4 font-medium min-w-[200px]">Module / Service</th>
                    {ROLES.map(role => (
                        <th key={role.id} className="px-4 py-4 text-center font-medium min-w-[100px]">{role.label}</th>
                    ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {MODULES.map(module => (
                    <tr key={module.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-4 font-semibold text-foreground">
                            {module.label}
                        </td>
                        {ROLES.map(role => {
                        const isAllowed = (permissions[module.id] || []).includes(role.id)
                        return (
                            <td key={role.id} className="px-4 py-4 text-center">
                            <Switch 
                                checked={isAllowed}
                                onCheckedChange={() => togglePermission(module.id, role.id)}
                                className="data-[state=checked]:bg-primary"
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

        <div className="flex gap-3 p-4 bg-orange-50 dark:bg-orange-900/10 text-orange-800 dark:text-orange-200 rounded-xl text-sm items-start border border-orange-100 dark:border-orange-900/20">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
            <p>
                <strong>Attention :</strong> Les modifications s'appliquent instantanément à tous les utilisateurs connectés.
                Si vous désactivez l'accès "Paramètres" pour votre propre rôle, vous ne pourrez plus revenir sur cette page pour le réactiver (sauf intervention via la base de données).
            </p>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
