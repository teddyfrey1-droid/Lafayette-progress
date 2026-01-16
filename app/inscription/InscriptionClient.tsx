"use client"

import type React from "react"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Eye, EyeOff, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PulseLogo } from "@/components/pulse/pulse-logo"
import { useAuth } from "@/components/auth/auth-provider"
import { friendlyAuthError, signUpWithEmail } from "@/lib/firebase/auth"

export default function InscriptionClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading } = useAuth()

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

  const nextUrl = searchParams.get("next") || "/dashboard"

  useEffect(() => {
    if (!loading && user) {
      router.replace(nextUrl)
    }
  }, [loading, user, router, nextUrl])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isPasswordValid) return

    setError(null)
    setIsLoading(true)

    try {
      await signUpWithEmail({
        email: email.trim(),
        password,
        displayName: name.trim(),
      })
      router.replace(nextUrl)
    } catch (err: unknown) {
      const code = typeof (err as any)?.code === "string" ? (err as any).code : ""
      setError(friendlyAuthError(code))
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-4 py-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
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
                autoComplete="name"
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
                autoComplete="email"
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
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              <div className="mt-3 space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  {passwordValidation.minLength ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <X className="w-3 h-3 text-muted-foreground" />
                  )}
                  <span className={passwordValidation.minLength ? "" : "text-muted-foreground"}>
                    8 caractères minimum
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {passwordValidation.hasUppercase ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <X className="w-3 h-3 text-muted-foreground" />
                  )}
                  <span className={passwordValidation.hasUppercase ? "" : "text-muted-foreground"}>
                    1 majuscule
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {passwordValidation.hasNumber ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <X className="w-3 h-3 text-muted-foreground" />
                  )}
                  <span className={passwordValidation.hasNumber ? "" : "text-muted-foreground"}>
                    1 chiffre
                  </span>
                </div>
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

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
        </div>
      </main>
    </div>
  )
}
