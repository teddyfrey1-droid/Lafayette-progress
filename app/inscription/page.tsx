"use client"

import type React from "react"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth"
import { getFirebaseAuth, getDefaultCompanyId } from "@/lib/firebase/client"
import { formatFirebaseAuthError } from "@/lib/firebase/errors"
import { ensureUserProfile } from "@/lib/firebase/profile"
import { ArrowLeft, Eye, EyeOff, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PulseLogo } from "@/components/pulse/pulse-logo"

export default function InscriptionPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const passwordValidation = useMemo(
    () => ({
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasNumber: /[0-9]/.test(password),
    }),
    [password],
  )

  const isPasswordValid =
    passwordValidation.minLength && passwordValidation.hasUppercase && passwordValidation.hasNumber

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  setIsLoading(true)
  setError(null)

  try {
    const auth = getFirebaseAuth()
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
    const displayName = name.trim()
    if (displayName) {
      await updateProfile(cred.user, { displayName })
    }
    // Create profile doc (company-scoped)
    await ensureUserProfile({
      uid: cred.user.uid,
      email: cred.user.email ?? email.trim(),
      name: displayName || undefined,
      companyId: getDefaultCompanyId(),
    })

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
            <h1 className="text-2xl font-bold mb-2">Créer un compte</h1>
            <p className="text-muted-foreground text-sm">Commencez à suivre vos objectifs dès maintenant.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom complet</Label>
              <Input
                id="name"
                type="text"
                placeholder="Marie Dupont"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-12 rounded-xl"
              />
            </div>

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
              <Label htmlFor="password">Mot de passe</Label>
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

              {/* Password requirements */}
              <div className="space-y-1 pt-2">
                <PasswordRequirement met={passwordValidation.minLength} text="8 caractères minimum" />
                <PasswordRequirement met={passwordValidation.hasUppercase} text="Une majuscule" />
                <PasswordRequirement met={passwordValidation.hasNumber} text="Un chiffre" />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 rounded-xl pulse-gradient text-white"
              disabled={isLoading || !isPasswordValid}
            >
              {isLoading ? "Création..." : "Créer mon compte"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Déjà un compte ?{" "}
            <Link href="/connexion" className="text-primary hover:underline font-medium">
              Se connecter
            </Link>
          </p>

          <p className="text-center text-xs text-muted-foreground mt-8">
            En créant un compte, vous acceptez nos{" "}
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

function PasswordRequirement({ met, text }: { met: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {met ? <Check className="w-4 h-4 text-green-500" /> : <X className="w-4 h-4 text-muted-foreground" />}
      <span className={met ? "text-green-500" : "text-muted-foreground"}>{text}</span>
    </div>
  )
}
