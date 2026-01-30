"use client"

import { useEffect, useState } from "react"
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { PermissionGate } from "@/components/auth/permission-gate"
import { usePermissions } from "@/hooks/use-permissions"
import { useAuth } from "@/components/auth/auth-provider"
import { getSuppliers, hydrateOrdersStore, addSupplier, updateSupplier, deleteSupplier, addProduct, updateProduct, deleteProduct, type SupplierProduct, getOrdersStoreEventName } from "@/lib/demo/orders-store"
import {
  Truck,
  Plus,
  X,
  Edit3,
  Trash2,
  Check,
  Search,
  ArrowLeft,
  GripVertical,
  User,
  Calendar,
  Clock,
  Package,
  PhoneIcon,
  Info,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import Link from "next/link"

interface Fournisseur {
  id: string
  name: string
  commercial?: string
  phone: string
  deliveryDays: string[]
  delaiCommande: string
  orderBefore?: string
  franco?: string
  minOrder?: string
  deliveryTime?: string
  isDefault: boolean
}

const daysOfWeek = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]

const defaultFournisseurs: Fournisseur[] = [
  {
    id: "f1",
    name: "FOODEX",
    phone: "01.45.10.24.00",
    deliveryDays: ["Lun", "Mar", "Mer", "Jeu", "Ven"],
    delaiCommande: "1 j",
    orderBefore: "12h00",
    minOrder: "100€",
    deliveryTime: "Avant 10h",
    isDefault: true,
  },
  {
    id: "f2",
    name: "METRO",
    phone: "01.64.19.17.17",
    deliveryDays: ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"],
    delaiCommande: "1 j",
    orderBefore: "14h00",
    minOrder: "150€",
    deliveryTime: "Matin",
    isDefault: true,
  },
  {
    id: "f3",
    name: "ABORDAJ",
    phone: "01.84.80.14.29",
    deliveryDays: ["Lun", "Mar", "Mer", "Jeu", "Ven"],
    delaiCommande: "2 j",
    orderBefore: "16h00",
    deliveryTime: "Après-midi",
    isDefault: true,
  },
  {
    id: "f4",
    name: "Sysco",
    phone: "01.69.11.67.47",
    deliveryDays: ["Lun", "Mer", "Ven"],
    delaiCommande: "1 j",
    orderBefore: "11h00",
    minOrder: "120€",
    isDefault: true,
  },
  {
    id: "f5",
    name: "TERRE AZUR",
    commercial: "Gregory",
    phone: "01.78.68.64.23",
    deliveryDays: ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"],
    delaiCommande: "1 j",
    orderBefore: "15h00",
    franco: "200€",
    deliveryTime: "Matin",
    isDefault: true,
  },
  {
    id: "f6",
    name: "PLG",
    commercial: "Sarah",
    phone: "01.34.82.77.82",
    deliveryDays: ["Lun", "Mar", "Mer", "Jeu", "Ven"],
    delaiCommande: "5 j",
    orderBefore: "10h00",
    isDefault: true,
  },
  {
    id: "f7",
    name: "Vivalya Fruits & Légumes",
    commercial: "Malik",
    phone: "06.59.64.79.46",
    deliveryDays: ["Lun", "Mar", "Mer", "Jeu", "Ven"],
    delaiCommande: "1 j",
    orderBefore: "13h00",
    minOrder: "80€",
    deliveryTime: "Avant 8h",
    isDefault: true,
  },
  {
    id: "f8",
    name: "Vivalya Marée",
    commercial: "Aurelie",
    phone: "01.75.66.26.00",
    deliveryDays: ["Lun", "Mar", "Mer", "Jeu", "Ven"],
    delaiCommande: "1 j",
    orderBefore: "11h00",
    deliveryTime: "Très tôt",
    isDefault: true,
  },
]

export default function FournisseursPage() {
  const { canEdit } = usePermissions()
  const { profile, isDemo } = useAuth()
  const companyId: string | undefined = isDemo ? "demo-company" : ((profile as any)?.companyId as string | undefined)
  const companyReady = Boolean(companyId)
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<Fournisseur | null>(null)
  const [productsSupplierId, setProductsSupplierId] = useState<string | null>(null)

  useEffect(() => {
    if (!companyId) return
    let cancelled = false
    const load = async () => {
      await hydrateOrdersStore(companyId)
      if (cancelled) return
      setFournisseurs(getSuppliers(companyId) as any)
    }
    load()
    const evtName = getOrdersStoreEventName()
    const onAny = (e?: any) => {
      const eventCompanyId = e?.detail?.companyId as string | undefined
      if (eventCompanyId && eventCompanyId !== companyId) return
      load()
    }
    window.addEventListener(evtName, onAny as any)
    window.addEventListener("storage", onAny as any)
    return () => {
      cancelled = true
      window.removeEventListener(evtName, onAny as any)
      window.removeEventListener("storage", onAny as any)
    }
  }, [companyId])


  const filteredFournisseurs = fournisseurs.filter(
    (f) =>
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.commercial && f.commercial.toLowerCase().includes(searchQuery.toLowerCase())),
  )

  const handleDelete = async (id: string) => {
    if (!companyId) return
    if (confirm("Voulez-vous vraiment supprimer ce fournisseur ?")) {
      await deleteSupplier(companyId, id)
      setFournisseurs(getSuppliers(companyId) as any)
    }
  }

  return (
    <PermissionGate moduleId="fournisseurs" redirect>
      <div className="min-h-screen bg-background pb-24">
        <Header />

        <main className="px-4 py-6 max-w-4xl mx-auto space-y-6">
          {!companyReady && (
            <div className="pulse-card p-6 text-center text-muted-foreground">Chargement de l'entreprise…</div>
          )}
          {/* Back link */}
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Retour</span>
          </Link>

          {/* Page Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Fournisseurs</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Contacts, livraisons et conditions de commande
              </p>
            </div>
            
            {/* 🔒 PROTECTION DU BOUTON AJOUTER */}
            {canEdit("fournisseurs") && (
              <Button size="sm" className="rounded-xl gap-2" onClick={() => companyReady && setShowAdd(true)}>
                <Plus className="w-4 h-4" />
                Ajouter
              </Button>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un fournisseur..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 rounded-xl"
            />
          </div>

          {/* Info card - Simple et pro */}
          <div className="pulse-card p-4 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Info className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm mb-1">Informations de commande</h3>
                <p className="text-xs text-muted-foreground">
                  J-X = délai de commande • Min. = montant minimum • Livraison = créneau horaire
                </p>
              </div>
            </div>
          </div>

          {/* Fournisseurs List */}
          <section className="space-y-4">
            {filteredFournisseurs.map((fournisseur) => (
              <div key={fournisseur.id} className="pulse-card overflow-hidden hover:shadow-lg transition-shadow">
                {/* Header avec nom et actions */}
                <div className="p-5 pb-4">
                  <div className="flex items-start gap-4">
                    {/* Drag handle */}
                    <div className="mt-1 cursor-grab text-muted-foreground hover:text-foreground">
                      <GripVertical className="w-5 h-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Nom et contact */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1">
                          <h3 className="font-bold text-xl text-foreground mb-2">{fournisseur.name}</h3>

                          {/* Contact info dans un badge */}
                          <div className="flex flex-wrap gap-2">
                            {fournisseur.commercial && (
                              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
                                <User className="w-3.5 h-3.5 text-purple-600" />
                                <span className="text-xs font-medium text-purple-700">
                                  {fournisseur.commercial}
                                </span>
                              </div>
                            )}
                            <a
                              href={`tel:${fournisseur.phone.replace(/\./g, "")}`}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-colors"
                            >
                              <PhoneIcon className="w-3.5 h-3.5 text-primary" />
                              <span className="text-xs font-medium text-primary">{fournisseur.phone}</span>
                            </a>
                          </div>
                        </div>

                        {/* Actions protégées */}
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-lg"
                            onClick={() => setProductsSupplierId(fournisseur.id)}
                            title="Produits"
                          >
                            <Package className="w-4 h-4" />
                          </Button>
                          {/* 🔒 BOUTON MODIFIER */}
                          {canEdit("fournisseurs") && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 rounded-lg"
                              onClick={() => setEditing(fournisseur)}
                            >
                              <Edit3 className="w-4 h-4" />
                            </Button>
                          )}
                          
                          {/* 🔒 BOUTON SUPPRIMER */}
                          {canEdit("fournisseurs") && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-500/10"
                              onClick={() => handleDelete(fournisseur.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Informations clés - Design sobre et pro */}
                      <div className="flex flex-wrap gap-3 mb-4">
                        {/* Délai de commande */}
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                          <Clock className="w-4 h-4 text-slate-500" />
                          <div className="text-sm">
                            <span className="font-medium text-slate-700 dark:text-slate-300">J-{fournisseur.delaiCommande.replace(/\s*j\s*/i, '')}</span>
                            {fournisseur.orderBefore && (
                              <span className="text-slate-500 dark:text-slate-400"> avant {fournisseur.orderBefore}</span>
                            )}
                          </div>
                        </div>

                        {/* Minimum de commande */}
                        {(fournisseur.minOrder || fournisseur.franco) && (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            <Package className="w-4 h-4 text-slate-500" />
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                              Min. {fournisseur.minOrder || fournisseur.franco}
                            </span>
                          </div>
                        )}

                        {/* Heure de livraison */}
                        {fournisseur.deliveryTime && (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            <Truck className="w-4 h-4 text-slate-500" />
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                              {fournisseur.deliveryTime}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Jours de livraison - Version sobre et claire */}
                      <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                            Jours de livraison
                          </span>
                        </div>
                        <div className="flex gap-1.5">
                          {daysOfWeek.map((day) => {
                            const isActive = fournisseur.deliveryDays.includes(day)
                            return (
                              <div
                                key={day}
                                className={cn(
                                  "flex-1 text-center py-2 rounded-lg font-medium text-xs transition-all",
                                  isActive
                                    ? "bg-primary/10 text-primary border border-primary/30"
                                    : "bg-slate-50 dark:bg-slate-800/50 text-slate-400 border border-transparent",
                                )}
                              >
                                {day}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {filteredFournisseurs.length === 0 && (
              <div className="pulse-card p-12 text-center">
                <Truck className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">Aucun fournisseur trouvé</p>
              </div>
            )}
          </section>
        </main>

        {/* Add Drawer */}
        {showAdd && (
          <FournisseurDrawer
            onClose={() => setShowAdd(false)}
            onSave={async (fournisseur) => {
              if (!companyId) return

              try {
                await addSupplier(companyId, {
                  name: fournisseur.name,
                  email: "",
                  phone: fournisseur.phone,
                  deliveryDays: fournisseur.deliveryDays,
                  delaiCommande: fournisseur.delaiCommande,
                  orderBefore: fournisseur.orderBefore,
                  franco: fournisseur.franco,
                  minOrder: fournisseur.minOrder,
                  deliveryTime: fournisseur.deliveryTime,
                  commercial: fournisseur.commercial,
                } as any)
                setFournisseurs(getSuppliers(companyId) as any)
              } catch (e) {
                console.error(e)
                alert("Impossible d'ajouter le fournisseur.")
              } finally {
                setShowAdd(false)
              }
            }}
          />
        )}

        {/* Edit Drawer */}
        {editing && (
          <FournisseurDrawer
            fournisseur={editing}
            onClose={() => setEditing(null)}
            onSave={async (updated) => {
              await updateSupplier(companyId, updated.id, updated as any)
              setFournisseurs(getSuppliers(companyId) as any)
              setEditing(null)
            }}
          />
        )}

        {/* Products Drawer */}
        {companyReady && productsSupplierId && (
          <ProductsDrawer
            companyId={companyId}
            supplier={(fournisseurs as any).find((s: any) => s.id === productsSupplierId)}
            canEdit={canEdit("fournisseurs")}
            onClose={() => setProductsSupplierId(null)}
            onRefresh={() => setFournisseurs(getSuppliers(companyId) as any)}
          />
        )}


        <BottomNav />
      </div>
    </PermissionGate>
  )
}

function FournisseurDrawer({
  fournisseur,
  onClose,
  onSave,
}: {
  fournisseur?: Fournisseur
  onClose: () => void
  onSave: (fournisseur: Fournisseur) => void
}) {
  const [name, setName] = useState(fournisseur?.name || "")
  const [commercial, setCommercial] = useState(fournisseur?.commercial || "")
  const [phone, setPhone] = useState(fournisseur?.phone || "")
  const [deliveryDays, setDeliveryDays] = useState<string[]>(fournisseur?.deliveryDays || [])
  const [delaiCommande, setDelaiCommande] = useState(fournisseur?.delaiCommande || "1 j")
  const [orderBefore, setOrderBefore] = useState(fournisseur?.orderBefore || "")
  const [minOrder, setMinOrder] = useState(fournisseur?.minOrder || "")
  const [franco, setFranco] = useState(fournisseur?.franco || "")
  const [deliveryTime, setDeliveryTime] = useState(fournisseur?.deliveryTime || "")

  const toggleDay = (day: string) => {
    if (deliveryDays.includes(day)) {
      setDeliveryDays(deliveryDays.filter((d) => d !== day))
    } else {
      setDeliveryDays([...deliveryDays, day])
    }
  }

  const handleSave = () => {
    onSave({
      id: fournisseur?.id || "",
      name,
      commercial: commercial || undefined,
      phone,
      deliveryDays,
      delaiCommande,
      orderBefore: orderBefore || undefined,
      minOrder: minOrder || undefined,
      franco: franco || undefined,
      deliveryTime: deliveryTime || undefined,
      isDefault: fournisseur?.isDefault || false,
    })
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl z-50 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-card rounded-t-3xl p-4 border-b border-border z-10">
          <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">
              {fournisseur ? "Modifier" : "Ajouter"} un fournisseur
            </h2>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-6 pb-8">
          {/* Section : Informations générales */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-primary flex items-center gap-2">
              <User className="w-4 h-4" />
              Informations générales
            </h3>

            <div>
              <label className="text-sm font-medium">Nom du fournisseur *</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-xl mt-1"
                placeholder="Ex: METRO"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Commercial</label>
                <Input
                  value={commercial}
                  onChange={(e) => setCommercial(e.target.value)}
                  className="rounded-xl mt-1"
                  placeholder="Ex: Sarah"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Téléphone *</label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="rounded-xl mt-1"
                  placeholder="01.00.00.00.00"
                />
              </div>
            </div>
          </div>

          {/* Section : Livraison */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-emerald-600 flex items-center gap-2">
              <Truck className="w-4 h-4" />
              Conditions de livraison
            </h3>

            <div>
              <label className="text-sm font-medium mb-2 block">Jours de livraison</label>
              <div className="flex gap-2 flex-wrap">
                {daysOfWeek.map((day) => (
                  <button
                    key={day}
                    onClick={() => toggleDay(day)}
                    className={cn(
                      "flex-1 min-w-[45px] py-2.5 rounded-xl text-xs font-semibold transition-all",
                      deliveryDays.includes(day)
                        ? "bg-emerald-500 text-white shadow-md"
                        : "bg-muted text-muted-foreground hover:bg-muted/80",
                    )}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Heure de livraison</label>
              <Input
                value={deliveryTime}
                onChange={(e) => setDeliveryTime(e.target.value)}
                className="rounded-xl mt-1"
                placeholder="Ex: Avant 10h, Matin, Après-midi"
              />
              <p className="text-xs text-muted-foreground mt-1">
                À quel moment de la journée ?
              </p>
            </div>
          </div>

          {/* Section : Conditions de commande */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-amber-600 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Conditions de commande
            </h3>

            <div>
              <label className="text-sm font-medium mb-2 block">Délai de commande</label>
              <div className="flex gap-2">
                {["1 j", "2 j", "3 j", "5 j", "7 j"].map((delai) => (
                  <button
                    key={delai}
                    onClick={() => setDelaiCommande(delai)}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all",
                      delaiCommande === delai
                        ? "bg-amber-500 text-white shadow-md"
                        : "bg-muted text-muted-foreground hover:bg-muted/80",
                    )}
                  >
                    {delai}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Commander X jour(s) avant la livraison
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">Commander avant (heure limite)</label>
              <Input
                value={orderBefore}
                onChange={(e) => setOrderBefore(e.target.value)}
                className="rounded-xl mt-1"
                placeholder="Ex: 12h00, 14h30"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Heure limite pour passer commande
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Minimum de commande</label>
                <Input
                  value={minOrder}
                  onChange={(e) => setMinOrder(e.target.value)}
                  className="rounded-xl mt-1"
                  placeholder="Ex: 100€"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Franco (port offert)</label>
                <Input
                  value={franco}
                  onChange={(e) => setFranco(e.target.value)}
                  className="rounded-xl mt-1"
                  placeholder="Ex: 200€"
                />
              </div>
            </div>
          </div>

          <Button
            className="w-full rounded-xl py-6 text-base"
            onClick={handleSave}
            disabled={!name || !phone}
          >
            <Check className="w-5 h-5 mr-2" />
            {fournisseur ? "Sauvegarder les modifications" : "Ajouter le fournisseur"}
          </Button>
        </div>
      </div>
    </>
  )
}


function ProductsDrawer({
  companyId,
  supplier,
  canEdit,
  onClose,
  onRefresh,
}: {
  companyId: string
  supplier: any
  canEdit: boolean
  onClose: () => void
  onRefresh: () => void
}) {
  const [search, setSearch] = useState("")
  const [showImport, setShowImport] = useState(false)

  const [productForm, setProductForm] = useState<Partial<SupplierProduct>>({
    name: "",
    reference: "",
    unitPrice: 0,
    unit: "u",
    imageUrl: "",
  })

  const [importText, setImportText] = useState("")
  const [importUnit, setImportUnit] = useState("u")

  const products: SupplierProduct[] = Array.isArray(supplier?.products) ? supplier.products : []

  const filtered = products.filter((p) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (p.name || "").toLowerCase().includes(q) || (p.reference || "").toLowerCase().includes(q)
  })

  const parseNumber = (raw: string) => {
    const v = (raw || "").toString().trim().replace(",", ".").replace(/[^0-9.]/g, "")
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }

  const parseBulk = (raw: string) => {
    const lines = (raw || "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)

    const items: Array<{ reference?: string; name: string; unitPrice: number; unit: string; imageUrl?: string }> = []
    for (const line of lines) {
      const parts = line.split(/[;\t,]/).map((p) => p.trim())
      if (parts.length < 3) continue
      const reference = (parts[0] || "").trim()
      const name = (parts[1] || "").trim()
      const unitPrice = parseNumber(parts[2] || "")
      const unit = (parts[3] || "").trim() || importUnit || "u"
      const imageUrl = (parts[4] || "").trim()

      if (!name) continue
      items.push({ reference, name, unitPrice, unit, imageUrl: imageUrl || undefined })
    }
    return items
  }

  const handleAddOne = async () => {
    if (!supplier?.id) return
    const name = (productForm.name || "").toString().trim()
    if (!name) return alert("Nom produit requis")
    const unitPrice = Number(productForm.unitPrice || 0)
    const unit = (productForm.unit || "u").toString()
    const reference = (productForm.reference || "").toString().trim()
    const imageUrl = (productForm.imageUrl || "").toString().trim()

    try {
      await addProduct(companyId, supplier.id, {
        name,
        reference: reference || undefined,
        imageUrl: imageUrl || undefined,
        unitPrice,
        unit,
      })
      setProductForm({ name: "", reference: "", unitPrice: 0, unit, imageUrl: "" })
      onRefresh()
    } catch (e) {
      console.error(e)
      alert("Impossible d'ajouter le produit.")
    }
  }

  const handleDeleteProduct = async (productId: string) => {
    if (!supplier?.id) return
    if (!confirm("Supprimer ce produit ?")) return
    try {
      await deleteProduct(companyId, supplier.id, productId)
      onRefresh()
    } catch (e) {
      console.error(e)
      alert("Impossible de supprimer le produit.")
    }
  }

  const handleImport = async () => {
    if (!supplier?.id) return
    const items = parseBulk(importText)
    if (items.length === 0) return alert("Aucun produit détecté. Format attendu : Référence;Nom;Prix (Unit;ImageUrl optionnels)")
    try {
      const byRef = new Map<string, SupplierProduct>()
      for (const p of products) {
        const r = (p.reference || "").toString().trim().toLowerCase()
        if (r) byRef.set(r, p)
      }

      let created = 0
      let updated = 0

      for (const it of items) {
        const rKey = (it.reference || "").toString().trim().toLowerCase()
        const existing = rKey ? byRef.get(rKey) : undefined
        if (existing) {
          await updateProduct(companyId, supplier.id, existing.id, {
            name: it.name,
            unitPrice: it.unitPrice,
            unit: it.unit,
            reference: it.reference || existing.reference,
            imageUrl: it.imageUrl || existing.imageUrl,
          })
          updated += 1
        } else {
          await addProduct(companyId, supplier.id, {
            name: it.name,
            unitPrice: it.unitPrice,
            unit: it.unit,
            reference: it.reference || undefined,
            imageUrl: it.imageUrl || undefined,
          })
          created += 1
        }
      }

      onRefresh()
      setShowImport(false)
      setImportText("")
      alert(`Import terminé : ${created} créé(s), ${updated} mis à jour.`)
    } catch (e) {
      console.error(e)
      alert("Erreur pendant l'import.")
    }
  }

  const handleFile = async (f: File | null) => {
    if (!f) return
    try {
      const text = await f.text()
      setImportText(text)
    } catch (e) {
      console.error(e)
      alert("Impossible de lire le fichier.")
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl z-50 max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-card rounded-t-3xl p-4 border-b border-border z-10">
          <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <h2 className="font-semibold text-lg truncate">Produits — {supplier?.name || "Fournisseur"}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{products.length} produit(s)</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-6 pb-10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher (nom ou référence)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 rounded-xl"
            />
          </div>

          <div className="pulse-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Ajouter un produit</h3>
              <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setShowImport(true)} disabled={!canEdit}>
                Importer
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-sm font-medium">Nom *</label>
                <Input value={(productForm.name || "") as any} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} className="rounded-xl mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Référence fournisseur</label>
                <Input value={(productForm.reference || "") as any} onChange={(e) => setProductForm({ ...productForm, reference: e.target.value })} className="rounded-xl mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Prix (€)</label>
                <Input type="number" value={String(productForm.unitPrice ?? 0)} onChange={(e) => setProductForm({ ...productForm, unitPrice: Number(e.target.value || 0) })} className="rounded-xl mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Unité</label>
                <Input value={(productForm.unit || "u") as any} onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })} className="rounded-xl mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Image (URL)</label>
                <Input value={(productForm.imageUrl || "") as any} onChange={(e) => setProductForm({ ...productForm, imageUrl: e.target.value })} className="rounded-xl mt-1" />
              </div>
            </div>

            <div className="flex justify-end">
              <Button size="sm" className="rounded-xl" onClick={handleAddOne} disabled={!canEdit}>
                <Plus className="w-4 h-4 mr-2" /> Ajouter
              </Button>
            </div>
          </div>

          <div className="pulse-card p-0 overflow-hidden">
            <div className="p-3 border-b border-border flex items-center justify-between">
              <p className="text-sm font-semibold">Liste</p>
              <p className="text-xs text-muted-foreground">{filtered.length} / {products.length}</p>
            </div>

            <div className="max-h-[45vh] overflow-y-auto divide-y divide-border">
              {filtered.map((p) => (
                <div key={p.id} className="p-3 flex items-center gap-3">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt={p.name} className="w-10 h-10 rounded-lg object-cover border" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-xs text-muted-foreground">—</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {p.reference ? `Ref: ${p.reference} • ` : ""}{p.unitPrice.toLocaleString("fr-FR")} € / {p.unit || "u"}
                    </p>
                  </div>
                  {canEdit && (
                    <Button size="icon" variant="ghost" className="rounded-lg text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={() => handleDeleteProduct(p.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
              {filtered.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">Aucun produit</div>}
            </div>
          </div>
        </div>

        {showImport && (
          <>
            <div className="fixed inset-0 bg-black/60 z-[60]" onClick={() => setShowImport(false)} />
            <div className="fixed bottom-0 left-0 right-0 bg-card rounded-t-3xl z-[61] max-h-[85vh] overflow-y-auto">
              <div className="sticky top-0 bg-card rounded-t-3xl p-4 border-b border-border">
                <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">Importer Produits</h3>
                  <Button variant="ghost" size="icon" onClick={() => setShowImport(false)} className="rounded-xl">
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              <div className="p-4 space-y-4 pb-10">
                <div className="pulse-card p-4 space-y-3">
                  <p className="text-sm text-muted-foreground">Format : <span className="font-medium">Référence;Nom;Prix</span> (Unit;ImageUrl optionnels)</p>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium">Unité par défaut</label>
                      <Input value={importUnit} onChange={(e) => setImportUnit(e.target.value)} className="rounded-xl mt-1" placeholder="u" />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Fichier (CSV/TXT)</label>
                      <Input type="file" accept=".csv,.txt,text/plain,text/csv" className="rounded-xl mt-1" onChange={(e) => handleFile(e.target.files?.[0] || null)} />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Coller le texte</label>
                    <Textarea value={importText} onChange={(e) => setImportText(e.target.value)} className="rounded-xl mt-1 min-h-[180px]" placeholder={"REF001;Saumon frais;12.5\nREF002;Avocat;1.1"} />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" className="rounded-xl" onClick={() => setShowImport(false)}>
                      Annuler
                    </Button>
                    <Button className="rounded-xl" onClick={handleImport} disabled={!canEdit}>
                      Importer
                    </Button>
                  </div>

                  {!canEdit && <p className="text-xs text-muted-foreground">Vous n'avez pas les droits pour importer.</p>}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
