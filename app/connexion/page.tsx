"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signInWithEmailAndPassword } from "firebase/auth"
import { getFirebaseAuth } from "@/lib/firebase/client"
import { formatFirebaseAuthError } from "@/lib/firebase/errors"
import { touchLastLogin } from "@/lib/firebase/profile"
import { getDefaultCompanyId } from "@/lib/firebase/client"
import { ArrowLeft, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PulseLogo } from "@/components/pulse/pulse-logo"

export default function ConnexionPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  setIsLoading(true)
  setError(null)

  try {
    const auth = getFirebaseAuth()
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password)
    // Update last login marker (optional, used in Utilisateurs)
    try {
      await touchLastLogin(getDefaultCompanyId(), cred.user.uid)
    } catch {
      // ignore
    }
    router.push("/dashboard")
  } catch (err) {
    setError(formatFirebaseAuthError(err))
  } finally {
    setIsLoading(false)
  }
}

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="px-4 py-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          {/* Logo */}
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
            <p className="text-muted-foreground text-sm">Connectez-vous pour accéder à votre tableau de bord.</p>
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
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Mot de passe</Label>
                <Link href="#" className="text-xs text-primary hover:underline">
                  Mot de passe oublié ?
                </Link>
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

            {error && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full h-12 rounded-xl pulse-gradient text-white" disabled={isLoading}>
              {isLoading ? "Connexion..." : "Se connecter"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Pas encore de compte ?{" "}
            <Link href="/inscription" className="text-primary hover:underline font-medium">
              Créer un compte
            </Link>
          </p>

          <p className="text-center text-xs text-muted-foreground mt-8">
            En vous connectant, vous acceptez nos{" "}
            <Link href="#" className="underline">
              conditions d'utilisation
            </Link>{" "}
            et notre{" "}
            <Link href="#" className="underline">
              politique de confidentialité
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  )
}
