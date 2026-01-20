"use client"



import { useState } from "react"

import { Header } from "@/components/pulse/header"

import { BottomNav } from "@/components/pulse/bottom-nav"

import { 

  Users, Target, Clock, Plus, Search, ChevronRight, 

  TrendingUp, Wallet, ArrowLeft, MoreHorizontal, History 

} from "lucide-react"

import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"

import { Input } from "@/components/ui/input"

import { Progress } from "@/components/ui/progress"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerFooter, DrawerClose } from "@/components/ui/drawer"



// --- TYPES & DONNÉES SIMULÉES (Pour l'UI) ---



type Collaborator = {

  id: string

  name: string

  role: string

  hoursContract: number

  progress: number

  potentialBonus: number

  avatar: string

  initials: string

  color: string

}



type Objective = {

  id: string

  title: string

  description: string

  current: number

  target: number

  unit: string

  type: "principal" | "secondaire"

  history: { date: string; value: number; change: number }[]

  paliers: { level: number; reward: number; reached: boolean }[]

}



const INITIAL_TEAM: Collaborator[] = [

  { id: "1", name: "Marie Dupont", role: "Manager", hoursContract: 35, progress: 75, potentialBonus: 825, avatar: "", initials: "MD", color: "bg-purple-500" },

  { id: "2", name: "Jean Martin", role: "Commercial", hoursContract: 35, progress: 50, potentialBonus: 825, avatar: "", initials: "JM", color: "bg-indigo-500" },

  { id: "3", name: "Sophie Bernard", role: "Commercial", hoursContract: 28, progress: 100, potentialBonus: 660, avatar: "", initials: "SB", color: "bg-pink-500" },

  { id: "4", name: "Pierre Leroy", role: "Commercial Junior", hoursContract: 20, progress: 30, potentialBonus: 471, avatar: "", initials: "PL", color: "bg-blue-500" },

]



const INITIAL_OBJECTIVES: Objective[] = [

  {

    id: "main",

    title: "Chiffre d'affaires mensuel",

    description: "Atteindre les objectifs de ventes mensuels pour débloquer les primes",

    current: 75000,

    target: 100000,

    unit: "€",

    type: "principal",

    paliers: [

        { level: 1, reward: 100, reached: true },

        { level: 2, reward: 250, reached: true },

        { level: 3, reward: 500, reached: false },

        { level: 4, reward: 1000, reached: false },

    ],

    history: [

      { date: "12 Jan (Aujourd'hui)", value: 75000, change: 3000 },

      { date: "11 Jan", value: 72000, change: 4000 },

      { date: "10 Jan", value: 68000, change: 6000 },

      { date: "09 Jan", value: 62000, change: 4000 },

    ]

  },

  {

    id: "sec1",

    title: "Nouveaux clients",

    description: "Acquérir de nouveaux clients",

    current: 12,

    target: 20,

    unit: "clt",

    type: "secondaire",

    paliers: [],

    history: []

  }

]



export default function PilotagePage() {

  const [activeTab, setActiveTab] = useState("objectifs") // "equipes" ou "objectifs"

  const [objectives, setObjectives] = useState(INITIAL_OBJECTIVES)

  const [selectedObj, setSelectedObj] = useState<Objective | null>(null)

  const [updateValue, setUpdateValue] = useState("")



  // Calculs Globaux

  const totalHours = INITIAL_TEAM.reduce((acc, curr) => acc + curr.hoursContract, 0)

  const globalProgress = Math.round(INITIAL_TEAM.reduce((acc, curr) => acc + curr.progress, 0) / INITIAL_TEAM.length)



  // Mise à jour d'un objectif

  const handleUpdateObjective = () => {

    if (!selectedObj || !updateValue) return

    const val = Number(updateValue)

    

    const updatedObjectives = objectives.map(obj => {

        if (obj.id === selectedObj.id) {

            const newCurrent = obj.current + val

            // Ajout historique

            const newHistory = [

                { date: "Maintenant", value: newCurrent, change: val },

                ...obj.history

            ]

            return { ...obj, current: newCurrent, history: newHistory }

        }

        return obj

    })



    setObjectives(updatedObjectives)

    // Mettre à jour l'objet sélectionné aussi pour l'affichage immédiat

    setSelectedObj(updatedObjectives.find(o => o.id === selectedObj.id) || null)

    setUpdateValue("")

  }



  return (

    <div className="min-h-screen bg-background pb-32">

      <Header />



      <main className="px-4 py-6 max-w-lg mx-auto space-y-6">

        

        {/* Navigation Onglets (Style iOS Segmented Control) */}

        <div className="bg-muted/50 p-1 rounded-2xl flex">

            <button 

                onClick={() => setActiveTab("equipes")}

                className={cn(

                    "flex-1 py-2 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2",

                    activeTab === "equipes" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"

                )}

            >

                <Users className="w-4 h-4" /> Équipes

            </button>

            <button 

                onClick={() => setActiveTab("objectifs")}

                className={cn(

                    "flex-1 py-2 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2",

                    activeTab === "objectifs" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"

                )}

            >

                <Target className="w-4 h-4" /> Objectifs

            </button>

        </div>



        {/* ================= VUE ÉQUIPES (Screen 1) ================= */}

        {activeTab === "equipes" && (

            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">

                {/* Header Équipes */}

                <div className="flex items-center justify-between">

                    <div>

                        <h1 className="text-2xl font-bold">Équipes</h1>

                        <p className="text-sm text-muted-foreground">{INITIAL_TEAM.length} collaborateurs</p>

                    </div>

                    <Button size="sm" className="rounded-full bg-purple-500 hover:bg-purple-600 text-white px-4">

                        <Users className="w-4 h-4 mr-2" /> Inviter

                    </Button>

                </div>



                {/* Recherche */}

                <div className="relative">

                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />

                    <Input placeholder="Rechercher un membre..." className="pl-10 rounded-xl bg-muted/30 border-none" />

                </div>



                {/* KPI Cards Grid */}

                <div className="grid grid-cols-3 gap-3">

                    <div className="pulse-card p-4 flex flex-col items-center justify-center text-center bg-muted/10 border-none">

                        <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center mb-2">

                            <Users className="w-4 h-4 text-purple-500" />

                        </div>

                        <span className="text-xl font-bold">{INITIAL_TEAM.length}</span>

                        <span className="text-[10px] text-muted-foreground uppercase font-bold">Membres</span>

                    </div>

                    <div className="pulse-card p-4 flex flex-col items-center justify-center text-center bg-muted/10 border-none">

                        <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center mb-2">

                            <Target className="w-4 h-4 text-blue-500" />

                        </div>

                        <span className="text-xl font-bold">{globalProgress}%</span>

                        <span className="text-[10px] text-muted-foreground uppercase font-bold">Objectifs</span>

                    </div>

                    <div className="pulse-card p-4 flex flex-col items-center justify-center text-center bg-muted/10 border-none">

                        <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center mb-2">

                            <Clock className="w-4 h-4 text-emerald-500" />

                        </div>

                        <span className="text-xl font-bold">{totalHours}h</span>

                        <span className="text-[10px] text-muted-foreground uppercase font-bold">Heures Totales</span>

                    </div>

                </div>



                {/* Liste Collaborateurs */}

                <div className="space-y-3">

                    <h3 className="text-sm font-semibold text-muted-foreground">Collaborateurs</h3>

                    {INITIAL_TEAM.map((member) => (

                        <div key={member.id} className="pulse-card p-4 flex items-center justify-between hover:bg-muted/5 transition-colors">

                            <div className="flex items-center gap-4 flex-1">

                                <div className={cn("w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm", member.color)}>

                                    {member.initials}

                                </div>

                                <div className="flex-1 min-w-0 space-y-1">

                                    <div className="flex justify-between items-center">

                                        <h4 className="font-bold text-base truncate">{member.name}</h4>

                                        <span className="font-bold text-purple-400">{member.potentialBonus}€</span>

                                    </div>

                                    <p className="text-xs text-muted-foreground">{member.role} • {member.hoursContract}h/sem</p>

                                    <div className="flex items-center gap-3">

                                        <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">

                                            <div 

                                                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" 

                                                style={{ width: `${member.progress}%` }} 

                                            />

                                        </div>

                                        <span className="text-xs font-medium text-muted-foreground">{member.progress}%</span>

                                    </div>

                                </div>

                            </div>

                            <ChevronRight className="w-5 h-5 text-muted-foreground/50 ml-2" />

                        </div>

                    ))}

                </div>

            </div>

        )}



        {/* ================= VUE OBJECTIFS (Screen 2) ================= */}

        {activeTab === "objectifs" && (

            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">

                <div className="text-center space-y-1">

                    <h1 className="text-2xl font-bold">Objectifs</h1>

                    <p className="text-sm text-muted-foreground">Suivez votre progression et débloquez vos primes</p>

                </div>



                {/* Objectif Principal Card */}

                {objectives.filter(o => o.type === "principal").map(obj => (

                    <div 

                        key={obj.id} 

                        onClick={() => setSelectedObj(obj)}

                        className="pulse-card p-6 bg-gradient-to-b from-card to-muted/20 cursor-pointer hover:border-primary/50 transition-all group"

                    >

                        <div className="flex items-center gap-2 mb-4 text-purple-400">

                            <Target className="w-4 h-4" />

                            <span className="text-xs font-bold uppercase tracking-wider">Objectif Principal</span>

                        </div>



                        {/* Circular Gauge */}

                        <div className="flex flex-col items-center justify-center mb-6">

                            <CircularProgress value={obj.current} max={obj.target} />

                            <h2 className="text-xl font-bold mt-4">{obj.title}</h2>

                            <p className="text-center text-xs text-muted-foreground mt-1 max-w-[280px] leading-relaxed">

                                {obj.description}

                            </p>

                        </div>



                        {/* Progression Bar */}

                        <div className="space-y-2 mb-6">

                            <div className="flex justify-between text-sm font-medium">

                                <span className="text-muted-foreground">Progression</span>

                                <span>{obj.current.toLocaleString()} / {obj.target.toLocaleString()} {obj.unit}</span>

                            </div>

                            <div className="h-2.5 bg-muted rounded-full overflow-hidden">

                                <div 

                                    className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full transition-all duration-1000" 

                                    style={{ width: `${(obj.current / obj.target) * 100}%` }}

                                />

                            </div>

                        </div>



                        {/* Footer Card */}

                        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-white/5">

                            <div>

                                <p className="text-[10px] text-muted-foreground uppercase font-bold mb-0.5">Prochain palier</p>

                                <p className="font-semibold text-sm">Or</p>

                            </div>

                            <div className="text-right">

                                <p className="text-[10px] text-muted-foreground uppercase font-bold mb-0.5">Objectif</p>

                                <p className="font-bold text-sm text-purple-400">{obj.target.toLocaleString()} {obj.unit}</p>

                            </div>

                            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />

                        </div>

                    </div>

                ))}



                {/* Objectifs Secondaires */}

                <div>

                    <h3 className="font-bold text-lg mb-3 flex items-center gap-2">

                        <Target className="w-5 h-5 text-muted-foreground" />

                        Objectifs Secondaires

                    </h3>

                    <div className="space-y-3">

                        {objectives.filter(o => o.type === "secondaire").map(obj => (

                            <div key={obj.id} onClick={() => setSelectedObj(obj)} className="pulse-card p-4 cursor-pointer hover:bg-muted/10">

                                <div className="flex justify-between items-start mb-2">

                                    <div>

                                        <h4 className="font-bold">{obj.title}</h4>

                                        <p className="text-xs text-muted-foreground">{obj.description}</p>

                                    </div>

                                    <TrendingUp className="w-4 h-4 text-muted-foreground" />

                                </div>

                                <div className="mt-3">

                                    <div className="flex justify-between text-xs mb-1.5">

                                        <span className="font-medium text-muted-foreground">Avancement</span>

                                        <span className="font-bold">{obj.current} / {obj.target} {obj.unit}</span>

                                    </div>

                                    <Progress value={(obj.current / obj.target) * 100} className="h-1.5" />

                                </div>

                            </div>

                        ))}

                    </div>

                </div>

            </div>

        )}

      </main>



      {/* ================= DRAWER DÉTAIL (Screen 3) ================= */}

      <Drawer open={!!selectedObj} onOpenChange={(open) => !open && setSelectedObj(null)}>

        <DrawerContent className="max-h-[95vh] outline-none">

            {selectedObj && (

                <div className="w-full max-w-lg mx-auto">

                    <DrawerHeader className="text-left border-b border-border/50 pb-4">

                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-purple-500/10 mx-auto mb-3">

                            <Target className="w-6 h-6 text-purple-500" />

                        </div>

                        <div className="text-center space-y-1">

                            <Badge variant="outline" className="mb-2 border-purple-500/30 text-purple-400 bg-purple-500/10">

                                {selectedObj.type === "principal" ? "Objectif Principal" : "Objectif Secondaire"}

                            </Badge>

                            <DrawerTitle className="text-2xl font-bold">{selectedObj.title}</DrawerTitle>

                            <p className="text-sm text-muted-foreground px-4">{selectedObj.description}</p>

                        </div>

                    </DrawerHeader>



                    <div className="p-4 space-y-6 overflow-y-auto max-h-[60vh]">

                        {/* Jauge Détail */}

                        <div className="flex flex-col items-center">

                            <CircularProgress value={selectedObj.current} max={selectedObj.target} size={160} strokeWidth={12} />

                        </div>



                        {/* Grille Stats */}

                        <div className="grid grid-cols-3 gap-3">

                            <div className="bg-muted/30 p-3 rounded-2xl text-center border border-border/50">

                                <span className="text-lg font-bold block">500{selectedObj.unit}</span>

                                <span className="text-[10px] text-muted-foreground uppercase font-bold">Prime Max</span>

                            </div>

                            <div className="bg-muted/30 p-3 rounded-2xl text-center border border-border/50">

                                <span className="text-lg font-bold block">{selectedObj.paliers.length || "-"}</span>

                                <span className="text-[10px] text-muted-foreground uppercase font-bold">Paliers</span>

                            </div>

                            <div className="bg-muted/30 p-3 rounded-2xl text-center border border-border/50">

                                <span className="text-lg font-bold block">{selectedObj.paliers.filter(p => p.reached).length || "-"}</span>

                                <span className="text-[10px] text-muted-foreground uppercase font-bold">Débloqués</span>

                            </div>

                        </div>



                        {/* Mise à jour Donnée (Action fonctionnelle) */}

                        <div className="bg-purple-500/5 border border-purple-500/20 p-4 rounded-2xl space-y-3">

                            <h3 className="font-bold text-sm flex items-center gap-2">

                                <Wallet className="w-4 h-4 text-purple-500" />

                                Mettre à jour la progression

                            </h3>

                            <div className="flex gap-2">

                                <Input 

                                    type="number" 

                                    placeholder="Montant à ajouter..." 

                                    value={updateValue}

                                    onChange={(e) => setUpdateValue(e.target.value)}

                                    className="bg-background"

                                />

                                <Button onClick={handleUpdateObjective} className="bg-purple-600 hover:bg-purple-700">

                                    <Plus className="w-4 h-4" />

                                </Button>

                            </div>

                        </div>



                        {/* Historique */}

                        <div>

                            <h3 className="font-bold text-base mb-3 flex items-center gap-2">

                                <TrendingUp className="w-4 h-4 text-purple-500" />

                                Historique de progression

                            </h3>

                            {/* Bar Chart Simulation */}

                            <div className="flex items-end gap-1 h-24 mb-6 px-2">

                                {selectedObj.history.map((h, i) => (

                                    <div key={i} className="flex-1 flex flex-col justify-end gap-1 group">

                                        <div 

                                            className={cn(

                                                "w-full rounded-t-sm transition-all hover:bg-purple-400",

                                                i === 0 ? "bg-purple-500" : "bg-muted"

                                            )} 

                                            style={{ height: `${Math.min(100, (h.value / selectedObj.target) * 80)}%` }} 

                                        />

                                        <div className="h-1 w-full bg-border rounded-full" />

                                    </div>

                                ))}

                            </div>



                            {/* Liste Historique */}

                            <div className="space-y-1">

                                {selectedObj.history.map((h, i) => (

                                    <div key={i} className="flex justify-between items-center p-3 rounded-xl hover:bg-muted/30 transition-colors">

                                        <div className="flex items-center gap-3">

                                            <div className="w-2 h-2 rounded-full bg-purple-500" />

                                            <span className="text-sm font-medium">{h.date}</span>

                                        </div>

                                        <div className="flex items-center gap-4">

                                            <span className="font-bold">{h.value.toLocaleString()}{selectedObj.unit}</span>

                                            <span className="text-xs font-bold text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded">+{h.change}</span>

                                        </div>

                                    </div>

                                ))}

                            </div>

                        </div>

                    </div>

                    

                    <DrawerFooter className="pt-2">

                        <DrawerClose asChild>

                            <Button variant="outline" className="w-full rounded-xl">Fermer</Button>

                        </DrawerClose>

                    </DrawerFooter>

                </div>

            )}

        </DrawerContent>

      </Drawer>



      <BottomNav />

    </div>

  )

}



// --- COMPOSANT JAUGE CIRCULAIRE (SVG) ---

function CircularProgress({ value, max, size = 180, strokeWidth = 12 }: { value: number, max: number, size?: number, strokeWidth?: number }) {

    const radius = (size - strokeWidth) / 2

    const circumference = radius * 2 * Math.PI

    const progress = Math.min(100, Math.max(0, (value / max) * 100))

    const offset = circumference - (progress / 100) * circumference



    return (

        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>

            <svg width={size} height={size} className="transform -rotate-90">

                {/* Background Circle */}

                <circle

                    cx={size / 2} cy={size / 2} r={radius}

                    stroke="currentColor" strokeWidth={strokeWidth}

                    fill="transparent" className="text-muted/20"

                />

                {/* Progress Circle (Gradient via CSS ID or simple color) */}

                <circle

                    cx={size / 2} cy={size / 2} r={radius}

                    stroke="url(#gradient)" strokeWidth={strokeWidth}

                    fill="transparent"

                    strokeDasharray={circumference}

                    strokeDashoffset={offset}

                    strokeLinecap="round"

                    className="transition-all duration-1000 ease-out"

                />

                <defs>

                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">

                        <stop offset="0%" stopColor="#3b82f6" /> {/* Blue */}

                        <stop offset="100%" stopColor="#a855f7" /> {/* Purple */}

                    </linearGradient>

                </defs>

            </svg>

            <div className="absolute flex flex-col items-center">

                <span className="text-4xl font-bold tracking-tighter">{Math.round(progress)}%</span>

                <span className="text-[10px] text-muted-foreground mt-1 font-medium">

                    {value.toLocaleString()} / {max.toLocaleString()}

                </span>

            </div>

        </div>

    )

}

