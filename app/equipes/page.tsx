"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { useObjectives } from "@/hooks/use-objectives"
import { useAuth } from "@/components/auth/auth-provider"
import { usePermissions } from "@/hooks/use-permissions"
import { PermissionGate } from "@/components/auth/permission-gate"
import { db } from "@/lib/firebase/client"
import { collection, doc, updateDoc, onSnapshot, query, orderBy, where } from "firebase/firestore"
import {
  Users,
  Search,
  ChevronRight,
  Mail,
  X,
  UserPlus,
  Clock,
  Send,
  Edit3,
  Check,
  Ban,
  Unlock,
  Trash2,
  Bell,
  BellOff
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"

import {
  demoAddMember,
  demoDeleteMember,
  demoGetMembers,
  demoUpdateMember,
  subscribeDemo,
} from "@/lib/demo/local-demo-store"


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
  companyId?: string
  createdAt?: any
  lastLogin?: any 
  pushEnabled?: boolean
}

export default function TeamsPage() {
  const { profile, isDemo } = useAuth()
  const { canEdit } = usePermissions()
  const { toast } = useToast()
  const { totalPotential } = useObjectives()
  
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  const [showInvite, setShowInvite] = useState(false)

  // 1. ÉCOUTE TEMPS RÉEL (CORRIGÉE AVEC FILTRES)
  useEffect(() => {
    // On attend que le profil soit chargé
    if (!profile) return;

    // --- MODE DÉMO : membres en localStorage ---
    if (isDemo && (profile as any).companyId) {
      const companyId = (profile as any).companyId as string
      const load = () => {
        const list = demoGetMembers(companyId).map((m) => ({
          id: m.id,
          name: m.displayName || m.email,
          email: m.email,
          role: m.role || "employee",
          contractHours: Number(m.contractHours) || 35,
          company: m.companyName || m.company || "Entreprise",
          companyId: m.companyId,
          createdAt: m.createdAt,
          lastLogin: m.lastLogin,
          disabled: !!m.disabled,
          excludeFromPrimes: !!m.excludeFromPrimes,
          pushEnabled: !!m.pushEnabled,
          avatar: m.avatar || "",
          objectives: m.objectives || 0,
          completedObjectives: m.completedObjectives || 0,
          baseHours: m.baseHours || m.contractHours || 35,
        }))
        setMembers(list)
        setLoading(false)
      }

      load()
      const unsub = subscribeDemo(companyId, load)
      return () => unsub()
    }

    let q;
    const usersRef = collection(db, "users");

    // LOGIQUE DE FILTRAGE (robuste : companyId d'abord, fallback legacy sur company)
    if (profile.role === "super_admin") {
      // Le Super Admin voit tout le monde (pas de filtre)
      q = query(usersRef, orderBy("createdAt", "desc"))
    } else if ((profile as any).companyId) {
      // Compte entreprise : on filtre par companyId (évite les comptes orphelins)
      q = query(usersRef, where("companyId", "==", (profile as any).companyId))
    } else if (profile.company) {
      // Fallback legacy si companyId n'existe pas encore
      q = query(usersRef, where("company", "==", profile.company))
    } else {
      // Si pas d'entreprise assignée, on ne charge rien par sécurité
      setLoading(false)
      return
    }

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const usersList: TeamMember[] = querySnapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          name: data.displayName || data.name || "Utilisateur sans nom",
          email: data.email || "",
          role: data.role || "employee",
          avatar: data.photoURL || null,
          objectives: data.objectivesCount || 5, 
          completedObjectives: data.completedObjectivesCount || 0,
          contractHours: data.contractHours || 35,
          baseHours: 35,
          excludeFromPrimes: data.excludeFromPrimes || false,
          disabled: data.disabled || false,
          // Support rétrocompatible pour companyName ou company
          company: data.companyName || data.company || "Non assigné",
          companyId: data.companyId || "",
          createdAt: data.createdAt || null,
          lastLogin: data.lastLogin || null,
          pushEnabled: data.pushEnabled || false
        }
      })

      // Tri côté client (évite les index composites Firestore sur where + orderBy)
      const toMs = (v: any) => {
        if (!v) return 0
        if (typeof v === "string") return new Date(v).getTime() || 0
        if (typeof v === "number") return v
        if (v?.toDate) return v.toDate().getTime()
        if (v instanceof Date) return v.getTime()
        return 0
      }
      usersList.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt))

      setMembers(usersList)
      setLoading(false)
    }, (error) => {
      console.error("Erreur temps réel:", error)
      // On évite de bloquer l'UI si l'index Firestore est en cours de création
      setLoading(false)
    })

    return () => unsubscribe()
  }, [profile, isDemo])

  const filteredMembers = members.filter(
    (member) =>
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.company.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const canManage = canEdit("equipes")


  const handleMemberUpdated = (updatedMember: TeamMember) => {
    setSelectedMember(updatedMember)
  }

  // Fonction pour supprimer un utilisateur via l'API
  const handleMemberDeleted = async (memberId: string) => {
    if(!confirm("Êtes-vous sûr de vouloir supprimer définitivement cet utilisateur ? Cette action est irréversible.")) return;

    try {
      if (isDemo && (profile as any)?.companyId) {
        demoDeleteMember((profile as any).companyId, memberId)
        toast({ title: "Utilisateur supprimé (démo)", variant: "success" })
        setSelectedMember(null)
        return
      }
      const response = await fetch(`/api/admin/invite-user?uid=${memberId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) throw new Error("Erreur serveur lors de la suppression");

      toast({ 
        title: "Utilisateur supprimé", 
        description: "Le compte a été supprimé définitivement.",
        variant: "success"
      });
      setSelectedMember(null);
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de supprimer l'utilisateur.", variant: "destructive" });
    }
  }

  return (
    <PermissionGate moduleId="equipes" redirect>
      <div className="min-h-screen bg-background pb-32">
      <Header />

      <main className="px-4 py-6 max-w-lg mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Équipes</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {loading ? "Chargement..." : `${members.length} collaborateurs`}
            </p>
          </div>
          {canManage && (
            <Button size="sm" className="rounded-xl gap-2" onClick={() => setShowInvite(true)}>
              <UserPlus className="w-4 h-4" />
              Inviter
            </Button>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un membre..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 rounded-xl"
          />
        </div>

        {/* STATS RAPIDES */}
        {!loading && (
          <div className="grid grid-cols-3 gap-3">
            <div className="pulse-card p-4 text-center">
              <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <p className="text-xl font-bold">{members.length}</p>
              <p className="text-[10px] text-muted-foreground">Effectif</p>
            </div>
            <div className="pulse-card p-4 text-center">
              <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Check className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-xl font-bold">
                {members.filter(m => m.lastLogin).length}
              </p>
              <p className="text-[10px] text-muted-foreground">Actifs</p>
            </div>
            <div className="pulse-card p-4 text-center">
              <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-orange-500/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
              <p className="text-xl font-bold">
                {members.filter(m => !m.lastLogin).length}
              </p>
              <p className="text-[10px] text-muted-foreground">En attente</p>
            </div>
          </div>
        )}

        <section className="space-y-3">
          <h2 className="font-semibold text-sm">Collaborateurs</h2>

          {loading ? (
             <div className="flex flex-col items-center justify-center py-12 space-y-4">
               <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
             </div>
          ) : (
            filteredMembers.length > 0 ? (
                filteredMembers.map((member) => {
                const isPending = !member.lastLogin;

                return (
                    <div 
                    key={member.id} 
                    className={cn(
                        "pulse-card p-4 cursor-pointer hover:bg-muted/50 transition-all duration-200 relative group",
                        member.disabled && "opacity-60 grayscale"
                    )} 
                    onClick={() => canManage && setSelectedMember(member)}
                    >
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/80 to-accent/80 flex items-center justify-center shrink-0 overflow-hidden">
                            {member.avatar ? (
                                <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-sm font-bold text-white">
                                {member.name.substring(0, 2).toUpperCase()}
                                </span>
                            )}
                            </div>
                            <div className={cn(
                                "absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-card flex items-center justify-center",
                                isPending ? "bg-orange-500" : "bg-green-500"
                            )} />
                        </div>

                        <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-sm truncate flex items-center gap-2">
                            {member.name}
                            </h3>
                            <div className="flex items-center gap-1.5">
                                {member.pushEnabled ? (
                                    <Bell className="w-3 h-3 text-primary fill-primary/20" />
                                ) : (
                                    <BellOff className="w-3 h-3 text-muted-foreground/30" />
                                )}
                                
                                {isPending && (
                                    <Badge variant="outline" className="text-[9px] h-5 px-1.5 bg-orange-500/10 text-orange-600 border-orange-200">
                                        En attente
                                    </Badge>
                                )}
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-xs text-muted-foreground capitalize">{member.role === 'employee' ? 'Salarié' : member.role}</p>
                            <span className="text-muted-foreground">•</span>
                            <p className="text-xs text-muted-foreground truncate max-w-[120px]">{member.company}</p>
                        </div>
                        </div>

                        <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 opacity-50 group-hover:opacity-100" />
                    </div>
                    </div>
                )
                })
            ) : (
                <div className="text-center py-12 text-muted-foreground">
                    <p>Aucun collaborateur trouvé.</p>
                </div>
            )
          )}
        </section>
      </main>

      {/* DRAWER DÉTAIL MEMBRE */}
      {selectedMember && (
        <MemberDrawer 
          member={selectedMember} 
          onClose={() => setSelectedMember(null)} 
          isAdmin={canManage}
          onUpdate={handleMemberUpdated}
          onDelete={handleMemberDeleted}
          isDemo={isDemo}
          companyId={(profile as any)?.companyId}
        />
      )}

      {/* DRAWER INVITATION */}
      {showInvite && canManage && (
        <InviteDrawer 
          onClose={() => setShowInvite(false)} 
          onSuccess={() => setShowInvite(false)} 
        />
      )}

      <BottomNav />
      </div>
    </PermissionGate>
  )
}

function MemberDrawer({
  member,
  onClose,
  isAdmin,
  onUpdate,
  onDelete,
  isDemo,
  companyId
}: {
  member: TeamMember
  onClose: () => void
  isAdmin: boolean
  onUpdate: (m: TeamMember) => void
  onDelete: (id: string) => void
  isDemo: boolean
  companyId?: string
}) {
  const { toast } = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  const [editedRole, setEditedRole] = useState(member.role)
  const [editedHours, setEditedHours] = useState(member.contractHours.toString())
  const [editedCompany, setEditedCompany] = useState(member.company)
  const [editedEmail, setEditedEmail] = useState(member.email)
  const [excludeFromPrimes, setExcludeFromPrimes] = useState(member.excludeFromPrimes)
  const [linkSent, setLinkSent] = useState(false)

  const isPending = !member.lastLogin;

  const handleSendActivationLink = async () => {
    try {
      if (isDemo) {
        setLinkSent(true)
        toast({
          title: "Démo",
          description: "En démo, aucun email n'est envoyé. Vous pouvez continuer à tester l'interface.",
          variant: "success",
        })
        setTimeout(() => setLinkSent(false), 5000)
        return
      }
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: member.email }),
      })

      if (!res.ok) {
        throw new Error("Erreur API")
      }

      setLinkSent(true)
      toast({
        title: "Email envoyé",
        description: `Lien de rappel envoyé à ${member.email}`,
        variant: "success",
      })
      setTimeout(() => setLinkSent(false), 5000)
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible d'envoyer l'email.", variant: "destructive" })
    }
  }

  const handleSaveChanges = async () => {
    setIsSaving(true)
    try {
      if (isDemo) {
        if (!companyId) throw new Error("Missing companyId")
        demoUpdateMember(companyId, member.id, {
          email: editedEmail,
          role: editedRole,
          contractHours: parseInt(editedHours) || 35,
          companyName: editedCompany,
          excludeFromPrimes,
        } as any)

        onUpdate({
          ...member,
          email: editedEmail,
          role: editedRole,
          contractHours: parseInt(editedHours) || 35,
          company: editedCompany,
          excludeFromPrimes,
        })

        toast({
          title: "Profil mis à jour (démo)",
          description: "Modifications enregistrées localement (sur cet appareil).",
          variant: "success",
        })
        setIsEditing(false)
        return
      }
      const res = await fetch("/api/admin/invite-user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            uid: member.id,
            email: editedEmail,
            role: editedRole,
            contractHours: parseInt(editedHours) || 35,
            company: editedCompany,
        })
      });

      if(!res.ok) throw new Error("Erreur API");

      if (excludeFromPrimes !== member.excludeFromPrimes) {
         await updateDoc(doc(db, "users", member.id), { excludeFromPrimes });
      }

      onUpdate({
        ...member,
        email: editedEmail,
        role: editedRole,
        contractHours: parseInt(editedHours) || 35,
        company: editedCompany,
        excludeFromPrimes: excludeFromPrimes
      })

      toast({ 
        title: "Profil mis à jour", 
        description: "Les modifications ont été enregistrées avec succès.", 
        variant: "success"
      })
      setIsEditing(false)
    } catch (error) {
      toast({ title: "Erreur", description: "Échec de la sauvegarde.", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleBlock = async () => {
    if(!confirm(member.disabled ? "Réactiver ?" : "Bloquer l'accès ?")) return;
    try {
      const newStatus = !member.disabled
      if (isDemo) {
        if (!companyId) throw new Error("Missing companyId")
        demoUpdateMember(companyId, member.id, { disabled: newStatus })
        onUpdate({ ...member, disabled: newStatus })
        toast({
          title: "Statut mis à jour (démo)",
          description: newStatus ? "Utilisateur bloqué (démo)." : "Utilisateur réactivé (démo).",
          variant: "success",
        })
        return
      }
      await updateDoc(doc(db, "users", member.id), { disabled: newStatus })
      onUpdate({ ...member, disabled: newStatus })
      toast({ 
        title: "Statut mis à jour", 
        description: member.disabled ? "L'accès utilisateur a été rétabli." : "L'utilisateur a été bloqué.",
        variant: "success"
      })
    } catch (e) {
      toast({ title: "Erreur", description: "Action impossible.", variant: "destructive" })
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl z-50 max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
        <div className="sticky top-0 bg-card rounded-t-3xl p-4 border-b border-border z-10">
          <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Détails du compte</h2>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-6 pb-8">
          <div className="text-center relative">
            <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-3 relative overflow-hidden ring-4 ring-background shadow-xl">
               {member.avatar ? (
                  <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
               ) : (
                  <span className="text-3xl font-bold text-white">
                    {member.name.substring(0, 2).toUpperCase()}
                  </span>
               )}
            </div>
            
            <h3 className="font-bold text-xl">{member.name}</h3>
            <p className="text-sm text-muted-foreground">{member.email}</p>
            
            <div className="flex justify-center gap-2 mt-4 flex-wrap">
                {isPending ? (
                    <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-200">
                        <Clock className="w-3 h-3 mr-1" /> En attente d'activation
                    </Badge>
                ) : (
                    <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">
                        <Check className="w-3 h-3 mr-1" /> Compte actif
                    </Badge>
                )}
                
                {member.pushEnabled ? (
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-200">
                        <Bell className="w-3 h-3 mr-1" /> Notifications ON
                    </Badge>
                ) : (
                    <Badge variant="secondary" className="text-muted-foreground">
                        <BellOff className="w-3 h-3 mr-1" /> Notifications OFF
                    </Badge>
                )}
            </div>
          </div>

          {isAdmin && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" className="rounded-xl h-12" onClick={handleSendActivationLink}>
                  {linkSent ? <Check className="w-4 h-4 mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  {linkSent ? "Envoyé" : "Renvoyer mail"}
                </Button>
                <Button variant={isEditing ? "default" : "outline"} className="rounded-xl h-12" onClick={() => setIsEditing(!isEditing)}>
                  <Edit3 className="w-4 h-4 mr-2" />
                  {isEditing ? "Annuler" : "Modifier"}
                </Button>
              </div>

              {isEditing && (
                <div className="pulse-card p-5 space-y-4 border-primary/20 bg-primary/5 animate-in fade-in zoom-in-95 duration-200">
                  <h4 className="text-sm font-semibold text-primary mb-2">Modification</h4>
                  
                  <div className="space-y-3">
                    <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Email (Modifiable)</label>
                        <Input value={editedEmail} onChange={(e) => setEditedEmail(e.target.value)} className="bg-background" />
                    </div>

                    <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Société</label>
                        <Input value={editedCompany} onChange={(e) => setEditedCompany(e.target.value)} className="bg-background" />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Rôle</label>
                        <Select value={editedRole} onValueChange={setEditedRole}>
                        <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="employee">Salarié</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Heures Contrat</label>
                        <Input type="number" value={editedHours} onChange={(e) => setEditedHours(e.target.value)} className="bg-background" />
                    </div>
                  </div>

                  <Button className="w-full rounded-xl mt-2" onClick={handleSaveChanges} disabled={isSaving}>
                    {isSaving ? "Sauvegarde..." : "Enregistrer les modifications"}
                  </Button>
                </div>
              )}

              <div className="pt-4 border-t border-border/50 space-y-3">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Zone de danger</h4>
                
                <Button variant="outline" className={cn("w-full justify-start", member.disabled ? "text-green-600 hover:text-green-700" : "text-orange-600 hover:text-orange-700")} onClick={handleToggleBlock}>
                    {member.disabled ? <Unlock className="w-4 h-4 mr-2" /> : <Ban className="w-4 h-4 mr-2" />}
                    {member.disabled ? "Débloquer l'accès" : "Bloquer temporairement"}
                </Button>

                <Button variant="ghost" className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => onDelete(member.id)}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Supprimer définitivement l'utilisateur
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function InviteDrawer({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
  const { toast } = useToast()
  const { profile, isDemo } = useAuth()

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("employee")
  const [hours, setHours] = useState("35")
  
  const [company, setCompany] = useState((profile as any)?.companyName || (profile as any)?.company || "Entreprise")

  useEffect(() => {
    const next = (profile as any)?.companyName || (profile as any)?.company
    if (next) setCompany(next)
  }, [profile])

  const [isLoading, setIsLoading] = useState(false)

  const handleInvite = async () => {
    if (!email || !firstName || !lastName) return;
    setIsLoading(true);

    try {
      const companyId = (profile as any)?.companyId as string | undefined
      if (isDemo) {
        if (!companyId) throw new Error("Entreprise manquante")
        const now = new Date().toISOString()
        demoAddMember(companyId, {
          id: `demo-u-${Date.now()}`,
          companyId,
          companyName: company,
          email,
          displayName: `${firstName} ${lastName}`,
          role,
          contractHours: parseInt(hours) || 35,
          createdAt: now,
          lastLogin: null,
          disabled: false,
          excludeFromPrimes: false,
          pushEnabled: false,
        } as any)

        toast({
          title: "Utilisateur ajouté (démo)",
          description: "En démo, aucun email n'est envoyé. Les données restent sur cet appareil.",
          variant: "success",
        })
        onSuccess()
        return
      }

      const response = await fetch("/api/admin/invite-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          firstName, 
          lastName,
          displayName: `${firstName} ${lastName}`,
          role,
          contractHours: parseInt(hours) || 35,
          company,
          companyId: companyId || "",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Impossible d'envoyer l'invitation.");
      }

      toast({
        title: "Invitation envoyée",
        description: `Un email d'activation a été envoyé à ${firstName} ${lastName}.`,
        variant: "success"
      });
      onSuccess();
    } catch (error: any) {
      console.error(error);
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl z-50 animate-in slide-in-from-bottom duration-300">
        <div className="p-4 border-b border-border">
          <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Nouveau collaborateur</h2>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-4 pb-8 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
             <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Prénom</label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jean" className="rounded-xl" />
             </div>
             <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Nom</label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Dupont" className="rounded-xl" />
             </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Email professionnel</label>
            <Input type="email" placeholder="jean.dupont@entreprise.com" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl" />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Société / Site</label>
            {/* ✅ CORRECTION: Champ désactivé pour empêcher l'erreur humaine */}
            <Input value={company} disabled className="rounded-xl bg-muted text-muted-foreground" />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Rôle</label>
            <div className="grid grid-cols-3 gap-2">
              {["employee", "manager", "admin"].map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={cn(
                    "p-3 rounded-xl text-xs font-medium transition-all capitalize border",
                    role === r
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:bg-muted",
                  )}
                >
                  {r === "employee" ? "Salarié" : r}
                </button>
              ))}
            </div>
          </div>

          <Button className="w-full rounded-xl h-12 text-base font-semibold" disabled={!email || !firstName || !lastName || isLoading} onClick={handleInvite}>
            {isLoading ? "Envoi en cours..." : <><Mail className="w-5 h-5 mr-2" /> Envoyer l'invitation</>}
          </Button>
        </div>
      </div>
    </>
  )
}
