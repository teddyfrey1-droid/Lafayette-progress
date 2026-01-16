"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { calculateProRataPrime, calculateTotalPotentialPrime } from "@/lib/demo-data"
import { useAuth } from "@/components/auth/auth-provider"
import { db, auth } from "@/lib/firebase/client"
// Note: On ne branche plus inviteUser ici pour éviter les erreurs Firebase client
import { sendPasswordResetEmail } from "firebase/auth"
import { collection, doc, updateDoc, onSnapshot, query, orderBy } from "firebase/firestore"
import {
  Users,
  Search,
  ChevronRight,
  Mail,
  Target,
  X,
  UserPlus,
  Clock,
  Send,
  Edit3,
  Check,
  EyeOff,
  Eye,
  Ban,
  Unlock,
  Building2 
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { toast } from "@/hooks/use-toast"

interface TeamMember {
  id: string
  name: string
  email: string
  role: string
  avatar?: string
  objectives: number
  completedObjectives: number
  contractHours: number
  baseHours: number
  excludeFromPrimes: boolean
  disabled: boolean
  company: string 
}

export default function TeamsPage() {
  const { profile } = useAuth()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  const [showInvite, setShowInvite] = useState(false)

  // 1. Synchronisation temps réel avec Firestore (Conservation de tes badges)
  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersList = snapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          name: data.displayName || data.name || "Sans nom",
          email: data.email || "",
          role: data.role || "employee",
          avatar: data.photoURL || null,
          objectives: data.objectivesCount || 5, 
          completedObjectives: data.completedObjectivesCount || 0,
          contractHours: data.contractHours || 35,
          baseHours: 35,
          excludeFromPrimes: data.excludeFromPrimes || false,
          disabled: data.disabled || false,
          company: data.company || "Heiko",
        }
      })
      setMembers(usersList)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.company.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const isAdmin = profile?.role === "admin" || profile?.role === "manager" || profile?.role === "super_admin"
  const totalPotential = calculateTotalPotentialPrime()

  return (
    <div className="min-h-screen bg-background pb-32">
      <Header />
      <main className="px-4 py-6 max-w-lg mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Équipes</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{loading ? "Synchronisation..." : `${members.length} collaborateurs`}</p>
          </div>
          {isAdmin && (
            <Button size="sm" className="rounded-xl gap-2" onClick={() => setShowInvite(true)}>
              <UserPlus className="w-4 h-4" /> Inviter
            </Button>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Rechercher par nom, rôle ou société..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            className="pl-10 rounded-xl bg-card border-none text-white" 
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="pulse-card p-4 text-center">
            <Users className="w-5 h-5 mx-auto mb-2 text-primary" />
            <p className="text-xl font-bold text-white">{members.length}</p>
            <p className="text-[11px] text-muted-foreground uppercase">Membres</p>
          </div>
          <div className="pulse-card p-4 text-center">
            <Target className="w-5 h-5 mx-auto mb-2 text-accent" />
            <p className="text-xl font-bold text-white">100%</p>
            <p className="text-[11px] text-muted-foreground uppercase">Objectifs</p>
          </div>
          <div className="pulse-card p-4 text-center">
            <Clock className="w-5 h-5 mx-auto mb-2 text-chart-3" />
            <p className="text-xl font-bold text-white">{members.reduce((sum, m) => sum + (m.contractHours || 0), 0)}h</p>
            <p className="text-[11px] text-muted-foreground uppercase">Total</p>
          </div>
        </div>

        <section className="space-y-3">
          {loading ? (
             <div className="flex flex-col items-center justify-center py-12 gap-2">
               <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
               <p className="text-xs text-muted-foreground">Mise à jour...</p>
             </div>
          ) : filteredMembers.map((member) => {
            const prorata = calculateProRataPrime(totalPotential, member.contractHours, 35)
            return (
              <div 
                key={member.id} 
                className={cn("pulse-card p-4 cursor-pointer hover:bg-muted/10 transition-all", member.disabled && "opacity-60 grayscale")}
                onClick={() => setSelectedMember(member)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold relative overflow-hidden">
                    {member.name.substring(0, 2).toUpperCase()}
                    {member.disabled && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><Ban className="w-5 h-5 text-white" /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm truncate flex items-center gap-2 text-white">
                        {member.name}
                        {member.disabled && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-500">Bloqué</span>}
                        {member.excludeFromPrimes && !member.disabled && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500">Observateur</span>}
                      </h3>
                      {!member.excludeFromPrimes && !member.disabled && <span className="text-sm font-bold text-primary">{prorata}€</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Building2 className="w-3 h-3 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground truncate">{member.company} • {member.role === 'employee' ? 'Salarié' : member.role}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Progress value={(member.completedObjectives / (member.objectives || 1)) * 100} className="h-1 flex-1" />
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </div>
            )
          })}
        </section>
      </main>

      {selectedMember && (
        <MemberDrawer member={selectedMember} onClose={() => setSelectedMember(null)} isAdmin={isAdmin} onUpdate={() => setSelectedMember(null)} />
      )}
      {showInvite && <InviteDrawer onClose={() => setShowInvite(false)} onSuccess={() => setShowInvite(false)} />}
      <BottomNav />
    </div>
  )
}

function MemberDrawer({ member, onClose, isAdmin, onUpdate }: any) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [company, setCompany] = useState(member.company)
  const [hours, setHours] = useState(member.contractHours.toString())
  const [role, setRole] = useState(member.role)
  const [exclude, setExclude] = useState(member.excludeFromPrimes)

  const save = async () => {
    setIsSaving(true)
    try {
      await updateDoc(doc(db, "users", member.id), { company, contractHours: parseInt(hours), role, excludeFromPrimes: exclude })
      toast({ title: "Profil mis à jour" }); onUpdate(); setIsEditing(false)
    } catch (e) { toast({ title: "Erreur", variant: "destructive" }) }
    finally { setIsSaving(false) }
  }

  const toggleBlock = async () => {
    if(!confirm("Voulez-vous vraiment changer l'accès de ce membre ?")) return
    await updateDoc(doc(db, "users", member.id), { disabled: !member.disabled })
    onUpdate(); toast({ title: "Statut mis à jour" })
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl z-50 p-6 space-y-6 animate-in slide-in-from-bottom max-h-[90vh] overflow-y-auto">
        <div className="w-12 h-1 bg-muted rounded-full mx-auto" />
        <div className="text-center">
           <div className="w-20 h-20 mx-auto rounded-full bg-primary/20 flex items-center justify-center text-primary text-2xl font-bold">
             {member.name.substring(0, 2).toUpperCase()}
           </div>
           <h3 className="font-bold text-lg mt-3 text-white">{member.name}</h3>
           <p className="text-sm text-muted-foreground">{member.email}</p>
        </div>

        {isAdmin && (
          <div className="space-y-3">
             <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="rounded-xl gap-2" onClick={() => { sendPasswordResetEmail(auth, member.email); toast({ title: "Lien envoyé" }) }} disabled={member.disabled}>
                   <Mail className="w-4 h-4" /> Reset Pass
                </Button>
                <Button variant="outline" className="rounded-xl gap-2" onClick={() => setIsEditing(!isEditing)} disabled={member.disabled}>
                   <Edit3 className="w-4 h-4" /> Modifier
                </Button>
             </div>
             <Button variant="outline" className={cn("w-full rounded-xl gap-2", member.disabled ? "text-green-500" : "text-red-500")} onClick={toggleBlock}>
                {member.disabled ? <Unlock className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                {member.disabled ? "Réactiver l'accès" : "Bloquer l'accès"}
             </Button>
          </div>
        )}

        {isEditing && (
          <div className="space-y-4 p-4 bg-muted/10 rounded-2xl border border-white/5">
             <div className="space-y-2">
               <label className="text-xs font-medium text-muted-foreground ml-1">Société / Site</label>
               <Input value={company} onChange={(e) => setCompany(e.target.value)} className="bg-background border-none text-white rounded-xl" />
             </div>
             <div className="space-y-2">
               <label className="text-xs font-medium text-muted-foreground ml-1">Heures de contrat</label>
               <Input type="number" value={hours} onChange={(e) => setHours(e.target.value)} className="bg-background border-none text-white rounded-xl" />
             </div>
             <div className="flex items-center justify-between p-2">
                <span className="text-sm text-white">Mode Observateur</span>
                <Switch checked={exclude} onCheckedChange={setExclude} />
             </div>
             <Button className="w-full rounded-xl" onClick={save} disabled={isSaving}>{isSaving ? "Enregistrement..." : "Sauvegarder les changements"}</Button>
          </div>
        )}
        <Button variant="ghost" className="w-full text-muted-foreground" onClick={onClose}>Fermer</Button>
      </div>
    </>
  )
}

function InviteDrawer({ onClose, onSuccess }: any) {
  const [email, setEmail] = useState("")
  const [company, setCompany] = useState("Heiko")
  const [role, setRole] = useState("employee")
  const [isLoading, setIsLoading] = useState(false)

  // --- LA FONCTION SERVEUR (Pour parler à Brevo et ton terminal) ---
  const handleInvite = async () => {
    if(!email) return
    setIsLoading(true)
    console.log("🔵 UI: Envoi de la requête API pour", email);

    try {
      const response = await fetch('/api/admin/invite-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name: email.split('@')[0], 
          role,
          companyName: company,
          contractHours: 35
        })
      });

      const result = await response.json();
      console.log("🟠 UI: Réponse du serveur", result);

      if (result.success) {
        toast({ title: "Succès", description: "L'invitation Brevo est partie !" })
        onSuccess()
      } else {
        throw new Error(result.error || "Le serveur a refusé l'envoi")
      }
    } catch (error: any) {
      console.error("🔴 UI: Erreur", error);
      toast({ title: "Erreur d'envoi", description: error.message, variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl z-50 p-6 space-y-4 animate-in slide-in-from-bottom">
        <div className="w-12 h-1 bg-muted rounded-full mx-auto" />
        <h2 className="font-bold text-lg text-white">Inviter un nouveau membre</h2>
        <div className="space-y-4 pb-8">
          <Input placeholder="Email professionnel" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-background border-none rounded-xl text-white" />
          <Input placeholder="Société / Site" value={company} onChange={(e) => setCompany(e.target.value)} className="bg-background border-none rounded-xl text-white" />
          <div className="flex gap-2">
             {['employee', 'manager', 'admin'].map(r => (
               <Button key={r} variant={role === r ? 'default' : 'outline'} className="flex-1 text-xs rounded-xl capitalize" onClick={() => setRole(r)}>{r === 'employee' ? 'Salarié' : r}</Button>
             ))}
          </div>
          <Button className="w-full rounded-xl h-12" disabled={isLoading || !email} onClick={handleInvite}>
            {isLoading ? "Communication serveur..." : "Envoyer l'invitation"}
          </Button>
        </div>
      </div>
    </>
  )
}