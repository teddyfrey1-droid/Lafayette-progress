"use client"

import type React from "react"
import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Eye, EyeOff, Mail, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PulseLogo } from "@/components/pulse/pulse-logo"
import { useAuth } from "@/components/auth/auth-provider"
import { friendlyAuthError, signInWithEmail } from "@/lib/firebase/auth"
// Import des utilitaires de log et Firestore
import { logSystemAction } from "@/lib/logger"
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase/client"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"

export default function ConnexionClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading } = useAuth()
  const { toast } = useToast()

  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [isResetOpen, setIsResetOpen] = useState(false)
  const [resetEmail, setResetEmail] = useState("")
  const [isResetting, setIsResetting] = useState(false)

  const nextUrl = searchParams.get("next") || "/dashboard"

  useEffect(() => {
    if (!loading && user) {
      router.replace(nextUrl)
    }
  }, [loading, user, router, nextUrl])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      // 1. Connexion Firebase Auth
      const user = await signInWithEmail(email.trim(), password)
      const uid = user.uid;

      // 2. 🔴 ENREGISTREMENT DU LOG ROBUSTE
      try {
        const userDoc = await getDoc(doc(db, "users", uid));
        const userData = userDoc.data() || {};
        
        // Logique de secours : Si companyId manque mais que company existe (vieux compte buggé), 
        // on assigne un ID temporaire pour le repérer dans les logs.
        const fallbackId = userData.company ? "legacy_missing_id" : "none";
        const safeCompanyId = userData.companyId || fallbackId;

        await logSystemAction({
            userId: uid,
            userName: userData.displayName || email,
            userRole: userData.role || "Inconnu",
            companyId: safeCompanyId,
            companyName: userData.company || userData.companyName || "Non assigné",
            action: "LOGIN",
            details: "Connexion au tableau de bord"
        });
      } catch (logError) {
        console.error("Erreur log connexion", logError);
        // On ne bloque pas la connexion si le log échoue
      }

      
      // ✅ Met à jour la dernière connexion (utilisé pour "En attente" / dernière connexion)
      try {
        await setDoc(
          doc(db, "users", uid),
          {
            lastLogin: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        )
      } catch (e) {
        // On ne bloque pas la connexion si l'update échoue
      }

router.replace(nextUrl)
    } catch (err: unknown) {
      const code = typeof (err as any)?.code === "string" ? (err as any).code : ""
      setError(friendlyAuthError(code))
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetEmail) return

    setIsResetting(true)
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail }),
      })

      if (!res.ok) throw new Error("Erreur serveur")

      toast({
        title: "Email envoyé",
        description: "Si ce compte existe, vous recevrez un email de réinitialisation via Pulse App.",
        variant: "success",
      })
      setIsResetOpen(false)
      setResetEmail("")
    } catch (error: any) {
      console.error(error)
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer l'email. Veuillez réessayer.",
        variant: "destructive",
      })
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-4 py-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Retour
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 rounded-2xl pulse-gradient flex items-center justify-center">
              <span className="text-2xl font-bold text-white">P</span>
            </div>
          </div>

          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-2">
              <PulseLogo size="md" showText={true} />
            </div>
            <h1 className="text-2xl font-bold mb-2">Bon retour !</h1>
            <p className="text-muted-foreground text-sm">
              Connectez-vous pour accéder à votre tableau de bord.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Adresse email</Label>
              <Input
                id="email"
                type="email"
                placeholder="vous@exemple.fr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 rounded-xl"
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Mot de passe</Label>
                <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
                  <DialogTrigger asChild>
                    <button type="button" className="text-xs text-primary hover:underline font-medium">
                      Mot de passe oublié ?
                    </button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                      <DialogTitle>Mot de passe oublié</DialogTitle>
                      <DialogDescription>
                        Entrez votre adresse email. Nous vous enverrons un lien pour réinitialiser votre mot de passe.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleForgotPassword} className="space-y-4 mt-2">
                      <div className="space-y-2">
                        <Label htmlFor="reset-email">Email</Label>
                        <Input
                          id="reset-email"
                          type="email"
                          placeholder="nom@entreprise.com"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          required
                          className="rounded-xl"
                        />
                      </div>
                      <Button type="submit" className="w-full rounded-xl" disabled={isResetting}>
                        {isResetting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Envoi...
                          </>
                        ) : (
                          <>
                            <Mail className="w-4 h-4 mr-2" /> Envoyer le lien
                          </>
                        )}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 rounded-xl pr-10"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-destructive font-medium text-center bg-destructive/10 p-2 rounded-lg">{error}</p>}

            <Button
              type="submit"
              className="w-full h-12 rounded-xl pulse-gradient text-white font-semibold"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Connexion...
                </>
              ) : (
                "Se connecter"
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Pas encore de compte ?{" "}
            <Link href="/inscription" className="text-primary hover:underline font-medium">
              Créer un compte
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
