"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signInWithEmailAndPassword } from "firebase/auth"
import { auth, db } from "@/lib/firebase/client"
import { doc, getDoc } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Loader2, LogIn, Lock } from "lucide-react"
import { logSystemAction } from "@/lib/logger" // Vérifie que tu as bien créé ce fichier lib/logger.ts avant !

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // 1. Authentification Firebase
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      const user = userCredential.user

      // 2. Récupérer les infos de l'utilisateur (Entreprise, Rôle...)
      const userDoc = await getDoc(doc(db, "users", user.uid))
      const userData = userDoc.exists() ? userDoc.data() : {}

      // 3. --- C'EST ICI QUE LA MAGIE OPÈRE ---
      // On enregistre la trace dans le Centre de Contrôle
      await logSystemAction({
        userId: user.uid,
        userName: userData.displayName || user.email || "Utilisateur",
        userRole: userData.role || "employee",
        companyId: userData.companyId || "unknown",
        companyName: userData.companyName || "Entreprise Inconnue",
        action: "LOGIN", // L'action est 'LOGIN'
        details: "Connexion réussie à l'application"
      })

      // 4. Redirection vers l'accueil
      toast({ title: "Connexion réussie", description: "Bienvenue sur Pulse" })
      
      // Si c'est un admin, on peut le rediriger vers le centre de contrôle, sinon vers le dashboard
      if (userData.role === 'admin' || userData.role === 'super_admin') {
         router.push("/dashboard") 
      } else {
         router.push("/dashboard")
      }

    } catch (error: any) {
      console.error(error)
      toast({ 
        title: "Erreur", 
        description: "Email ou mot de passe incorrect.", 
        variant: "destructive" 
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/50 px-4">
      <div className="w-full max-w-sm space-y-6 bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4 text-primary">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Connexion</h1>
          <p className="text-sm text-muted-foreground">Accédez à votre espace Pulse</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email professionnel</Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="nom@entreprise.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="rounded-xl bg-gray-50/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input 
              id="password" 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="rounded-xl bg-gray-50/50"
            />
          </div>

          <Button type="submit" className="w-full rounded-xl py-6 font-bold" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <LogIn className="w-4 h-4 mr-2" />}
            Se connecter
          </Button>
        </form>
        
        <div className="text-center text-xs text-muted-foreground">
            Mot de passe oublié ? Contactez votre administrateur.
        </div>
      </div>
    </div>
  )
}
