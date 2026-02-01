"use client"

import { useAuth } from "@/components/auth/auth-provider"
import { useTheme } from "next-themes"
import { useRouter } from "next/navigation"
import { 
  User, Shield, Link as LinkIcon, Sliders, Users, Moon, Bell, 
  Palette, HelpCircle, LogOut, ChevronRight, Mail
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { defaultCompanyEmailSettings, loadCompanyEmailSettings, saveCompanyEmailSettings, CompanyEmailSettings } from "@/lib/email-settings"
import { useToast } from "@/hooks/use-toast"

export default function SettingsPage() {
  const { profile, signOut, user } = useAuth()
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const { toast } = useToast()
  
  const [openEmails, setOpenEmails] = useState(false)
  const [emailSettings, setEmailSettings] = useState<CompanyEmailSettings>(defaultCompanyEmailSettings())

  const handleOpenEmails = async () => {
      if(profile?.companyId) {
          try {
             const s = await loadCompanyEmailSettings(profile.companyId)
             setEmailSettings(s)
          } catch(e) {}
      }
      setOpenEmails(true)
  }
  
  const saveEmails = async () => {
      if(profile?.companyId) {
          await saveCompanyEmailSettings(profile.companyId, emailSettings)
          toast({ title: "Sauvegardé", description: "Les destinataires ont été mis à jour." })
          setOpenEmails(false)
      }
  }

  const initials = profile?.displayName 
    ? profile.displayName.split(" ").map((n:string) => n[0]).join("").substring(0, 2).toUpperCase()
    : (profile?.email?.substring(0, 2).toUpperCase() || "??")

  return (
    <div className="min-h-screen bg-muted/5 pb-32">
      <Header />

      <main className="px-4 py-6 max-w-lg mx-auto space-y-8">
        <div>
            <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>
        </div>

        {/* COMPTE */}
        <section className="space-y-3">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">Compte</h2>
            <div className="pulse-card p-4 flex items-center gap-4 bg-white rounded-3xl shadow-sm border border-border/40">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary text-lg font-bold">
                    {initials}
                </div>
                <div>
                    <h3 className="font-bold text-lg">{profile?.displayName || "Utilisateur"}</h3>
                    <p className="text-sm text-muted-foreground">{profile?.email}</p>
                </div>
            </div>
        </section>

        {/* FONCTIONNALITÉS */}
        <section className="space-y-3">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">Fonctionnalités</h2>
            <div className="bg-white rounded-3xl overflow-hidden border border-border/40 shadow-sm divide-y divide-border/30">
                 {/* LE BOUTON MAGIQUE POUR LES EMAILS */}
                 <MenuItem 
                    icon={Mail} 
                    label="Notifications & Rapports" 
                    subLabel="Gérer les destinataires automatiques (CC/BCC)"
                    onClick={handleOpenEmails}
                />
            </div>
        </section>

        {/* SUPPORT - Conservé comme demandé */}
        <section className="space-y-3">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">Support</h2>
            <div className="bg-white rounded-3xl overflow-hidden border border-border/40 shadow-sm divide-y divide-border/30">
                <MenuItem icon={Bell} label="Notifications" subLabel="Gérer les alertes" />
                <MenuItem icon={Palette} label="Thème" subLabel="Personnaliser l'apparence" />
                <MenuItem icon={HelpCircle} label="Aide" subLabel="FAQ et documentation" />
            </div>
        </section>

        {/* DÉCONNEXION */}
        <div className="pt-4">
            <Button variant="destructive" className="w-full h-12 rounded-xl" onClick={() => signOut()}>
                <LogOut className="w-4 h-4 mr-2" /> Se déconnecter
            </Button>
        </div>

      </main>

      {/* DIALOGUE EMAILS SIMPLIFIÉ */}
      <Dialog open={openEmails} onOpenChange={setOpenEmails}>
          <DialogContent className="rounded-3xl max-w-sm">
              <DialogHeader>
                  <DialogTitle>Rapports automatiques</DialogTitle>
                  <DialogDescription>
                      Les adresses ci-dessous recevront une copie de tous les bons de commande et réceptions.
                  </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                  <div>
                      <label className="text-xs font-semibold mb-1 block">Emails (séparés par virgule)</label>
                      <Textarea 
                          className="rounded-xl bg-muted/30 border-0 min-h-[100px]" 
                          placeholder="compta@monresto.fr, chef@monresto.fr"
                          value={emailSettings.order.emails.join(", ")}
                          onChange={(e) => {
                              const val = e.target.value.split(/[,;\s]+/).filter(Boolean)
                              setEmailSettings(prev => ({
                                  ...prev, 
                                  order: { ...prev.order, emails: val },
                                  receiptOk: { ...prev.receiptOk, emails: val }, // Sync simple pour l'utilisateur
                                  receiptIssue: { ...prev.receiptIssue, emails: val }
                              }))
                          }}
                      />
                  </div>
                  <Button onClick={saveEmails} className="w-full rounded-xl">Enregistrer</Button>
              </div>
          </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  )
}

function MenuItem({ icon: Icon, label, subLabel, onClick }: any) {
    return (
        <button onClick={onClick} className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors text-left">
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-muted/50 flex items-center justify-center text-foreground"><Icon className="w-4 h-4" /></div>
                <div><p className="font-semibold text-sm">{label}</p>{subLabel && <p className="text-xs text-muted-foreground">{subLabel}</p>}</div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
        </button>
    )
}
