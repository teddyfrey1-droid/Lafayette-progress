"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type React from "react"
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { PermissionGate } from "@/components/auth/permission-gate"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/components/auth/auth-provider"
import Link from "next/link"
import {
  Calendar,
  FileText,
  Loader2,
  Mail,
  Package,
  Plus,
  Send,
  Settings,
  Truck,
  BadgeCheck,
  CheckCircle2,
  Save,
  X,
  Search,
  Gift,
  Store,
  ChevronRight,
  AlertTriangle
} from "lucide-react"
import {
  addOrder,
  getOrders,
  getOrdersStoreEventName,
  getSuppliers,
  hydrateOrdersStore,
  markOrderAsSent,
  markOrderAsDelivered,
  saveOrderReceipt,
  updateOrder,
  Order,
  OrderProduct,
  OrderSupplier,
} from "@/lib/demo/orders-store"

import {
  defaultCompanyEmailSettings,
  loadCompanyEmailSettings,
  saveCompanyEmailSettings,
  resolveRecipients,
  type CompanyEmailSettings,
  type EmailMode,
} from "@/lib/email-settings"

import { cn } from "@/lib/utils"

// --- UTILITAIRES DE CALCUL ET FORMATAGE ---

function formatEuro(n: number) {
  const v = Number(n || 0)
  return `${v.toFixed(2).replace(".", ",")} €`
}

function normalizeUnit(u: string) {
  return (u || "").toString().trim().toUpperCase()
}

function unitStep(unitRaw: string) {
  const u = normalizeUnit(unitRaw)
  if (u === "KG") return 0.1
  if (u === "G" || u === "GR" || u === "GRS") return 10
  if (u === "L") return 0.1
  if (u === "ML" || u === "CL") return 10
  return 1
}

function convertPackToProductUnit(packQty: number | undefined, packUnitRaw: string | undefined, productUnitRaw: string) {
  const packUnit = normalizeUnit(packUnitRaw || "")
  const productUnit = normalizeUnit(productUnitRaw)
  if (!packQty || !packUnit) return undefined

  // Masse
  if (productUnit === "KG" && (packUnit === "KG" || packUnit === "KGS")) return packQty
  if (productUnit === "KG" && (packUnit === "G" || packUnit === "GR" || packUnit === "GRS")) return packQty / 1000
  if ((productUnit === "G" || productUnit === "GR" || productUnit === "GRS") && (packUnit === "KG" || packUnit === "KGS")) return packQty * 1000
  if ((productUnit === "G" || productUnit === "GR" || productUnit === "GRS") && (packUnit === "G" || packUnit === "GR" || packUnit === "GRS")) return packQty

  // Volume
  if (productUnit === "L" && packUnit === "L") return packQty
  if (productUnit === "L" && packUnit === "ML") return packQty / 1000
  if (productUnit === "L" && packUnit === "CL") return packQty / 100
  if (productUnit === "ML" && packUnit === "L") return packQty * 1000
  if (productUnit === "ML" && packUnit === "ML") return packQty
  if (productUnit === "CL" && packUnit === "L") return packQty * 100
  if (productUnit === "CL" && packUnit === "CL") return packQty

  // Unité identique
  if (productUnit === packUnit) return packQty

  return undefined
}

function todayISO() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function normalizeEmails(raw: string) {
  return (raw || "")
    .split(/[;,\n\t ]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function getFrancoThresholdEuros(supplier: OrderSupplier | null): number | null {
  if (!supplier) return null
  const v = Number((supplier as any).francoThreshold)
  if (Number.isFinite(v) && v > 0) return v
  const raw = (supplier.franco || "").toString()
  const m = raw.replace(/\s/g, "").match(/([0-9]+(?:[\.,][0-9]+)?)/)
  if (!m) return null
  const n = Number(String(m[1]).replace(",", "."))
  return Number.isFinite(n) && n > 0 ? n : null
}

function getRandomColor(name: string) {
  const colors = [
    "bg-blue-100 text-blue-700",
    "bg-emerald-100 text-emerald-700",
    "bg-violet-100 text-violet-700",
    "bg-amber-100 text-amber-700",
    "bg-rose-100 text-rose-700",
    "bg-cyan-100 text-cyan-700",
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

// --- COMPOSANT CARTE PRODUIT (LUDIQUE) ---

function ProductCard({
  line,
  step,
  packAdd,
  onIncrement,
  onDecrement,
  onSetQty,
  onAddPack,
}: {
  line: OrderProduct
  step: number
  packAdd: number | undefined
  onIncrement: (fromEl: HTMLElement | null) => void
  onDecrement: () => void
  onSetQty: (qtyRaw: string) => void
  onAddPack: (fromEl: HTMLElement | null) => void
}) {
  const startX = useRef<number | null>(null)
  const [dx, setDx] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  const qty = Number(line.quantity || 0)
  const lineTotal = Number(line.total || 0)

  const resetDrag = () => {
    setDx(0)
    setIsDragging(false)
    startX.current = null
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    startX.current = e.clientX
    setIsDragging(true)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || startX.current === null) return
    const next = e.clientX - startX.current
    const clamped = Math.max(-90, Math.min(90, next))
    setDx(clamped)
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return
    const finalDx = dx
    const target = e.currentTarget as HTMLElement
    resetDrag()
    if (finalDx > 60) {
      onIncrement(target)
    } else if (finalDx < -60) {
      onDecrement()
    }
  }

  return (
    <div
      className={cn(
        "relative p-4 rounded-3xl bg-card border border-border/40 shadow-sm mb-3 overflow-hidden select-none touch-pan-y",
        qty > 0 ? "ring-2 ring-primary/20 border-primary/40 bg-primary/5" : ""
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={resetDrag}
    >
      {/* Swipe Backgrounds */}
      <div 
        className="absolute inset-y-0 left-0 w-full bg-emerald-500 flex items-center justify-start pl-6 text-white font-bold"
        style={{ opacity: dx > 0 ? Math.min(dx / 80, 1) : 0 }}
      >
        <Plus className="w-6 h-6" />
      </div>
      <div 
        className="absolute inset-y-0 right-0 w-full bg-rose-500 flex items-center justify-end pr-6 text-white font-bold"
        style={{ opacity: dx < 0 ? Math.min(Math.abs(dx) / 80, 1) : 0 }}
      >
        <div className="w-4 h-1 bg-white rounded-full" />
      </div>

      <div 
        className="relative z-10 flex items-start justify-between gap-4 transition-transform duration-200 ease-out"
        style={{ transform: `translateX(${dx}px)` }}
      >
        <div className="min-w-0 flex-1">
          <div className="font-bold text-sm leading-tight text-foreground line-clamp-2">{line.productName}</div>
          <div className="mt-1.5 text-xs text-muted-foreground flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-md px-1.5 py-0 h-5 text-[10px] font-medium border-border/50">
                {line.unit}
            </Badge>
            <span>{formatEuro(line.unitPrice)}/{line.unit}</span>
            {line.packLabel && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-md">📦 {line.packLabel}</span>}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
           {/* Controls */}
           <div className="flex items-center bg-white rounded-xl border border-border/50 shadow-sm h-9 p-0.5">
               <button
                  type="button"
                  className="w-8 h-full flex items-center justify-center text-foreground hover:bg-muted/50 rounded-lg transition-colors disabled:opacity-30"
                  onClick={onDecrement}
                  disabled={qty <= 0}
               >
                   −
               </button>
               <div className="w-10 h-full border-x border-border/20 flex items-center justify-center">
                   <Input 
                      type="number"
                      min={0}
                      step={step}
                      value={qty || ""}
                      placeholder="0"
                      onChange={(e) => onSetQty(e.target.value)}
                      className="w-full h-full border-0 text-center p-0 bg-transparent text-sm font-bold focus-visible:ring-0 tabular-nums"
                   />
               </div>
               <button
                  type="button"
                  className="w-8 h-full flex items-center justify-center text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm transition-colors"
                  onClick={(e) => onIncrement(e.currentTarget as any)}
               >
                   <Plus className="w-4 h-4" />
               </button>
           </div>
           
           {/* Total Price for line */}
           {qty > 0 && (
               <div className="text-sm font-bold text-primary tabular-nums animate-in slide-in-from-right-2 fade-in duration-300">
                   {formatEuro(lineTotal)}
               </div>
           )}
        </div>
      </div>
    </div>
  )
}

// --- PAGE PRINCIPALE ---

export default function CommandesPage() {
  const { profile, isDemo, user, company } = useAuth()
  const { toast } = useToast()

  const companyId: string | undefined = isDemo
    ? "demo-company"
    : ((profile as any)?.companyId as string | undefined)

  const companyName = (company?.name || (profile as any)?.companyName || "") as string

  // Etats globaux
  const [loading, setLoading] = useState(true)
  const [suppliers, setSuppliers] = useState<OrderSupplier[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [sendingOrderId, setSendingOrderId] = useState<string | null>(null)

  // Sheet "Nouvelle Commande"
  const [openNewOrder, setOpenNewOrder] = useState(false)
  const [supplierId, setSupplierId] = useState<string>("")
  const [deliveryDate, setDeliveryDate] = useState<string>(todayISO())
  const [notes, setNotes] = useState<string>("")
  const [ccList, setCcList] = useState<string[]>([])
  const [ccInput, setCcInput] = useState<string>("")
  
  // Settings Email (Dialog)
  const [openEmailSettings, setOpenEmailSettings] = useState(false)
  const [emailSettings, setEmailSettings] = useState<CompanyEmailSettings>(defaultCompanyEmailSettings())
  const [emailSettingsDraft, setEmailSettingsDraft] = useState<CompanyEmailSettings>(defaultCompanyEmailSettings())
  const [savingEmailSettings, setSavingEmailSettings] = useState(false)

  // Produits & Panier
  const [productSearch, setProductSearch] = useState<string>("")
  const [orderLines, setOrderLines] = useState<OrderProduct[]>([])
  const [openCartSummary, setOpenCartSummary] = useState(false)

  // Animations UI
  const cartTargetRef = useRef<HTMLDivElement | null>(null)
  const [cartBump, setCartBump] = useState(false)
  const francoCelebratedRef = useRef(false)

  // Détails Commande / Réception
  const [openOrderDetails, setOpenOrderDetails] = useState(false)
  const [activeOrder, setActiveOrder] = useState<Order | null>(null)
  const [detailsMode, setDetailsMode] = useState<"view" | "receive">("view")
  const [receiptLines, setReceiptLines] = useState<OrderProduct[]>([])

  // --- EFFETS ---

  useEffect(() => {
    if (!companyId) return
    loadCompanyEmailSettings(companyId)
      .then((s) => setEmailSettings(s))
      .catch(() => {})
  }, [companyId])

  useEffect(() => {
    if (openEmailSettings) setEmailSettingsDraft(emailSettings)
  }, [openEmailSettings, emailSettings])

  // Chargement initial
  useEffect(() => {
    if (!companyId) return
    let cancelled = false
    setLoading(true)
    hydrateOrdersStore(companyId)
      .then(() => {
        if (cancelled) return
        setSuppliers(getSuppliers(companyId))
        setOrders(getOrders(companyId))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [companyId])

  // Sync auto (multi-tab)
  useEffect(() => {
    if (!companyId) return
    const cid = companyId
    const onAnyChange = (e?: any) => {
      const eventCompanyId = e?.detail?.companyId as string | undefined
      if (eventCompanyId && eventCompanyId !== cid) return
      setSuppliers(getSuppliers(cid))
      setOrders(getOrders(cid))
    }
    const evtName = getOrdersStoreEventName()
    window.addEventListener(evtName, onAnyChange as any)
    window.addEventListener("storage", onAnyChange as any)
    return () => {
      window.removeEventListener(evtName, onAnyChange as any)
      window.removeEventListener("storage", onAnyChange as any)
    }
  }, [companyId])

  // --- MEMO & CALCULS ---

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === supplierId) || null,
    [suppliers, supplierId],
  )

  const totalAmount = useMemo(() => {
    return orderLines.reduce((sum, p) => sum + (Number(p.total) || 0), 0)
  }, [orderLines])

  const francoThreshold = useMemo(() => getFrancoThresholdEuros(selectedSupplier), [selectedSupplier])
  const francoProgress = useMemo(() => {
    if (!francoThreshold || francoThreshold <= 0) return null
    const pct = Math.min(100, Math.round((totalAmount / francoThreshold) * 100))
    const remaining = Math.max(0, francoThreshold - totalAmount)
    return { pct, remaining }
  }, [francoThreshold, totalAmount])

  // Celebration Franco
  const triggerFrancoCelebration = () => {
    if (typeof window === "undefined") return
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      ;(navigator as any).vibrate?.(50)
    }
    toast({
        title: "🎉 FRANCO ATTEINT !",
        description: "Livraison offerte pour cette commande.",
        className: "bg-emerald-600 border-none text-white",
    })
  }

  useEffect(() => {
    if (!francoProgress) {
      francoCelebratedRef.current = false
      return
    }
    if (francoProgress.remaining <= 0 && !francoCelebratedRef.current) {
      francoCelebratedRef.current = true
      triggerFrancoCelebration()
    }
    if (francoProgress.remaining > 0) {
      francoCelebratedRef.current = false
    }
  }, [francoProgress?.remaining])

  // --- LOGIQUE PANIER & PRODUITS ---

  // Rebuild lines when supplier changes
  useEffect(() => {
    if (!selectedSupplier) {
      setOrderLines([])
      setCcList([])
      setCcInput("")
      return
    }

    const products = selectedSupplier.products || []
    setOrderLines(
      products.map((p) => ({
        id: `ol_${p.id}`,
        productId: p.id,
        productName: p.name,
        reference: p.reference || undefined,
        quantity: 0,
        unitPrice: Number(p.unitPrice || 0),
        unit: p.unit || "u",
        category: (p as any).category,
        packLabel: (p as any).packLabel,
        packQuantity: (p as any).packQuantity,
        packUnit: (p as any).packUnit,
        total: 0,
      })),
    )

    setCcList((selectedSupplier.ccEmails || []).map((e: any) => String(e).toLowerCase()))
    setCcInput("")
  }, [selectedSupplier])

  const updateQty = (lineId: string, qtyRaw: string) => {
    const qty = Number(qtyRaw || 0)
    setOrderLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l
        const q = Number.isFinite(qty) ? Math.max(0, qty) : 0
        const total = q * (Number(l.unitPrice) || 0)
        return { ...l, quantity: q, total }
      }),
    )
  }

  // Animation "Fly to cart" simplifiée (juste un bump du panier)
  const changeQty = (lineId: string, delta: number, fromEl?: HTMLElement | null) => {
    setOrderLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l
        const q = Math.max(0, Number(l.quantity || 0) + delta)
        const total = q * (Number(l.unitPrice) || 0)
        return { ...l, quantity: q, total }
      }),
    )
    if (delta > 0) {
        setCartBump(true)
        setTimeout(() => setCartBump(false), 200)
    }
  }

  const filteredLines = useMemo(() => {
    const q = productSearch.trim().toLowerCase()
    if (!q) return orderLines
    return orderLines.filter((p) =>
      `${p.productName} ${p.reference || ""}`.toLowerCase().includes(q),
    )
  }, [orderLines, productSearch])


  // --- LOGIQUE ENVOI & RECEPTION ---

  const handleSend = async () => {
    if (!companyId) return
    if (!selectedSupplier) return
    if (!selectedSupplier.email || !selectedSupplier.email.trim()) {
      toast({ title: "Email manquant", description: "Le fournisseur n'a pas d'email.", variant: "destructive" })
      return
    }

    const lines = orderLines.filter((l) => Number(l.quantity) > 0)
    if (lines.length === 0) {
      toast({ title: "Panier vide", description: "Ajoute des produits.", variant: "destructive" })
      return
    }

    const manualCc = Array.from(new Set([...(ccList || []), ...normalizeEmails(ccInput)]))
    const { ccEmails, bccEmails, contactsCount } = resolveRecipients(emailSettings.order, manualCc)

    try {
      const newOrder = await addOrder(companyId, {
        supplierId: selectedSupplier.id,
        supplierName: selectedSupplier.name,
        supplierEmail: selectedSupplier.email,
        ccEmails: ccEmails.length ? ccEmails : undefined,
        bccEmails: bccEmails.length ? bccEmails : undefined,
        products: lines,
        totalAmount: lines.reduce((s, p) => s + (Number(p.total) || 0), 0),
        deliveryDate,
        status: "draft",
        notes: notes || undefined,
      })

      setOrders((prev) => [newOrder, ...prev])

      const orderNumber = (newOrder.orderNumber || newOrder.id.slice(-6)).toUpperCase()
      const token = await user?.getIdToken().catch(() => undefined)

      await fetch("/api/commandes/send-email", {
        method: "POST",
        headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          toEmail: selectedSupplier.email,
          toName: selectedSupplier.name,
          subject: `Bon de commande ${orderNumber} — ${companyName}`,
          companyName: companyName || "Entreprise",
          ccEmails,
          bccEmails,
          order: { ...newOrder, orderNumber },
        }),
      })

      await markOrderAsSent(companyId, newOrder.id)
      setOrders(getOrders(companyId))

      toast({
        title: "✅ Commande envoyée",
        description: `Envoyée à ${selectedSupplier.name}. ${contactsCount ? `+ Copie à vos ${contactsCount} contacts.` : ""}`,
      })

      setOpenNewOrder(false)
      setSupplierId("")
      setNotes("")
      setCcList([])
      setCcInput("")
      setProductSearch("")
      setOrderLines([])
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message || "Échec de l'envoi.", variant: "destructive" })
    }
  }

  const handleResend = async (o: Order) => {
      // Logique identique (simplifiée pour la lecture mais fonctionnelle)
      if (!companyId) return
      setSendingOrderId(o.id)
      try {
          const supplier = suppliers.find(s => s.id === o.supplierId)
          const toEmail = o.supplierEmail || supplier?.email || ""
          const token = await user?.getIdToken()
          await fetch("/api/commandes/send-email", {
              method: "POST",
              headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
              body: JSON.stringify({
                  toEmail,
                  toName: o.supplierName,
                  subject: `Bon de commande ${o.orderNumber || o.id} (Relance)`,
                  companyName,
                  order: o
              })
          })
          toast({ title: "Bon renvoyé" })
      } catch(e) {
          toast({ title: "Erreur", variant: "destructive" })
      } finally {
          setSendingOrderId(null)
      }
  }

  const openDetails = (o: Order, mode: "view" | "receive") => {
    setActiveOrder(o)
    setDetailsMode(mode)
    const init = (o.products || []).map((p) => ({
      ...p,
      receivedQuantity: typeof (p as any).receivedQuantity === "number" ? (p as any).receivedQuantity : Number(p.quantity || 0),
      receivedOk: typeof (p as any).receivedOk === "boolean" ? (p as any).receivedOk : undefined,
      receivedNote: typeof (p as any).receivedNote === "string" ? (p as any).receivedNote : "",
    }))
    setReceiptLines(init)
    setOpenOrderDetails(true)
  }

  const markAllOk = () => {
    setReceiptLines((prev) =>
      prev.map((l) => ({
        ...l,
        receivedOk: true,
        receivedQuantity: typeof l.receivedQuantity === "number" ? l.receivedQuantity : Number(l.quantity || 0),
      })),
    )
  }

  const finalizeReceipt = async () => {
      if(!companyId || !activeOrder) return
      try {
          // Validation rapide
          const hasProblems = receiptLines.some((l) => (l as any).receivedOk === false)
          await updateOrder(companyId, activeOrder.id, {
              products: receiptLines,
              status: "delivered",
              deliveredAt: new Date().toISOString()
          } as any)
          setOrders(getOrders(companyId))
          toast({ title: "Réception validée !" })
          setOpenOrderDetails(false)
          
          // Envoi auto du rapport (OK ou Litige)
          const token = await user?.getIdToken()
          const endpoint = hasProblems ? "/api/commandes/send-nonconformity" : "/api/commandes/send-receipt-ok"
          const settings = hasProblems ? emailSettings.receiptIssue : emailSettings.receiptOk
          const { ccEmails, bccEmails } = resolveRecipients(settings, [])
          
          fetch(endpoint, {
              method: "POST",
              headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
              body: JSON.stringify({
                  toEmail: activeOrder.supplierEmail,
                  toName: activeOrder.supplierName,
                  subject: hasProblems ? "Non-conformité" : "Réception conforme",
                  companyName,
                  ccEmails,
                  bccEmails,
                  order: { ...activeOrder, products: receiptLines }
              })
          }).catch(console.error)
          
      } catch(e) {
          toast({ title: "Erreur réception", variant: "destructive" })
      }
  }

  // Listes filtrées
  const pendingReceptionOrders = orders.filter((o) => o.status === "sent" || o.status === "confirmed")
  const deliveredOrders = orders.filter((o) => o.status === "delivered")
  const draftOrders = orders.filter((o) => o.status === "draft")

  // --- RENDU ---

  return (
    <PermissionGate moduleId="commandes" redirect>
      <div className="min-h-screen bg-muted/5 pb-28">
        <Header />

        <main className="max-w-md mx-auto px-4 py-6 space-y-8">
          
          {/* 1. FOURNISSEURS (GRILLE METRO/SYSCO) */}
          <section>
             <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold tracking-tight text-foreground">Fournisseurs</h2>
                <Button variant="ghost" size="sm" className="text-primary text-xs" asChild>
                    <Link href="/fournisseurs">Gérer</Link>
                </Button>
             </div>
             
             {loading ? (
                 <div className="flex justify-center p-8"><Loader2 className="animate-spin text-muted-foreground" /></div>
             ) : suppliers.length === 0 ? (
                <div className="p-6 rounded-3xl bg-white border border-dashed border-muted-foreground/30 text-center space-y-3">
                    <Store className="w-10 h-10 mx-auto text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">Aucun fournisseur configuré.</p>
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/fournisseurs">Ajouter un fournisseur</Link>
                    </Button>
                </div>
             ) : (
                <div className="grid grid-cols-2 gap-3">
                    {/* Carte "Nouvelle Commande" Générique */}
                    <button 
                         onClick={() => { setSupplierId(""); setOpenNewOrder(true) }}
                         className="col-span-2 flex items-center justify-between p-4 rounded-3xl bg-gradient-to-r from-primary to-purple-600 text-white shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all active:scale-[0.98]"
                     >
                         <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                                 <Plus className="w-6 h-6 text-white" />
                             </div>
                             <div className="text-left">
                                 <div className="font-bold text-lg">Nouvelle commande</div>
                                 <div className="text-xs text-white/80">Choisir un fournisseur</div>
                             </div>
                         </div>
                         <ChevronRight className="w-5 h-5 text-white/70" />
                     </button>

                    {/* Grille des Fournisseurs Favoris */}
                    {suppliers.map(s => {
                        const colorClass = getRandomColor(s.name);
                        return (
                            <button 
                                key={s.id}
                                onClick={() => { setSupplierId(s.id); setOpenNewOrder(true); }}
                                className="group relative flex flex-col items-center justify-center p-5 rounded-3xl bg-white border border-border/50 shadow-sm hover:shadow-md transition-all active:scale-95"
                            >
                                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold mb-3 shadow-inner", colorClass)}>
                                    {s.name.substring(0, 2).toUpperCase()}
                                </div>
                                <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1">{s.name}</span>
                                {/* Badge promo/franco si dispo - future feature */}
                            </button>
                        )
                    })}
                </div>
             )}
          </section>

          {/* 2. EN ATTENTE DE RÉCEPTION */}
          <section>
              <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
                      <Truck className="w-5 h-5 text-primary" />
                      En attente
                  </h2>
                  {pendingReceptionOrders.length > 0 && (
                      <Badge variant="secondary" className="rounded-full px-2">{pendingReceptionOrders.length}</Badge>
                  )}
              </div>

              {pendingReceptionOrders.length === 0 ? (
                  <div className="rounded-3xl bg-white p-8 text-center border border-border/40 shadow-sm">
                      <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                           <CheckCircle2 className="w-10 h-10 text-emerald-200" />
                      </div>
                      <h3 className="font-bold text-foreground">Rien à réceptionner</h3>
                      <p className="text-sm text-muted-foreground mt-1">Tout est en ordre. Votre stock est à jour !</p>
                  </div>
              ) : (
                  <div className="space-y-3">
                      {pendingReceptionOrders.map(o => (
                          <div key={o.id} className="p-4 rounded-3xl bg-white border border-border/40 shadow-sm flex flex-col gap-3">
                              <div className="flex items-center justify-between">
                                  <div className="font-bold text-sm">{o.supplierName}</div>
                                  <Badge variant="outline" className="rounded-lg text-[10px] h-5 bg-amber-50 text-amber-700 border-amber-200">Envoyée</Badge>
                              </div>
                              <div className="flex items-center justify-between text-sm text-muted-foreground">
                                  <span>{o.deliveryDate}</span>
                                  <span className="font-mono font-medium text-foreground">{formatEuro(o.totalAmount)}</span>
                              </div>
                              <div className="flex gap-2 mt-1">
                                  <Button variant="outline" size="sm" className="flex-1 rounded-xl h-9 text-xs" onClick={() => handleResend(o)}>
                                      Relancer
                                  </Button>
                                  <Button size="sm" className="flex-1 rounded-xl h-9 text-xs" onClick={() => openDetails(o, "receive")}>
                                      Réceptionner
                                  </Button>
                              </div>
                          </div>
                      ))}
                  </div>
              )}
          </section>
          
          {/* 3. HISTORIQUE RAPIDE (Dernières reçues) */}
          {deliveredOrders.length > 0 && (
            <section>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold tracking-tight text-muted-foreground">Historique récent</h2>
                </div>
                <div className="space-y-2 opacity-80">
                    {deliveredOrders.slice(0, 3).map(o => (
                        <div key={o.id} className="flex items-center justify-between p-3 rounded-2xl bg-white/50 border border-border/30">
                            <span className="text-sm font-medium">{o.supplierName}</span>
                            <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-md">Reçue</span>
                        </div>
                    ))}
                </div>
            </section>
          )}

        </main>

        {/* --- SHEET NOUVELLE COMMANDE --- */}
        <Sheet open={openNewOrder} onOpenChange={setOpenNewOrder}>
          <SheetContent side="bottom" className="h-[95vh] rounded-t-[32px] p-0 flex flex-col bg-muted/10">
              
              {/* Header Fixe */}
              <div className="bg-white px-6 pt-6 pb-4 rounded-t-[32px] shadow-sm z-10">
                 <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mb-6 opacity-50" />
                 
                 <div className="flex items-center justify-between mb-4">
                     <h2 className="text-2xl font-bold tracking-tight">Nouvelle commande</h2>
                     {selectedSupplier && (
                         <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                             {selectedSupplier.name.substring(0, 2).toUpperCase()}
                         </div>
                     )}
                 </div>
                 
                 {/* Selecteur Fournisseur */}
                 <Select value={supplierId} onValueChange={setSupplierId}>
                    <SelectTrigger className="w-full h-12 rounded-2xl bg-muted/30 border-0 text-base font-medium px-4 mb-2">
                        <SelectValue placeholder="Sélectionner un fournisseur" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                        {suppliers.map(s => <SelectItem key={s.id} value={s.id} className="rounded-xl my-1">{s.name}</SelectItem>)}
                    </SelectContent>
                 </Select>

                 {/* Jauge Franco "Gamifiée" */}
                 {selectedSupplier && francoThreshold && francoProgress && (
                     <div className="mt-3 p-1">
                         <div className="relative h-12 bg-white rounded-2xl overflow-hidden border border-border/50 shadow-sm flex items-center px-4">
                             {/* Background Bar Progress */}
                             <div 
                                className={cn("absolute inset-y-0 left-0 transition-all duration-700 ease-out", 
                                    francoProgress.remaining <= 0 ? "bg-gradient-to-r from-emerald-400 to-teal-500" : "bg-gradient-to-r from-orange-100 to-amber-200"
                                )}
                                style={{ width: `${francoProgress.pct}%`, opacity: francoProgress.remaining <= 0 ? 0.2 : 0.5 }}
                             />
                             {/* Ligne de progression en bas */}
                             <div 
                                className={cn("absolute bottom-0 left-0 h-1 transition-all duration-700 ease-out", 
                                    francoProgress.remaining <= 0 ? "bg-emerald-500" : "bg-primary"
                                )}
                                style={{ width: `${francoProgress.pct}%` }}
                             />

                             <div className="relative z-10 flex-1 flex items-center justify-between text-sm font-medium">
                                 <span className={cn("transition-colors", francoProgress.remaining <= 0 ? "text-emerald-700 font-bold" : "text-muted-foreground")}>
                                     {francoProgress.remaining <= 0 ? "🎉 Livraison offerte !" : `Encore ${formatEuro(francoProgress.remaining)} pour le franco`}
                                 </span>
                                 <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-lg", francoProgress.remaining <= 0 ? "bg-emerald-100 text-emerald-800" : "bg-white text-primary shadow-sm")}>
                                     {francoProgress.remaining <= 0 ? <Gift className="w-4 h-4 animate-bounce" /> : <Truck className="w-3.5 h-3.5" />}
                                     <span>{francoProgress.pct}%</span>
                                 </div>
                             </div>
                         </div>
                     </div>
                 )}
              </div>

              {/* Contenu Scrollable */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
                 {selectedSupplier ? (
                     <>
                        {/* Options Livraison & Email */}
                        <div className="grid grid-cols-2 gap-3">
                           <div className="space-y-1.5">
                               <Label className="text-xs font-semibold text-muted-foreground ml-1 uppercase tracking-wide">Date</Label>
                               <div className="relative">
                                   <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                   <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="pl-10 rounded-2xl bg-white border-border/50 h-11 text-sm font-medium shadow-sm" />
                               </div>
                           </div>
                           <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-muted-foreground ml-1 uppercase tracking-wide">Copie</Label>
                                <Button variant="outline" className="w-full justify-start text-left font-normal rounded-2xl h-11 bg-white border-border/50 shadow-sm px-3" onClick={() => setOpenEmailSettings(true)}>
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 text-blue-600">
                                            <Mail className="w-3.5 h-3.5" />
                                        </div>
                                        <span className="truncate text-xs">
                                            {emailSettings.order.emails.length > 0 ? `${emailSettings.order.emails.length} contact(s)` : "Aucune copie"}
                                        </span>
                                    </div>
                                </Button>
                           </div>
                        </div>

                        {/* Search */}
                        <div className="relative sticky top-0 z-20 pt-2 pb-1 bg-muted/10 backdrop-blur-sm">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input 
                                placeholder="Rechercher un produit..." 
                                value={productSearch} 
                                onChange={(e) => setProductSearch(e.target.value)}
                                className="pl-10 h-12 rounded-2xl bg-white border-0 shadow-sm text-base"
                            />
                        </div>

                        {/* Liste Produits */}
                        <div className="space-y-4 pb-24">
                             {filteredLines.length > 0 ? (
                                 filteredLines.map(line => {
                                    const step = unitStep(line.unit)
                                    return (
                                        <ProductCard 
                                            key={line.id} 
                                            line={line} 
                                            step={step} 
                                            packAdd={convertPackToProductUnit(line.packQuantity, line.packUnit, line.unit)}
                                            onSetQty={(v) => updateQty(line.id, v)}
                                            onIncrement={(el) => changeQty(line.id, step, el)}
                                            onDecrement={() => changeQty(line.id, -step)}
                                            onAddPack={(el) => {
                                                const p = convertPackToProductUnit(line.packQuantity, line.packUnit, line.unit);
                                                if(p) changeQty(line.id, p, el)
                                            }}
                                        />
                                    )
                                 })
                             ) : (
                                 <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                     <Search className="w-12 h-12 opacity-20 mb-3" />
                                     <p className="text-sm">Aucun produit trouvé.</p>
                                 </div>
                             )}
                        </div>
                     </>
                 ) : (
                     <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50">
                         <Store className="w-16 h-16 mb-4 stroke-1" />
                         <p>Sélectionnez un fournisseur pour commencer</p>
                     </div>
                 )}
              </div>

              {/* Footer Flottant (Total & Action) */}
              {selectedSupplier && (
                  <div className="absolute bottom-6 left-4 right-4 z-30">
                      <div className="bg-foreground text-background p-2 pl-6 pr-2 rounded-[28px] shadow-2xl flex items-center justify-between" ref={cartTargetRef}>
                          <div className={cn("flex flex-col transition-transform duration-200", cartBump ? "scale-110" : "")}>
                              <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-bold">Total Estimé</span>
                              <span className="text-xl font-bold tabular-nums leading-none text-white">{formatEuro(totalAmount)}</span>
                          </div>
                          <Button 
                              size="lg" 
                              className="rounded-[22px] px-8 h-14 bg-primary hover:bg-primary/90 text-white font-bold shadow-lg shadow-primary/25 transition-all active:scale-95"
                              onClick={handleSend}
                              disabled={totalAmount <= 0}
                          >
                              <span className="mr-2">Envoyer</span>
                              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                                <Send className="w-3.5 h-3.5" />
                              </div>
                          </Button>
                      </div>
                  </div>
              )}

          </SheetContent>
        </Sheet>
        
        {/* Dialog Email Rapide */}
        <Dialog open={openEmailSettings} onOpenChange={setOpenEmailSettings}>
            <DialogContent className="rounded-3xl max-w-sm">
                <DialogHeader>
                    <DialogTitle>Emails automatiques (Copie)</DialogTitle>
                    <DialogDescription>
                        Les adresses ci-dessous recevront une copie cachée (BCC) de la commande.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <Textarea 
                        value={emailSettingsDraft.order.emails.join(", ")}
                        onChange={(e) => setEmailSettingsDraft(prev => ({...prev, order: {...prev.order, emails: normalizeEmails(e.target.value)}}))}
                        className="min-h-[100px] rounded-2xl bg-muted/30 border-0 resize-none p-4"
                        placeholder="compta@restaurant.com, chef@restaurant.com..."
                    />
                    <Button 
                        onClick={() => { 
                            saveCompanyEmailSettings(companyId as string, emailSettingsDraft); 
                            setOpenEmailSettings(false); 
                            toast({title: "Sauvegardé", description: "Préférences mises à jour."})
                        }} 
                        className="w-full rounded-xl h-12"
                    >
                        Enregistrer
                    </Button>
                </div>
            </DialogContent>
        </Dialog>

        {/* Sheet Détails / Réception */}
        <Sheet open={openOrderDetails} onOpenChange={setOpenOrderDetails}>
            <SheetContent side="bottom" className="h-[95vh] rounded-t-[32px] p-0 flex flex-col bg-muted/10">
                <div className="bg-white px-6 pt-6 pb-4 rounded-t-[32px] shadow-sm">
                    <div className="w-12 h-1.5 bg-muted rounded-full mx-auto mb-6 opacity-50" />
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-xl font-bold">{activeOrder?.supplierName}</h2>
                        {activeOrder?.status === "sent" && <Badge variant="secondary">Envoyée</Badge>}
                        {activeOrder?.status === "delivered" && <Badge className="bg-emerald-500 hover:bg-emerald-600">Reçue</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground flex gap-4">
                        <span>{activeOrder?.deliveryDate}</span>
                        <span>{formatEuro(activeOrder?.totalAmount || 0)}</span>
                    </div>
                    
                    {detailsMode === "receive" && (
                         <div className="mt-4 flex gap-3">
                             <Button variant="outline" className="flex-1 rounded-xl" onClick={markAllOk}>Tout Valider</Button>
                         </div>
                    )}
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {receiptLines.map(line => {
                        const isProblem = (line as any).receivedOk === false
                        const isOk = (line as any).receivedOk === true
                        return (
                            <div key={line.id} className="p-4 rounded-3xl bg-white border border-border/40 shadow-sm">
                                <div className="flex justify-between mb-2">
                                    <span className="font-bold text-sm">{line.productName}</span>
                                    <span className="text-sm">{formatEuro(line.total)}</span>
                                </div>
                                <div className="flex items-center justify-between gap-3 bg-muted/20 p-2 rounded-xl">
                                    <div className="text-xs text-muted-foreground">
                                        Commandé: <span className="font-bold text-foreground">{line.quantity} {line.unit}</span>
                                    </div>
                                    {detailsMode === "receive" ? (
                                        <div className="flex gap-2">
                                            <Button size="sm" variant={isOk ? "default" : "outline"} className={cn("rounded-lg h-8 px-3", isOk && "bg-emerald-500 hover:bg-emerald-600")} onClick={() => {
                                                setReceiptLines(prev => prev.map(l => l.id === line.id ? { ...l, receivedOk: true } : l))
                                            }}>OK</Button>
                                            <Button size="sm" variant={isProblem ? "destructive" : "outline"} className="rounded-lg h-8 px-3" onClick={() => {
                                                setReceiptLines(prev => prev.map(l => l.id === line.id ? { ...l, receivedOk: false } : l))
                                            }}>⚠️</Button>
                                        </div>
                                    ) : (
                                        <div className="text-xs font-bold">
                                            {isOk ? <span className="text-emerald-600">Reçu OK</span> : <span className="text-red-600">Problème</span>}
                                        </div>
                                    )}
                                </div>
                                {isProblem && detailsMode === "receive" && (
                                    <Textarea 
                                        className="mt-2 text-xs bg-red-50 border-red-100" 
                                        placeholder="Décrire le problème..."
                                        value={(line as any).receivedNote || ""}
                                        onChange={(e) => setReceiptLines(prev => prev.map(l => l.id === line.id ? { ...l, receivedNote: e.target.value } : l))}
                                    />
                                )}
                            </div>
                        )
                    })}
                </div>
                
                {detailsMode === "receive" && (
                    <div className="p-4 bg-white border-t border-border">
                        <Button className="w-full h-12 rounded-xl text-lg font-bold" onClick={finalizeReceipt}>
                            Valider la réception
                        </Button>
                    </div>
                )}
            </SheetContent>
        </Sheet>

        <BottomNav />
      </div>
    </PermissionGate>
  )
}
