"use client"

import { useState } from "react"
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { useAuth } from "@/components/auth/auth-provider"
import { updateEmail, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth"
import { ArrowLeft, Lock, Mail, Save, Loader2, AlertCircle, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"

export default function SecurityPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  
  const [newEmail, setNewEmail] = useState(user?.email || "")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [currentPassword, setCurrentPassword] = useState("") 
  
  const [isLoading, setIsLoading] = useState(false)

  // Re-connexion silencieuse pour valider les changements sensibles
  const reauthenticate = async (password: string) => {
    if (!user || !user.email) return false;
    const credential = EmailAuthProvider.credential(user.email, password);
    try {
      await reauthenticateWithCredential(user, credential);
      return true;
    } catch (e) {
      toast({ title: "Mot de passe incorrect", description: "Impossible de vérifier votre identité.", variant: "destructive" });
      return false;
    }
  }

  const handleUpdateEmail = async () => {
    if (!newEmail || newEmail === user?.email) return;
    if (!currentPassword) {
        toast({ title: "Validation requise", description: "Entrez votre mot de passe actuel pour confirmer.", variant: "destructive" });
        return;
    }

    setIsLoading(true);
    const isAuth = await reauthenticate(currentPassword);
    if (isAuth && user) {
        try {
            await updateEmail(user, newEmail);
            toast({ title: "Email mis à jour", description: "Votre adresse email a été modifiée.", variant: "success" });
            setCurrentPassword("");
        } catch (e: any) {
            toast({ title: "Erreur", description: "Cet email est peut-être déjà utilisé ou invalide.", variant: "destructive" });
        }
    }
    setIsLoading(false);
  }

  const handleUpdatePassword = async () => {
    if (!newPassword) return;
    if (newPassword.length < 6) {
        toast({ title: "Mot de passe trop court", description: "Il doit contenir au moins 6 caractères.", variant: "destructive" });
        return;
    }
    if (newPassword !== confirmPassword) {
        toast({ title: "Erreur", description: "Les mots de passe ne correspondent pas.", variant: "destructive" });
        return;
    }
    if (!currentPassword) {
        toast({ title: "Validation requise", description: "Entrez votre mot de passe actuel pour confirmer.", variant: "destructive" });
        return;
    }

    setIsLoading(true);
    const isAuth = await reauthenticate(currentPassword);
    if (isAuth && user) {
        try {
            await updatePassword(user, newPassword);
            toast({ title: "Mot de passe modifié", description: "Utilisez le nouveau mot de passe à la prochaine connexion.", variant: "success" });
            setNewPassword("");
            setConfirmPassword("");
            setCurrentPassword("");
        } catch (e: any) {
            toast({ title: "Erreur", description: "Impossible de modifier le mot de passe.", variant: "destructive" });
        }
    }
    setIsLoading(false);
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />

      <main className="px-4 py-6 max-w-lg mx-auto space-y-6">
        <Link href="/parametres" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Retour</span>
        </Link>

        <div>
            <h1 className="text-2xl font-bold tracking-tight">Sécurité</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Gérez vos identifiants de connexion</p>
        </div>

        {/* Alerte Sécurité */}
        <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl flex gap-3 text-sm text-blue-600">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p>Par mesure de sécurité, vous devrez saisir votre <strong>mot de passe actuel</strong> pour valider tout changement.</p>
        </div>

        {/* MODIFIER EMAIL */}
        <section className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 px-1">
                <Mail className="w-4 h-4" /> Adresse Email
            </h2>
            <div className="pulse-card p-5 space-y-4">
                <div className="space-y-2">
                    <Label>Nouvel Email</Label>
                    <Input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="exemple@email.com" className="bg-background" />
                </div>
                
                {newEmail !== user?.email && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2 pt-2 border-t border-border/50">
                        <Label>Mot de passe actuel (Validation)</Label>
                        <Input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="bg-background" placeholder="••••••••" />
                        <Button className="w-full mt-2 rounded-xl" onClick={handleUpdateEmail} disabled={isLoading}>
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                            Enregistrer l'email
                        </Button>
                    </div>
                )}
            </div>
        </section>

        {/* MODIFIER MOT DE PASSE */}
        <section className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 px-1">
                <Lock className="w-4 h-4" /> Mot de passe
            </h2>
            <div className="pulse-card p-5 space-y-4">
                <div className="space-y-2">
                    <Label>Nouveau mot de passe</Label>
                    <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="bg-background" placeholder="••••••••" />
                </div>
                <div className="space-y-2">
                    <Label>Confirmer le mot de passe</Label>
                    <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="bg-background" placeholder="••••••••" />
                </div>
                
                {newPassword.length > 0 && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2 pt-2 border-t border-border/50">
                        <Label>Mot de passe actuel (Validation)</Label>
                        <Input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="bg-background" placeholder="••••••••" />
                        <Button className="w-full mt-2 rounded-xl" onClick={handleUpdatePassword} disabled={isLoading}>
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                            Mettre à jour le mot de passe
                        </Button>
                    </div>
                )}
            </div>
        </section>

      </main>
      <BottomNav />
    </div>
  )
}
