"use client"

import { useEffect, useMemo, useState } from "react"
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { PermissionGate } from "@/components/auth/permission-gate"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
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

  // Mass
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

  // Pieces-like
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

export default function CommandesPage() {
  const { profile, isDemo, user, company } = useAuth()
  const { toast } = useToast()

  const companyId: string | undefined = isDemo
    ? "demo-company"
    : ((profile as any)?.companyId as string | undefined)

  const companyName = (company?.name || (profile as any)?.companyName || "") as string

  const [loading, setLoading] = useState(true)
  const [suppliers, setSuppliers] = useState<OrderSupplier[]>([])
  const [orders, setOrders] = useState<Order[]>([])

  const [sendingOrderId, setSendingOrderId] = useState<string | null>(null)

  // New order sheet
  const [openNewOrder, setOpenNewOrder] = useState(false)
  const [supplierId, setSupplierId] = useState<string>("")
  const [deliveryDate, setDeliveryDate] = useState<string>(todayISO())
  const [notes, setNotes] = useState<string>("")
  const [ccText, setCcText] = useState<string>("")
  const [productSearch, setProductSearch] = useState<string>("")
  const [orderLines, setOrderLines] = useState<OrderProduct[]>([])

  // Order details / réception
  const [openOrderDetails, setOpenOrderDetails] = useState(false)
  const [activeOrder, setActiveOrder] = useState<Order | null>(null)
  const [detailsMode, setDetailsMode] = useState<"view" | "receive">("view")
  const [receiptLines, setReceiptLines] = useState<OrderProduct[]>([])


  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === supplierId) || null,
    [suppliers, supplierId],
  )

  const filteredLines = useMemo(() => {
    const q = productSearch.trim().toLowerCase()
    if (!q) return orderLines
    return orderLines.filter((p) =>
      `${p.productName} ${p.reference || ""}`.toLowerCase().includes(q),
    )
  }, [orderLines, productSearch])

  const totalAmount = useMemo(() => {
    return orderLines.reduce((sum, p) => sum + (Number(p.total) || 0), 0)
  }, [orderLines])


  const pendingReceptionOrders = useMemo(() => {
    return orders.filter((o) => o.status === "sent" || o.status === "confirmed")
  }, [orders])

  const deliveredOrders = useMemo(() => {
    return orders.filter((o) => o.status === "delivered")
  }, [orders])

  const draftOrders = useMemo(() => {
    return orders.filter((o) => o.status === "draft")
  }, [orders])

  // Load & hydrate
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

    return () => {
      cancelled = true
    }
  }, [companyId])

  // Sync (same tab + multi-tabs)
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

  // When supplier changes, (re)build order lines from supplier products
  useEffect(() => {
    if (!selectedSupplier) {
      setOrderLines([])
      setCcText("")
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

    setCcText((selectedSupplier.ccEmails || []).join(", "))
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

  const handleSend = async () => {
    if (!companyId) return
    if (!selectedSupplier) {
      toast({ title: "Erreur", description: "Sélectionne un fournisseur.", variant: "destructive" })
      return
    }

    if (!selectedSupplier.email || !selectedSupplier.email.trim()) {
      toast({
        title: "Email fournisseur manquant",
        description: "Renseigne l'email du fournisseur dans la page Fournisseurs.",
        variant: "destructive",
      })
      return
    }

    const lines = orderLines.filter((l) => Number(l.quantity) > 0)
    if (lines.length === 0) {
      toast({ title: "Erreur", description: "Ajoute au moins un produit (quantité > 0).", variant: "destructive" })
      return
    }

    if (!deliveryDate) {
      toast({ title: "Erreur", description: "Choisis une date de livraison.", variant: "destructive" })
      return
    }

    const ccEmails = normalizeEmails(ccText)

    try {
      // 1) Create order (draft)
      const newOrder = await addOrder(companyId, {
        supplierId: selectedSupplier.id,
        supplierName: selectedSupplier.name,
        supplierEmail: selectedSupplier.email,
        ccEmails: ccEmails.length ? ccEmails : undefined,
        products: lines,
        totalAmount: lines.reduce((s, p) => s + (Number(p.total) || 0), 0),
        deliveryDate,
        status: "draft",
        notes: notes || undefined,
      })

      setOrders((prev) => [newOrder, ...prev])

      // 2) Send email with PDF attachment
      const orderNumber = newOrder.id.slice(-6).toUpperCase()
      const token = await user?.getIdToken().catch(() => undefined)

      const subject = `Bon de commande ${orderNumber} — ${companyName || "Entreprise"}`

      const res = await fetch("/api/commandes/send-email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          toEmail: selectedSupplier.email,
          toName: selectedSupplier.name,
          subject,
          companyName: companyName || "Entreprise",
          ccEmails,
          order: {
            ...newOrder,
            orderNumber,
          },
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Échec envoi email")
      }

      // 3) Mark as sent
      await markOrderAsSent(companyId, newOrder.id)
      setOrders(getOrders(companyId))

      toast({
        title: "✅ Commande envoyée",
        description: `Bon de commande PDF envoyé à ${selectedSupplier.name}.`,
      })

      // Reset sheet
      setOpenNewOrder(false)
      setSupplierId("")
      setNotes("")
      setCcText("")
      setProductSearch("")
      setOrderLines([])
      setDeliveryDate(todayISO())
    } catch (e: any) {
      console.error(e)
      toast({
        title: "Erreur",
        description: e?.message || "Impossible d'envoyer la commande.",
        variant: "destructive",
      })
    }
  }


  const handleResend = async (o: Order) => {
    if (!companyId) return

    const supplier = suppliers.find((s) => s.id === o.supplierId) || null
    const toEmail = String(o.supplierEmail || supplier?.email || "").trim()
    const toName = String(o.supplierName || supplier?.name || "Fournisseur").trim() || "Fournisseur"

    if (!toEmail) {
      toast({
        title: "Email fournisseur manquant",
        description: "Renseigne l'email du fournisseur dans la page Fournisseurs.",
        variant: "destructive",
      })
      return
    }

    const ccEmails = (o.ccEmails && o.ccEmails.length ? o.ccEmails : (supplier?.ccEmails || []))

    setSendingOrderId(o.id)
    try {
      const token = await user?.getIdToken().catch(() => undefined)
      const orderNumber = o.id.slice(-6).toUpperCase()
      const subject = `Bon de commande ${orderNumber} — ${companyName || "Entreprise"}`

      const res = await fetch("/api/commandes/send-email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          toEmail,
          toName,
          subject,
          companyName: companyName || "Entreprise",
          ccEmails,
          order: {
            ...o,
            supplierName: toName,
            supplierEmail: toEmail,
            orderNumber,
          },
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Échec envoi email")
      }

      await markOrderAsSent(companyId, o.id)
      setOrders(getOrders(companyId))

      toast({
        title: "✅ Bon renvoyé",
        description: `Bon de commande PDF envoyé à ${toName}.`,
      })
    } catch (e: any) {
      console.error(e)
      toast({
        title: "Erreur",
        description: e?.message || "Impossible d'envoyer la commande.",
        variant: "destructive",
      })
    } finally {
      setSendingOrderId(null)
    }
  }


  const openDetails = (o: Order, mode: "view" | "receive") => {
    setActiveOrder(o)
    setDetailsMode(mode)
    // Init réception lignes
    const init = (o.products || []).map((p) => ({
      ...p,
      receivedQuantity: typeof (p as any).receivedQuantity === "number" ? (p as any).receivedQuantity : Number(p.quantity || 0),
      receivedOk: typeof (p as any).receivedOk === "boolean" ? (p as any).receivedOk : undefined,
      receivedNote: typeof (p as any).receivedNote === "string" ? (p as any).receivedNote : "",
    })) as OrderProduct[]
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

  const setLineReceipt = (lineId: string, patch: Partial<OrderProduct>) => {
    setReceiptLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, ...patch } : l)))
  }

  const receiptProgress = useMemo(() => {
    const total = receiptLines.length || 0
    const done = receiptLines.filter((l) => typeof (l as any).receivedOk === "boolean").length
    return { total, done }
  }, [receiptLines])

  const saveReceipt = async () => {
    if (!companyId || !activeOrder) return
    try {
      await saveOrderReceipt(companyId, activeOrder.id, receiptLines)
      setOrders(getOrders(companyId))
      toast({ title: "✅ Réception enregistrée", description: "Tu peux finaliser plus tard si besoin." })
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message || "Impossible d'enregistrer la réception.", variant: "destructive" })
    }
  }

  const finalizeReceipt = async () => {
    if (!companyId || !activeOrder) return

    // Validation: chaque ligne doit être OK ou Problème (+ note)
    const missingChoice = receiptLines.find((l) => typeof (l as any).receivedOk !== "boolean")
    if (missingChoice) {
      toast({
        title: "Il manque des validations",
        description: "Valide chaque produit (OK ou Problème) avant de finaliser la réception.",
        variant: "destructive",
      })
      return
    }

    const missingNote = receiptLines.find((l) => (l as any).receivedOk === false && !String((l as any).receivedNote || "").trim())
    if (missingNote) {
      toast({
        title: "Note manquante",
        description: "Ajoute une note pour chaque produit marqué en Problème.",
        variant: "destructive",
      })
      return
    }

    const hasProblems = receiptLines.some((l) => (l as any).receivedOk === false)

    try {
      await updateOrder(companyId, activeOrder.id, {
        products: receiptLines,
        status: "delivered",
        deliveredAt: new Date().toISOString(),
      } as any)

      setOrders(getOrders(companyId))
      toast({ title: "✅ Commande réceptionnée", description: "La commande est passée dans l'historique." })
      setOpenOrderDetails(false)

      // Si non-conformité : envoi d'un PDF au fournisseur (lignes en rouge)
      if (hasProblems) {
        try {
          const supplier = suppliers.find((s) => s.id === activeOrder.supplierId)
          const toEmail = String(activeOrder.supplierEmail || supplier?.email || "").trim()
          const toName = String(activeOrder.supplierName || supplier?.name || "Fournisseur")
          if (!toEmail) {
            toast({
              title: "Non-conformité non envoyée",
              description: "Email fournisseur manquant (renseigne-le dans Fournisseurs).",
              variant: "destructive",
            })
            return
          }

          const ccEmails = (activeOrder.ccEmails && activeOrder.ccEmails.length ? activeOrder.ccEmails : (supplier?.ccEmails || []))

          const token = await user?.getIdToken().catch(() => undefined)
          const orderNumber = activeOrder.id.slice(-6).toUpperCase()
          const subject = `Commande non conforme ${orderNumber} — ${companyName || "Entreprise"}`

          const res = await fetch("/api/commandes/send-nonconformity", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              ...(token ? { authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              toEmail,
              toName,
              subject,
              companyName: companyName || "Entreprise",
              ccEmails,
              order: {
                ...activeOrder,
                products: receiptLines,
                supplierName: toName,
                supplierEmail: toEmail,
                orderNumber,
              },
            }),
          })

          const data = await res.json().catch(() => ({}))
          if (!res.ok || !data?.success) throw new Error(data?.error || "Échec envoi non-conformité")

          toast({
            title: "📩 Non-conformité envoyée",
            description: `PDF envoyé à ${toName} (lignes en rouge).`,
          })
        } catch (e: any) {
          console.error(e)
          toast({
            title: "Non-conformité",
            description: e?.message || "Impossible d'envoyer le PDF de non-conformité (la réception reste validée).",
            variant: "destructive",
          })
        }
      }
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message || "Impossible de finaliser la réception.", variant: "destructive" })
    }
  }


  return (
    <PermissionGate page="commandes">
      <div className="min-h-screen bg-background pb-24">
        <Header />

        <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
          {/* Hero */}
          <div className="pulse-card p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Truck className="w-6 h-6 text-primary" />
                  Passer une commande
                </h1>
                <p className="text-sm text-muted-foreground">
                  Sélectionne un fournisseur, ajuste les quantités, puis envoie un bon de commande en PDF par email.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Link href="/fournisseurs" className="hidden sm:inline-flex">
                  <Button variant="outline" className="rounded-xl gap-2">
                    <Settings className="w-4 h-4" />
                    Gérer les fournisseurs
                  </Button>
                </Link>

                <Button onClick={() => setOpenNewOrder(true)} className="rounded-xl gap-2">
                  <Plus className="w-4 h-4" />
                  Nouvelle commande
                </Button>
              </div>
            </div>

            {!loading && suppliers.length === 0 && (
              <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
                <Mail className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Aucun fournisseur configuré</p>
                  <p className="text-sm text-amber-700/90 dark:text-amber-200/80">
                    Ajoute au moins un fournisseur et ses produits dans la page Fournisseurs.
                  </p>
                </div>
              </div>
            )}
          </div>

          
          {/* Commandes */}
          <section className="space-y-6">
            {/* À réceptionner */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Truck className="w-5 h-5 text-primary" />
                  En attente de réception
                </h2>
                <p className="text-sm text-muted-foreground">{pendingReceptionOrders.length}</p>
              </div>

              {loading ? (
                <div className="pulse-card p-6 text-sm text-muted-foreground">Chargement…</div>
              ) : pendingReceptionOrders.length === 0 ? (
                <div className="pulse-card p-8 flex items-start gap-3">
                  <Package className="w-10 h-10 text-muted-foreground mt-1" />
                  <div>
                    <p className="font-semibold">Rien à réceptionner</p>
                    <p className="text-sm text-muted-foreground">Les commandes envoyées apparaîtront ici jusqu’à validation.</p>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3">
                  {pendingReceptionOrders
                    .slice()
                    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
                    .map((o) => {
                      const num = o.id.slice(-6).toUpperCase()
                      return (
                        <div key={o.id} className="pulse-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <button
                            type="button"
                            className="text-left flex-1 min-w-0"
                            onClick={() => openDetails(o, "view")}
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold truncate">{o.supplierName}</span>
                              <span className="text-xs px-2 py-1 rounded-lg bg-muted">#{num}</span>
                              <span className="text-xs px-2 py-1 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-200">
                                Envoyée
                              </span>
                            </div>

                            <div className="mt-1 text-sm text-muted-foreground flex flex-wrap items-center gap-3">
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                Livraison : {o.deliveryDate || "—"}
                              </span>
                              <span>•</span>
                              <span>Total : {formatEuro(o.totalAmount || 0)}</span>
                            </div>
                          </button>

                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-xl gap-2"
                              onClick={() => handleResend(o)}
                              disabled={sendingOrderId === o.id}
                            >
                              {sendingOrderId === o.id ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Envoi…
                                </>
                              ) : (
                                <>
                                  <Mail className="w-4 h-4" />
                                  Renvoyer le bon
                                </>
                              )}
                            </Button>

                            <Button size="sm" className="rounded-xl gap-2" onClick={() => openDetails(o, "receive")}>
                              <Package className="w-4 h-4" />
                              Réceptionner
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>

            {/* Brouillons */}
            {!loading && draftOrders.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    Brouillons
                  </h2>
                  <p className="text-sm text-muted-foreground">{draftOrders.length}</p>
                </div>

                <div className="grid gap-3">
                  {draftOrders
                    .slice()
                    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
                    .map((o) => {
                      const num = o.id.slice(-6).toUpperCase()
                      return (
                        <div key={o.id} className="pulse-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <button type="button" className="text-left flex-1 min-w-0" onClick={() => openDetails(o, "view")}>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold truncate">{o.supplierName}</span>
                              <span className="text-xs px-2 py-1 rounded-lg bg-muted">#{num}</span>
                              <span className="text-xs px-2 py-1 rounded-lg bg-muted/40 text-muted-foreground">
                                Brouillon
                              </span>
                            </div>
                            <div className="mt-1 text-sm text-muted-foreground flex flex-wrap items-center gap-3">
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                Livraison : {o.deliveryDate || "—"}
                              </span>
                              <span>•</span>
                              <span>Total : {formatEuro(o.totalAmount || 0)}</span>
                            </div>
                          </button>

                          <Button
                            size="sm"
                            className="rounded-xl gap-2"
                            onClick={() => handleResend(o)}
                            disabled={sendingOrderId === o.id}
                          >
                            {sendingOrderId === o.id ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Envoi…
                              </>
                            ) : (
                              <>
                                <Send className="w-4 h-4" />
                                Envoyer
                              </>
                            )}
                          </Button>
                        </div>
                      )
                    })}
                </div>
              </div>
            )}

            {/* Historique */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <BadgeCheck className="w-5 h-5 text-primary" />
                  Commandes reçues
                </h2>
                <p className="text-sm text-muted-foreground">{deliveredOrders.length}</p>
              </div>

              {loading ? (
                <div className="pulse-card p-6 text-sm text-muted-foreground">Chargement…</div>
              ) : deliveredOrders.length === 0 ? (
                <div className="pulse-card p-8 text-center">
                  <Package className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">Aucune commande réceptionnée pour le moment.</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {deliveredOrders
                    .slice()
                    .sort((a, b) => (b.deliveredAt || b.createdAt || "").localeCompare(a.deliveredAt || a.createdAt || ""))
                    .map((o) => {
                      const num = o.id.slice(-6).toUpperCase()
                      return (
                        <div key={o.id} className="pulse-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <button type="button" className="text-left flex-1 min-w-0" onClick={() => openDetails(o, "view")}>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold truncate">{o.supplierName}</span>
                              <span className="text-xs px-2 py-1 rounded-lg bg-muted">#{num}</span>
                              <span className="text-xs px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-200">
                                Reçue
                              </span>
                            </div>

                            <div className="mt-1 text-sm text-muted-foreground flex flex-wrap items-center gap-3">
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                Livraison : {o.deliveryDate || "—"}
                              </span>
                              <span>•</span>
                              <span>Total : {formatEuro(o.totalAmount || 0)}</span>
                            </div>
                          </button>

                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-xl gap-2"
                              onClick={() => handleResend(o)}
                              disabled={sendingOrderId === o.id}
                            >
                              {sendingOrderId === o.id ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Envoi…
                                </>
                              ) : (
                                <>
                                  <Mail className="w-4 h-4" />
                                  Renvoyer le bon
                                </>
                              )}
                            </Button>
                            <Button size="sm" className="rounded-xl gap-2" variant="secondary" onClick={() => openDetails(o, "view")}>
                              <FileText className="w-4 h-4" />
                              Voir
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>
          </section>

        </main>

        {/* New order sheet */}
        <Sheet open={openNewOrder} onOpenChange={setOpenNewOrder}>
          <SheetContent side="right" className="w-screen max-w-none h-screen p-0 sm:max-w-none">
  <div className="flex h-full flex-col">
    <div className="border-b border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Send className="w-5 h-5 text-primary shrink-0" />
          <div className="min-w-0">
            <div className="text-lg font-semibold truncate">Envoyer une commande</div>
            <div className="text-xs text-muted-foreground truncate">
              {selectedSupplier ? selectedSupplier.name : "Sélectionne un fournisseur"}
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="text-base font-semibold tabular-nums">{formatEuro(totalAmount)}</div>
        </div>
      </div>
    </div>

    <div className="flex-1 overflow-y-auto p-4 space-y-6">
      <div className="space-y-2">
        <Label>Fournisseur</Label>
        <Select value={supplierId} onValueChange={setSupplierId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Sélectionner un fournisseur" />
          </SelectTrigger>
          <SelectContent>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <Settings className="w-3.5 h-3.5" />
          Les produits / emails se configurent dans{" "}
          <Link href="/fournisseurs" className="underline">
            Fournisseurs
          </Link>
          .
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Date de livraison</Label>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Emails en copie (CC)</Label>
          <Input placeholder="compta@..., achats@..." value={ccText} onChange={(e) => setCcText(e.target.value)} />
          <p className="text-xs text-muted-foreground">Virgule ou point-virgule.</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Notes (optionnel)</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex: Merci de livrer avant 10h…"
          className="min-h-[80px]"
        />
      </div>

      <div className="space-y-2">
        <Label>Produits</Label>

        <Input placeholder="Rechercher un produit…" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />

        {!selectedSupplier ? (
          <div className="p-4 rounded-xl bg-muted text-sm text-muted-foreground">
            Sélectionne un fournisseur pour voir ses produits.
          </div>
        ) : (selectedSupplier.products?.length || 0) === 0 ? (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm">
            Aucun produit configuré pour ce fournisseur. Ajoute des produits dans la page Fournisseurs.
          </div>
        ) : (
          <div className="space-y-2">
            {(() => {
              const groups = new Map<string, typeof filteredLines>()
              for (const line of filteredLines) {
                const cat = (line.category || "Sans catégorie").toString().trim() || "Sans catégorie"
                if (!groups.has(cat)) groups.set(cat, [])
                groups.get(cat)!.push(line)
              }
              return Array.from(groups.entries())
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([cat, items]) => (
                  <div key={cat} className="pulse-card p-0 overflow-hidden">
                    <div className="px-4 py-2 border-b border-border bg-muted/30 flex items-center justify-between">
                      <div className="text-xs font-semibold tracking-wide uppercase">{cat}</div>
                      <div className="text-xs text-muted-foreground">{items.length}</div>
                    </div>

                    <div className="divide-y divide-border">
                      {items.map((p) => {
                        const step = unitStep(p.unit)
                        const packAdd = convertPackToProductUnit(p.packQuantity, p.packUnit, p.unit)
                        const packLabel = (p.packLabel || "").toString().trim()
                        const lineTotal = Number(p.total || 0)
                        return (
                          <div key={p.id} className="p-4 flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="font-medium leading-tight">{p.productName}</div>
                              <div className="mt-1 text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                                <span className="truncate">{p.reference || "—"}</span>
                                <span>•</span>
                                <span>{formatEuro(p.unitPrice)}/{p.unit}</span>
                                {packLabel ? (
                                  <>
                                    <span>•</span>
                                    <span>Colisage: {packLabel}</span>
                                  </>
                                ) : null}
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-2 shrink-0">
                              <div className="flex items-center gap-2">
                                {packAdd !== undefined && packAdd > 0 && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="rounded-xl"
                                    onClick={() => updateQty(p.id, String(Number(p.quantity || 0) + packAdd))}
                                  >
                                    + colis
                                  </Button>
                                )}

                                <Input
                                  type="number"
                                  min={0}
                                  step={step}
                                  value={p.quantity}
                                  onChange={(e) => updateQty(p.id, e.target.value)}
                                  className="w-24"
                                />
                              </div>

                              <div className="text-sm w-24 text-right tabular-nums">{formatEuro(lineTotal)}</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))
            })()}
          </div>
        )}
      </div>
    </div>

    <div className="border-t border-border bg-card p-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex items-center justify-between sm:block">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="text-xl font-semibold tabular-nums">{formatEuro(totalAmount)}</div>
        </div>

        <Button
          onClick={handleSend}
          className="rounded-xl gap-2 sm:min-w-[320px] justify-center"
          disabled={!companyId || !selectedSupplier}
        >
          <Send className="w-4 h-4" />
          Valider et envoyer le bon de commande (PDF)
        </Button>
      </div>
    </div>
  </div>
</SheetContent>
        </Sheet>

        {/* Order details / réception */}
        <Sheet open={openOrderDetails} onOpenChange={setOpenOrderDetails}>
          <SheetContent side="bottom" className="w-screen max-w-none h-screen p-0 sm:max-w-none">
            <div className="flex h-full flex-col">
              <div className="border-b border-border bg-card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary" />
                      <div className="text-lg font-semibold truncate">
                        {activeOrder ? `${activeOrder.supplierName}` : "Commande"}
                      </div>
                      {activeOrder && (
                        <span className="text-xs px-2 py-1 rounded-lg bg-muted">
                          #{activeOrder.id.slice(-6).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Livraison : {activeOrder?.deliveryDate || "—"}
                      </span>
                      <span>•</span>
                      <span>Total : {formatEuro(activeOrder?.totalAmount || 0)}</span>
                      {activeOrder?.status === "delivered" && (
                        <>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-300">
                            <BadgeCheck className="w-4 h-4" />
                            Reçue
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {detailsMode === "receive" && (
                      <Button variant="outline" className="rounded-xl gap-2" onClick={markAllOk}>
                        <CheckCircle2 className="w-4 h-4" />
                        Tout OK
                      </Button>
                    )}
                    <Button variant="outline" className="rounded-xl" onClick={() => setOpenOrderDetails(false)}>
                      Fermer
                    </Button>
                  </div>
                </div>

                {detailsMode === "receive" && (
                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      Validation : <span className="font-semibold text-foreground">{receiptProgress.done}</span> /{" "}
                      <span className="font-semibold text-foreground">{receiptProgress.total}</span>
                    </div>
                    <div className="w-40">
                      <Progress value={receiptProgress.total ? (receiptProgress.done / receiptProgress.total) * 100 : 0} className="h-2" />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {activeOrder && activeOrder.notes && (
                  <div className="pulse-card p-4 border border-border/50">
                    <div className="text-xs font-semibold text-muted-foreground mb-1">Notes</div>
                    <div className="text-sm whitespace-pre-wrap">{activeOrder.notes}</div>
                  </div>
                )}

                {activeOrder ? (
                  <div className="space-y-3">
                    {(() => {
                      const groups = new Map<string, OrderProduct[]>()
                      for (const l of receiptLines) {
                        const cat = (l.category || "Sans catégorie").toString().trim() || "Sans catégorie"
                        if (!groups.has(cat)) groups.set(cat, [])
                        groups.get(cat)!.push(l)
                      }
                      const sorted = Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]))
                      return sorted.map(([cat, items]) => (
                        <div key={cat} className="pulse-card p-0 overflow-hidden">
                          <div className="px-4 py-2 border-b border-border bg-muted/30 flex items-center justify-between">
                            <div className="text-xs font-semibold tracking-wide uppercase">{cat}</div>
                            <div className="text-xs text-muted-foreground">{items.length}</div>
                          </div>

                          <div className="divide-y divide-border">
                            {items.map((p) => {
                              const orderedQty = Number(p.quantity || 0)
                              const receivedQty = typeof (p as any).receivedQuantity === "number" ? (p as any).receivedQuantity : orderedQty
                              const receivedOk = (p as any).receivedOk as boolean | undefined
                              const isProblem = receivedOk === false
                              const isOk = receivedOk === true

                              return (
                                <div key={p.id} className="p-4 flex flex-col gap-3">
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0">
                                      <div className="font-semibold leading-tight break-words">{p.productName}</div>
                                      <div className="mt-1 text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                                        <span className="truncate">{p.reference || "—"}</span>
                                        <span>•</span>
                                        <span>{formatEuro(p.unitPrice)}/{p.unit}</span>
                                        {p.packLabel ? (
                                          <>
                                            <span>•</span>
                                            <span>Colisage : {p.packLabel}</span>
                                          </>
                                        ) : null}
                                      </div>
                                    </div>

                                    <div className="text-right shrink-0">
                                      <div className="text-xs text-muted-foreground">Total</div>
                                      <div className="text-sm font-semibold tabular-nums">{formatEuro(Number(p.total || 0))}</div>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="pulse-card p-3 bg-muted/20 border border-border/50">
                                      <div className="text-[11px] text-muted-foreground">Commandé</div>
                                      <div className="text-sm font-bold tabular-nums">
                                        {orderedQty.toLocaleString("fr-FR")} {p.unit}
                                      </div>
                                    </div>

                                    <div className="pulse-card p-3 bg-muted/20 border border-border/50">
                                      <div className="text-[11px] text-muted-foreground">Reçu</div>
                                      {detailsMode === "receive" ? (
                                        <Input
                                          type="number"
                                          min={0}
                                          step={unitStep(p.unit)}
                                          value={receivedQty}
                                          onChange={(e) => setLineReceipt(p.id, { receivedQuantity: Number(e.target.value) })}
                                          className="mt-1"
                                        />
                                      ) : (
                                        <div className="text-sm font-bold tabular-nums mt-1">
                                          {(typeof (p as any).receivedQuantity === "number"
                                            ? (p as any).receivedQuantity
                                            : orderedQty
                                          ).toLocaleString("fr-FR")}{" "}
                                          {p.unit}
                                        </div>
                                      )}
                                    </div>

                                    <div className="pulse-card p-3 bg-muted/20 border border-border/50">
                                      <div className="text-[11px] text-muted-foreground">Statut</div>

                                      {detailsMode === "receive" ? (
                                        <div className="mt-1 flex gap-2">
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant={isOk ? "default" : "outline"}
                                            className="rounded-xl flex-1"
                                            onClick={() => setLineReceipt(p.id, { receivedOk: true, receivedNote: "" })}
                                          >
                                            OK
                                          </Button>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant={isProblem ? "destructive" : "outline"}
                                            className="rounded-xl flex-1"
                                            onClick={() => setLineReceipt(p.id, { receivedOk: false })}
                                          >
                                            Problème
                                          </Button>
                                        </div>
                                      ) : (
                                        <div className="mt-1">
                                          {receivedOk === true ? (
                                            <span className="text-xs font-bold px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-200">
                                              OK
                                            </span>
                                          ) : receivedOk === false ? (
                                            <span className="text-xs font-bold px-2 py-1 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-200">
                                              Problème
                                            </span>
                                          ) : (
                                            <span className="text-xs font-bold px-2 py-1 rounded-full bg-muted/40 text-muted-foreground">
                                              —
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {detailsMode === "receive" && isProblem && (
                                    <div className="space-y-2">
                                      <Label>Note (obligatoire si problème)</Label>
                                      <Textarea
                                        value={String((p as any).receivedNote || "")}
                                        onChange={(e) => setLineReceipt(p.id, { receivedNote: e.target.value })}
                                        placeholder="Ex: Manque 2kg, carton abîmé, produit non conforme…"
                                        className="min-h-[70px]"
                                      />
                                    </div>
                                  )}

                                  {detailsMode !== "receive" && receivedOk === false && String((p as any).receivedNote || "").trim() && (
                                    <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                                      <div className="text-xs font-bold text-rose-700 dark:text-rose-200 mb-1">Note</div>
                                      <div className="text-sm text-rose-900 dark:text-rose-50 whitespace-pre-wrap">
                                        {String((p as any).receivedNote || "")}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))
                    })()}
                  </div>
                ) : (
                  <div className="pulse-card p-6 text-sm text-muted-foreground">Aucune commande sélectionnée.</div>
                )}
              </div>

              {detailsMode === "receive" && (
                <div className="border-t border-border bg-card p-4">
                  <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                    <Button variant="outline" className="rounded-xl gap-2" onClick={saveReceipt}>
                      <Save className="w-4 h-4" />
                      Enregistrer (sans finaliser)
                    </Button>
                    <Button className="rounded-xl gap-2 sm:min-w-[320px] justify-center" onClick={finalizeReceipt}>
                      <BadgeCheck className="w-4 h-4" />
                      Valider la réception
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>


        <BottomNav />
      </div>
    </PermissionGate>
  )
}
