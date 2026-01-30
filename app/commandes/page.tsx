"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/pulse/header"
import { BottomNav } from "@/components/pulse/bottom-nav"
import { PermissionGate } from "@/components/auth/permission-gate"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/components/auth/auth-provider"
import { cn } from "@/lib/utils"
import { 
  Package, 
  Plus, 
  Send, 
  Truck, 
  Calendar,
  Building2,
  Mail,
  Phone,
  Trash2,
  Pencil,
  ShoppingCart,
  ChevronRight,
  ChevronDown,
  Euro,
  Check,
  X,
  FileText,
  Clock
} from "lucide-react"
import {
  getSuppliers,
  hydrateOrdersStore,
  addSupplier,
  updateSupplier,
  deleteSupplier,
  addProduct,
  updateProduct,
  deleteProduct,
  getOrders,
  addOrder,
  updateOrder,
  deleteOrder,
  markOrderAsSent,
  getOrdersStoreEventName,
  OrderSupplier,
  SupplierProduct,
  Order,
  OrderProduct
} from "@/lib/demo/orders-store"

type TabType = "commandes" | "fournisseurs"
const daysOfWeek = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]

export default function CommandesPage() {
  const { profile, isDemo } = useAuth()
  const { toast } = useToast()
  const companyId: string | undefined = isDemo ? "demo-company" : ((profile as any)?.companyId as string | undefined)
  const companyReady = Boolean(companyId)

  const [activeTab, setActiveTab] = useState<TabType>("commandes")
  const [suppliers, setSuppliers] = useState<OrderSupplier[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  // Modals
  const [showNewSupplier, setShowNewSupplier] = useState(false)
  const [showNewProduct, setShowNewProduct] = useState(false)
  const [showNewOrder, setShowNewOrder] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<OrderSupplier | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [expandedSuppliers, setExpandedSuppliers] = useState<string[]>([])

  // Forms
  // ✅ Formulaire enrichi pour inclure la logistique (Franco, Délais...)
  const [supplierForm, setSupplierForm] = useState<Partial<OrderSupplier>>({ 
    name: "", email: "", phone: "", address: "", contactName: "",
    deliveryDays: [], delaiCommande: "1 j", franco: "", minOrder: "", orderBefore: ""
  })
  
  const [productForm, setProductForm] = useState({ name: "", reference: "", imageUrl: "", unitPrice: 0, unit: "kg", category: "" })
  const [orderProducts, setOrderProducts] = useState<OrderProduct[]>([])
  const [orderDeliveryDate, setOrderDeliveryDate] = useState("")
  const [productSearch, setProductSearch] = useState("")
  const [showImportProducts, setShowImportProducts] = useState(false)
  const [importText, setImportText] = useState("")
  const [importUnit, setImportUnit] = useState("kg")
  const [orderNotes, setOrderNotes] = useState("")
  const [orderSupplierId, setOrderSupplierId] = useState("")

  // Load data
  useEffect(() => {
    if (!companyId) return
    let cancelled = false
    const cid = companyId
    setLoading(true)
    hydrateOrdersStore(cid).then(() => {
      if (cancelled) return
      setSuppliers(getSuppliers(cid))
      setOrders(getOrders(cid))
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [companyId])

  // Synchronisation immédiate (même onglet) + multi-onglets
  useEffect(() => {
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


  // === SUPPLIERS ===
  const toggleDay = (day: string) => {
    const currentDays = supplierForm.deliveryDays || []
    if (currentDays.includes(day)) {
      setSupplierForm({ ...supplierForm, deliveryDays: currentDays.filter(d => d !== day) })
    } else {
      setSupplierForm({ ...supplierForm, deliveryDays: [...currentDays, day] })
    }
  }

  const handleAddSupplier = async () => {
    if (!companyId) return
    if (!supplierForm.name) {
      toast({ title: "Erreur", description: "Le nom du fournisseur est requis", variant: "destructive" })
      return
    }
    // ✅ Ajout avec les nouveaux champs
    const newSupplier = await addSupplier(companyId, supplierForm)
    setSuppliers([...suppliers, newSupplier])
    
    // Reset form complet
    setSupplierForm({ 
        name: "", email: "", phone: "", address: "", contactName: "",
        deliveryDays: [], delaiCommande: "1 j", franco: "", minOrder: "", orderBefore: ""
    })
    setShowNewSupplier(false)
    toast({ title: "✅ Fournisseur ajouté" })
  }

  const handleDeleteSupplier = async (id: string) => {
    if (!companyId) return
    if (!confirm("Supprimer ce fournisseur et toutes ses commandes ?")) return
    await deleteSupplier(companyId, id)
    setSuppliers(suppliers.filter(s => s.id !== id))
    setOrders(orders.filter(o => o.supplierId !== id))
    toast({ title: "Fournisseur supprimé" })
  }

  // === PRODUCTS ===
  const handleAddProduct = async () => {
    if (!companyId) return
    if (!selectedSupplier || !productForm.name || productForm.unitPrice <= 0) {
      toast({ title: "Erreur", description: "Nom et prix requis", variant: "destructive" })
      return
    }
    const newProduct = await addProduct(companyId, selectedSupplier.id, productForm)
    const updatedSuppliers = suppliers.map(s => 
      s.id === selectedSupplier.id 
        ? { ...s, products: [...s.products, newProduct] }
        : s
    )
    setSuppliers(updatedSuppliers)
    setSelectedSupplier(updatedSuppliers.find(s => s.id === selectedSupplier.id) || null)
    setProductForm({ name: "", reference: "", unitPrice: 0, unit: "kg", category: "" })
    setShowNewProduct(false)
    toast({ title: "✅ Produit ajouté" })
  }

  const handleDeleteProduct = async (supplierId: string, productId: string) => {
    if (!companyId) return
    await deleteProduct(companyId, supplierId, productId)
    const updatedSuppliers = suppliers.map(s => 
      s.id === supplierId 
        ? { ...s, products: s.products.filter(p => p.id !== productId) }
        : s
    )
    setSuppliers(updatedSuppliers)
    setSelectedSupplier(updatedSuppliers.find(s => s.id === supplierId) || null)
    toast({ title: "Produit supprimé" })
  }

  // === ORDERS ===
  const toggleSupplierExpand = (id: string) => {
    setExpandedSuppliers(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  const addProductToOrder = (product: SupplierProduct, quantity: number) => {
    if (quantity < 0) return
    
    // Si quantité 0 ou vide, on retire
    if (!quantity) {
        removeProductFromOrder(product.id)
        return
    }

    const existing = orderProducts.find(p => p.productId === product.id)
    if (existing) {
      setOrderProducts(orderProducts.map(p => 
        p.productId === product.id 
          ? { ...p, quantity, total: quantity * product.unitPrice }
          : p
      ))
    } else {
      setOrderProducts([...orderProducts, {
        id: `op_${Date.now()}`,
        productId: product.id,
        productName: product.name,
        quantity,
        reference: (product as any).reference,
        unitPrice: product.unitPrice,
        unit: product.unit,
        total: quantity * product.unitPrice
      }])
    }
  }

  const removeProductFromOrder = (productId: string) => {
    setOrderProducts(orderProducts.filter(p => p.productId !== productId))
  }

  
  const handleImportProducts = async (supplierId: string) => {
    const cid = companyId
    const raw = importText || ""
    if (!raw.trim()) {
      toast({ title: "Erreur", description: "Collez du texte ou chargez un fichier.", variant: "destructive" })
      return
    }
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    let created = 0
    let updated = 0

    for (const line of lines) {
      const parts = line.split(/[;\t,]/).map(p => p.trim())
      const [reference, name, price] = parts
      if (!name) continue
      const unitPrice = Number(String(price || "0").replace(",", ".")) || 0

      // Recherche par référence (si fournie), sinon par nom
      const supplier = getSuppliers(cid).find(s => s.id === supplierId)
      const existing = supplier?.products.find(p => (reference && (p.reference || "") === reference) || p.name.toLowerCase() === name.toLowerCase())

      if (existing) {
        await updateProduct(cid, supplierId, existing.id, { name, reference: reference || existing.reference, unitPrice, unit: existing.unit || importUnit })
        updated++
      } else {
        await addProduct(cid, supplierId, { name, reference: reference || "", unitPrice, unit: importUnit })
        created++
      }
    }

    // refresh
    setSuppliers(getSuppliers(cid))
    toast({ title: "Import terminé", description: `${created} créés • ${updated} mis à jour` })
    setShowImportProducts(false)
    setImportText("")
  }
const handleCreateOrder = async () => {
    if (!companyId) return
    if (!orderSupplierId || orderProducts.length === 0 || !orderDeliveryDate) {
      toast({ title: "Erreur", description: "Sélectionnez un fournisseur, des produits et une date", variant: "destructive" })
      return
    }
    const supplier = suppliers.find(s => s.id === orderSupplierId)
    if (!supplier) return

    const totalAmount = orderProducts.reduce((sum, p) => sum + p.total, 0)
    const newOrder = await addOrder(companyId, {
      supplierId: orderSupplierId,
      supplierName: supplier.name,
      supplierEmail: supplier.email,
      products: orderProducts,
      totalAmount,
      deliveryDate: orderDeliveryDate,
      notes: orderNotes
    })
    setOrders([...orders, newOrder])
    setOrderProducts([])
    setOrderDeliveryDate("")
    setOrderNotes("")
    setOrderSupplierId("")
    setShowNewOrder(false)
    toast({ title: "✅ Commande créée" })
  }

  const handleDeleteOrder = async (id: string) => {
    if (!companyId) return
    if (!confirm("Supprimer cette commande ?")) return
    await deleteOrder(companyId, id)
    setOrders(orders.filter(o => o.id !== id))
    toast({ title: "Commande supprimée" })
  }

  const handleSendOrder = async (order: Order) => {
    if (!companyId) return
    try {
      const htmlContent = generateOrderEmailHTML(order)
      
      const response = await fetch("/api/commandes/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toEmail: order.supplierEmail,
          toName: order.supplierName,
          subject: `Commande #${order.id.slice(-6).toUpperCase()} - Livraison le ${new Date(order.deliveryDate).toLocaleDateString("fr-FR")}`,
          htmlContent,
          orderId: order.id,
          supplierId: order.supplierId
        })
      })

      const data = await response.json()
      
      if (data.success) {
        await markOrderAsSent(companyId, order.id)
        setOrders(orders.map(o => 
          o.id === order.id ? { ...o, status: "sent", sentAt: new Date().toISOString() } : o
        ))
        toast({ title: "✅ Commande envoyée par email !" })
      } else {
        throw new Error(data.error || "Erreur d'envoi")
      }
    } catch (error: any) {
      console.error("Erreur envoi:", error)
      toast({ 
        title: "Erreur d'envoi", 
        description: error.message || "Impossible d'envoyer l'email",
        variant: "destructive" 
      })
    }
  }

  const generateOrderEmailHTML = (order: Order) => {
    const companyName = (profile as any)?.companyName || "Pulse App"
    const productsRows = order.products.map(p => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${p.productName}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${(p as any).reference || ""}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${p.quantity} ${p.unit}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${p.unitPrice.toFixed(2)} €</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold;">${p.total.toFixed(2)} €</td>
      </tr>
    `).join("")

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="font-family: sans-serif; background-color: #f3f4f6; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden;">
    <div style="background: #6366f1; color: white; padding: 32px; text-align: center;">
      <h1 style="margin:0;">📦 Nouvelle Commande</h1>
      <p style="margin:5px 0 0; opacity:0.9;">De ${companyName}</p>
    </div>
    <div style="padding: 32px;">
      <p><strong>N° Commande:</strong> #${order.id.slice(-6).toUpperCase()}</p>
      <p><strong>Livraison le :</strong> ${new Date(order.deliveryDate).toLocaleDateString("fr-FR")}</p>
      ${order.notes ? `<div style="background:#fef3c7; border-left:4px solid #f59e0b; padding:10px; margin-bottom:20px;"><strong>Note:</strong> ${order.notes}</div>` : ""}
      
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        <thead>
          <tr style="background: #f1f5f9;">
            <th style="padding: 12px; text-align: left;">Produit</th>
            <th style="padding: 12px; text-align: left;">Référence</th>
            <th style="padding: 12px; text-align: center;">Qté</th>
            <th style="padding: 12px; text-align: right;">Prix</th>
            <th style="padding: 12px; text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>${productsRows}</tbody>
        <tfoot>
          <tr style="background: #6366f1; color: white;">
            <td colspan="4" style="text-align: right; padding: 12px;">TOTAL</td>
            <td style="text-align: right; padding: 12px; font-weight: bold;">${order.totalAmount.toFixed(2)} €</td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
</body>
</html>`
  }

  const orderTotal = orderProducts.reduce((sum, p) => sum + p.total, 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <PermissionGate moduleId="gestion">
      <div className="min-h-screen bg-background pb-32">
        <Header />
        
        <main className="px-4 py-6 max-w-lg mx-auto space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <ShoppingCart className="w-6 h-6 text-primary" />
              Gestion des Commandes
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Créez et envoyez vos commandes aux fournisseurs
            </p>
          </div>

          {/* Tabs */}
          <div className="bg-muted/50 p-1 rounded-2xl flex">
            <button 
              onClick={() => setActiveTab("commandes")} 
              className={cn(
                "flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2",
                activeTab === "commandes" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              )}
            >
              <FileText className="w-4 h-4" /> Commandes
            </button>
            <button 
              onClick={() => setActiveTab("fournisseurs")} 
              className={cn(
                "flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2",
                activeTab === "fournisseurs" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              )}
            >
              <Building2 className="w-4 h-4" /> Fournisseurs
            </button>
          </div>

          {/* === TAB: COMMANDES === */}
          {activeTab === "commandes" && (
            <div className="space-y-4">
              <Button 
                onClick={() => setShowNewOrder(true)} 
                className="w-full rounded-xl gap-2"
                disabled={suppliers.length === 0}
              >
                <Plus className="w-4 h-4" /> Nouvelle Commande
              </Button>

              {suppliers.length === 0 && (
                <div className="pulse-card p-6 text-center">
                  <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Ajoutez d'abord un fournisseur dans l'onglet "Fournisseurs"
                  </p>
                </div>
              )}

              {orders.map(order => (
                <div key={order.id} className="pulse-card p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">#{order.id.slice(-6).toUpperCase()}</span>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                          order.status === "sent" ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-600"
                        )}>
                          {order.status === "sent" ? "Envoyée" : "Brouillon"}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{order.supplierName}</p>
                    </div>
                    <p className="text-lg font-bold text-primary">{order.totalAmount.toFixed(2)} €</p>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(order.deliveryDate).toLocaleDateString("fr-FR")}
                    </span>
                    <span className="flex items-center gap-1">
                      <Package className="w-3.5 h-3.5" />
                      {order.products.length} produit(s)
                    </span>
                  </div>

                  <div className="flex gap-2">
                    {order.status === "draft" && (
                      <Button 
                        size="sm" 
                        className="flex-1 rounded-xl gap-1"
                        onClick={() => handleSendOrder(order)}
                      >
                        <Send className="w-3.5 h-3.5" /> Envoyer
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => handleDeleteOrder(order.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* === TAB: FOURNISSEURS === */}
          {activeTab === "fournisseurs" && (
            <div className="space-y-4">
              <Button onClick={() => setShowNewSupplier(true)} className="w-full rounded-xl gap-2">
                <Plus className="w-4 h-4" /> Nouveau Fournisseur
              </Button>

              {suppliers.map(supplier => (
                <div key={supplier.id} className="pulse-card overflow-hidden">
                  <div 
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => toggleSupplierExpand(supplier.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{supplier.name}</p>
                        <p className="text-xs text-muted-foreground">{supplier.email || "Pas d'email"}</p>
                      </div>
                    </div>
                    {expandedSuppliers.includes(supplier.id) 
                      ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      : <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    }
                  </div>

                  {expandedSuppliers.includes(supplier.id) && (
                    <div className="border-t bg-muted/20 p-4 space-y-4">
                      {/* Détails logistiques affichés */}
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground bg-background/50 p-3 rounded-lg">
                         <div><span className="font-semibold">Délai:</span> {supplier.delaiCommande || "Standard"}</div>
                         <div><span className="font-semibold">Franco:</span> {supplier.franco || "-"}</div>
                         <div className="col-span-2">
                            <span className="font-semibold">Livraison:</span> {supplier.deliveryDays?.join(", ") || "Tous les jours"}
                         </div>
                      </div>

                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="rounded-xl gap-1 flex-1"
                          onClick={(e) => { e.stopPropagation(); setSelectedSupplier(supplier); setShowNewProduct(true); }}
                        >
                          <Plus className="w-3.5 h-3.5" /> Ajouter Produit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl gap-1"
                          onClick={(e) => { e.stopPropagation(); setSelectedSupplier(supplier); setOrderSupplierId(supplier.id); setShowImportProducts(true); }}
                        >
                          <FileText className="w-3.5 h-3.5" /> Importer
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="rounded-xl text-red-500"
                          onClick={(e) => { e.stopPropagation(); handleDeleteSupplier(supplier.id); }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>

                      {supplier.products.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-2">Aucun produit</p>
                      ) : (
                        <div className="space-y-2">
                          {supplier.products.map(product => (
                            <div key={product.id} className="flex items-center justify-between bg-background rounded-lg p-3">
                              <div>
                                <p className="font-medium text-sm">{product.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {product.unitPrice.toFixed(2)} € / {product.unit}
                                </p>
                              </div>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-8 w-8 p-0 text-red-500"
                                onClick={() => handleDeleteProduct(supplier.id, product.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>

        
      <Sheet open={showImportProducts} onOpenChange={setShowImportProducts}>
        <SheetContent side="right" className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Importer Produits
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="text-sm text-muted-foreground">
              Format attendu : <span className="font-mono">Référence;Nom;Prix</span> (séparateurs ; , ou tab). Une ligne = un produit.
            </div>
            <div>
              <Label>Unité par défaut</Label>
              <Input value={importUnit} onChange={e => setImportUnit(e.target.value)} placeholder="kg" />
            </div>
            <div>
              <Label>Coller le texte</Label>
              <textarea
                className="w-full min-h-[220px] rounded-md border bg-background p-3 text-sm"
                value={importText}
                onChange={e => setImportText(e.target.value)}
                placeholder={"REF-001;Tomates cerises;3.50\nREF-002;Poulet;9.90"}
              />
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => {
                  if (!orderSupplierId) {
                    toast({ title: "Erreur", description: "Sélectionnez un fournisseur dans l'onglet Commandes.", variant: "destructive" })
                    return
                  }
                  handleImportProducts(orderSupplierId)
                }}
              >
                Importer
              </Button>
              <Button variant="outline" onClick={() => setShowImportProducts(false)}>
                Annuler
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

<BottomNav />

        {/* === SHEET: Nouveau Fournisseur (Enrichi) === */}
        <Sheet open={showNewSupplier} onOpenChange={setShowNewSupplier}>
          <SheetContent side="bottom" className="h-[90vh] rounded-t-3xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                Nouveau Fournisseur
              </SheetTitle>
            </SheetHeader>
            <div className="space-y-6 mt-6 pb-12">
              <div className="space-y-4">
                 <h3 className="text-sm font-semibold text-primary flex items-center gap-2">Infos Générales</h3>
                 <div className="space-y-3">
                    <div>
                        <Label>Nom *</Label>
                        <Input placeholder="Ex: Metro" value={supplierForm.name} onChange={e => setSupplierForm({...supplierForm, name: e.target.value})} />
                    </div>
                    <div>
                        <Label>Email</Label>
                        <Input placeholder="commande@fournisseur.fr" value={supplierForm.email} onChange={e => setSupplierForm({...supplierForm, email: e.target.value})} />
                    </div>
                    <div>
                        <Label>Téléphone</Label>
                        <Input placeholder="01 23..." value={supplierForm.phone} onChange={e => setSupplierForm({...supplierForm, phone: e.target.value})} />
                    </div>
                 </div>
              </div>

              <div className="space-y-4">
                 <h3 className="text-sm font-semibold text-primary flex items-center gap-2"><Truck className="w-4 h-4"/> Logistique</h3>
                 <div>
                    <Label className="mb-2 block">Jours de livraison</Label>
                    <div className="flex flex-wrap gap-2">
                      {daysOfWeek.map(day => (
                        <button 
                          key={day} 
                          onClick={() => toggleDay(day)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                            (supplierForm.deliveryDays || []).includes(day) 
                              ? "bg-primary text-primary-foreground border-primary" 
                              : "bg-background text-muted-foreground border-input"
                          )}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-3">
                    <div>
                        <Label>Délai commande</Label>
                        <Input placeholder="Ex: 1 j" value={supplierForm.delaiCommande} onChange={e => setSupplierForm({...supplierForm, delaiCommande: e.target.value})} />
                    </div>
                    <div>
                        <Label>Franco</Label>
                        <Input placeholder="Ex: 200€" value={supplierForm.franco} onChange={e => setSupplierForm({...supplierForm, franco: e.target.value})} />
                    </div>
                 </div>
              </div>

              <Button onClick={handleAddSupplier} className="w-full rounded-xl py-6">
                Ajouter le fournisseur
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        {/* === SHEET: Nouveau Produit === */}
        <Sheet open={showNewProduct} onOpenChange={setShowNewProduct}>
          <SheetContent side="bottom" className="h-[70vh] rounded-t-3xl">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                Nouveau Produit
              </SheetTitle>
            </SheetHeader>
            <div className="space-y-4 mt-6">
              <div>
                <Label>Nom du produit *</Label>
                <Input 
                  placeholder="Ex: Tomates cerises..." 
                  value={productForm.name}
                  onChange={e => setProductForm({...productForm, name: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <Label>Référence fournisseur</Label>
                  <Input 
                    placeholder="Ex: REF-123"
                    value={(productForm as any).reference || ""}
                    onChange={e => setProductForm({...(productForm as any), reference: e.target.value})}
                  />
                </div>
                <div>
                  <Label>URL d'image (optionnel)</Label>
                  <Input 
                    placeholder="https://..."
                    value={(productForm as any).imageUrl || ""}
                    onChange={e => setProductForm({...(productForm as any), imageUrl: e.target.value})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Prix unitaire *</Label>
                  <Input 
                    type="number"
                    step="0.01"
                    placeholder="0.00" 
                    value={productForm.unitPrice || ""}
                    onChange={e => setProductForm({...productForm, unitPrice: parseFloat(e.target.value) || 0})}
                  />
                </div>
                <div>
                  <Label>Unité</Label>
                  <select 
                    className="w-full h-10 rounded-md border bg-background px-3"
                    value={productForm.unit}
                    onChange={e => setProductForm({...productForm, unit: e.target.value})}
                  >
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="L">L</option>
                    <option value="pièce">pièce</option>
                    <option value="carton">carton</option>
                    <option value="lot">lot</option>
                  </select>
                </div>
              </div>
              <Button onClick={handleAddProduct} className="w-full rounded-xl">
                Ajouter le produit
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        {/* === SHEET: Nouvelle Commande === */}
        <Sheet open={showNewOrder} onOpenChange={setShowNewOrder}>
          <SheetContent side="bottom" className="h-[90vh] rounded-t-3xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-primary" />
                Nouvelle Commande
              </SheetTitle>
            </SheetHeader>
            <div className="space-y-4 mt-6 pb-8">
              {/* Sélection fournisseur */}
              <div>
                <Label>Fournisseur *</Label>
                <select 
                  className="w-full h-10 rounded-md border bg-background px-3"
                  value={orderSupplierId}
                  onChange={e => { setOrderSupplierId(e.target.value); setOrderProducts([]); }}
                >
                  <option value="">Sélectionner...</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Info livraison contextuelle */}
              {orderSupplierId && (
                 <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg flex gap-3">
                    {(() => {
                        const s = suppliers.find(su => su.id === orderSupplierId);
                        return s ? (
                            <>
                                <span>🚚 {s.deliveryDays?.join(", ") || "Standard"}</span>
                                <span>💰 Franco: {s.franco || "N/A"}</span>
                            </>
                        ) : null;
                    })()}
                 </div>
              )}

              {/* Date de livraison */}
              <div>
                <Label>Date de livraison souhaitée *</Label>
                <Input 
                  type="date"
                  value={orderDeliveryDate}
                  onChange={e => setOrderDeliveryDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>

              {/* Produits du fournisseur */}
              {orderSupplierId && (
                <div>
                  <Label className="mb-2 block">Produits disponibles</Label>
                  <div className="mb-2">
                    <Input placeholder="Rechercher (nom ou référence)..." value={productSearch} onChange={e => setProductSearch(e.target.value)} />
                  </div>
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {suppliers.find(s => s.id === orderSupplierId)?.products
                      .filter(product => {
                        const q = productSearch.trim().toLowerCase()
                        if (!q) return true
                        return product.name.toLowerCase().includes(q) || ((product.reference || "").toLowerCase().includes(q))
                      })
                      .map(product => {
                      const inOrder = orderProducts.find(p => p.productId === product.id)
                      return (
                        <div key={product.id} className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              {(product as any).imageUrl ? (
                                <img src={(product as any).imageUrl} alt={product.name} className="w-9 h-9 rounded-md object-cover border" />
                              ) : null}
                              <div>
                                <p className="font-medium text-sm">{product.name}</p>
                                {(product as any).reference ? (
                                  <p className="text-[11px] text-muted-foreground">Ref: {(product as any).reference}</p>
                                ) : null}
                                <p className="text-xs text-muted-foreground">{product.unitPrice.toFixed(2)} € / {product.unit}</p>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={!!inOrder}
                              onCheckedChange={(checked) => {
                                if (checked) addProductToOrder(product, inOrder?.quantity || 1)
                                else removeProductFromOrder(product.id)
                              }}
                            />
                            {inOrder && (
                            <Input 
                              type="number"
                              className="w-20 h-8 text-center"
                              placeholder="Qté"
                              min="0"
                              step="0.5"
                              value={inOrder?.quantity || ""}
                              onChange={e => addProductToOrder(product, parseFloat(e.target.value) || 0)}
                            />
                            )}
                            {inOrder && (
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-8 w-8 p-0"
                                onClick={() => removeProductFromOrder(product.id)}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    {suppliers.find(s => s.id === orderSupplierId)?.products.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        Aucun produit. Ajoutez-en dans l'onglet Fournisseurs.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Récapitulatif */}
              {orderProducts.length > 0 && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                  <div className="border-t border-primary/20 pt-2 flex justify-between">
                    <span className="font-bold">Total Estimé</span>
                    <span className="font-bold text-primary text-lg">{orderTotal.toFixed(2)} €</span>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <Label>Notes (optionnel)</Label>
                <Input 
                  placeholder="Instructions particulières..."
                  value={orderNotes}
                  onChange={e => setOrderNotes(e.target.value)}
                />
              </div>

              <Button 
                onClick={handleCreateOrder} 
                className="w-full rounded-xl py-6 text-md font-semibold"
                disabled={!orderSupplierId || orderProducts.length === 0 || !orderDeliveryDate}
              >
                Créer la commande
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </PermissionGate>
  )
}
