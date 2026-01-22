// Demo data for the Pulse app - ready for Firebase integration
import {
  User,
  Objective,
  Prime,
  TeamMember,
  NotificationGroup,
  Message,
  FridgeAlert,
  PilotageSettings,
  UserStats,
  SiteCategory,
  UsefulSite,
  AdminSite,
  AdminSiteCategory,
  UsefulContact,
  Palier
} from "./app-data"

// On réexporte les types pour la compatibilité si d'autres fichiers importent depuis ici
export type { User, Objective, Prime, TeamMember, NotificationGroup, Message, FridgeAlert, PilotageSettings, UserStats, SiteCategory, UsefulSite, AdminSite, AdminSiteCategory, UsefulContact, Palier }

// Demo user
export const currentUser: User = {
  id: "1",
  name: "Heiko Lafayette",
  email: "heiko@lafayette.com",
  role: "admin",
  team: "Commercial",
  contractHours: 35,
  baseHours: 35,
}

// Demo objectives
export const objectives: Objective[] = [
  {
    id: "obj-1",
    title: "Chiffre d'affaires mensuel",
    description: "Atteindre les objectifs de ventes mensuels pour débloquer les primes",
    type: "principal",
    progress: 75000,
    target: 100000,
    unit: "€",
    unlocked: true,
    deadline: new Date("2026-01-31"),
    reward: 500,
    isActive: true,
    paliers: [
      { id: "p1", level: 1, name: "Bronze", target: 50000, reward: 100, description: "Premier palier atteint", unlocked: true },
      { id: "p2", level: 2, name: "Argent", target: 75000, reward: 200, description: "Objectif intermédiaire", unlocked: true },
      { id: "p3", level: 3, name: "Or", target: 100000, reward: 300, description: "Objectif principal", unlocked: false },
      { id: "p4", level: 4, name: "Platine", target: 125000, reward: 500, description: "Excellence commerciale", unlocked: false },
    ],
  },
  {
    id: "obj-2",
    title: "Nouveaux clients",
    description: "Acquérir de nouveaux clients ce mois",
    type: "secondary",
    progress: 8,
    target: 15,
    unit: "clients",
    unlocked: false,
    deadline: new Date("2026-01-31"),
    reward: 150,
    isActive: true,
    paliers: [
      { id: "p5", level: 1, name: "Démarrage", target: 5, reward: 50, description: "5 nouveaux clients", unlocked: true },
      { id: "p6", level: 2, name: "Croissance", target: 10, reward: 75, description: "10 nouveaux clients", unlocked: false },
      { id: "p7", level: 3, name: "Excellence", target: 15, reward: 100, description: "15 nouveaux clients", unlocked: false },
    ],
  },
  {
    id: "obj-3",
    title: "Taux de conversion",
    description: "Améliorer le taux de conversion des prospects",
    type: "secondary",
    progress: 22,
    target: 30,
    unit: "%",
    unlocked: false,
    deadline: new Date("2026-01-31"),
    reward: 100,
    isActive: true,
    paliers: [
      { id: "p8", level: 1, name: "Base", target: 20, reward: 30, description: "20% de conversion", unlocked: true },
      { id: "p9", level: 2, name: "Optimisé", target: 25, reward: 50, description: "25% de conversion", unlocked: false },
      { id: "p10", level: 3, name: "Expert", target: 30, reward: 80, description: "30% de conversion", unlocked: false },
    ],
  },
  {
    id: "obj-4",
    title: "Satisfaction client",
    description: "Maintenir un haut niveau de satisfaction",
    type: "secondary",
    progress: 4.2,
    target: 4.5,
    unit: "/5",
    unlocked: false,
    deadline: new Date("2026-01-31"),
    reward: 75,
    isActive: true,
    paliers: [
      { id: "p11", level: 1, name: "Satisfaisant", target: 4.0, reward: 25, description: "Note de 4.0/5", unlocked: true },
      { id: "p12", level: 2, name: "Excellent", target: 4.5, reward: 50, description: "Note de 4.5/5", unlocked: false },
    ],
  },
]

export const primes: Prime[] = [
  { id: "prime-1", month: "Janvier 2026", amount: 0, status: "pending", breakdown: [] },
  {
    id: "prime-2",
    month: "Décembre 2025",
    amount: 450,
    status: "paid",
    breakdown: [
      { objectiveId: "obj-1", objectiveTitle: "CA mensuel", amount: 300 },
      { objectiveId: "obj-2", objectiveTitle: "Nouveaux clients", amount: 100 },
      { objectiveId: "obj-4", objectiveTitle: "Satisfaction", amount: 50 },
    ],
  },
  {
    id: "prime-3",
    month: "Novembre 2025",
    amount: 325,
    status: "paid",
    breakdown: [
      { objectiveId: "obj-1", objectiveTitle: "CA mensuel", amount: 200 },
      { objectiveId: "obj-3", objectiveTitle: "Taux conversion", amount: 75 },
      { objectiveId: "obj-4", objectiveTitle: "Satisfaction", amount: 50 },
    ],
  },
]

export const teamMembers: TeamMember[] = [
  { id: "t1", name: "Marie Dupont", email: "marie@pulse.com", role: "Manager", objectives: 4, completedObjectives: 3, contractHours: 35, baseHours: 35, excludeFromPrimes: false },
  { id: "t2", name: "Jean Martin", email: "jean@pulse.com", role: "Commercial", objectives: 4, completedObjectives: 2, contractHours: 35, baseHours: 35, excludeFromPrimes: false },
  { id: "t3", name: "Sophie Bernard", email: "sophie@pulse.com", role: "Commercial", objectives: 4, completedObjectives: 4, contractHours: 28, baseHours: 35, excludeFromPrimes: false },
  { id: "t4", name: "Pierre Leroy", email: "pierre@pulse.com", role: "Commercial Junior", objectives: 3, completedObjectives: 1, contractHours: 20, baseHours: 35, excludeFromPrimes: false },
  { id: "t5", name: "Camille Moreau", email: "camille@pulse.com", role: "Commercial", objectives: 4, completedObjectives: 3, contractHours: 35, baseHours: 35, excludeFromPrimes: false },
]

export const notificationGroups: NotificationGroup[] = [
  { id: "g1", name: "Equipe Commerciale", description: "Tous les commerciaux de l'équipe", members: ["t2", "t3", "t4", "t5"], color: "#D10FA8", createdAt: new Date("2025-12-01") },
  { id: "g2", name: "Managers", description: "Responsables d'équipe", members: ["t1"], color: "#7A2FF0", createdAt: new Date("2025-12-01") },
  { id: "g3", name: "Equipe Logistique", description: "Responsables des stocks et livraisons", members: ["t3", "t5"], color: "#10B981", createdAt: new Date("2025-12-15") },
]

export const messages: Message[] = [
  { id: "msg-1", title: "Objectifs Janvier", content: "Les nouveaux objectifs pour janvier sont maintenant disponibles. Consultez votre tableau de bord.", audience: ["Tous"], audienceType: "all", sentAt: new Date("2026-01-02"), status: "sent", channels: ["email", "push"] },
  { id: "msg-2", title: "Primes Décembre", content: "Les primes de décembre ont été validées et seront versées le 15 janvier.", audience: ["Equipe Commerciale"], audienceType: "groups", sentAt: new Date("2026-01-05"), status: "sent", channels: ["email"] },
  { id: "msg-3", title: "Rappel réunion", content: "Réunion d'équipe demain à 10h en salle de conférence.", audience: ["Marie Dupont", "Jean Martin"], audienceType: "users", sentAt: new Date("2026-01-10"), status: "scheduled", channels: ["push"], scheduledFor: new Date("2026-01-11T09:00:00") },
]

export const fridgeAlerts: FridgeAlert[] = [
  { id: "f1", fridgeName: "Frigo Principal", location: "Cuisine centrale", currentTemp: 4.2, maxTemp: 5, minTemp: 2, status: "normal", lastUpdate: new Date(), alertHistory: [] },
  { id: "f2", fridgeName: "Chambre Froide 1", location: "Stock A", currentTemp: -17.5, maxTemp: -18, minTemp: -22, status: "warning", lastUpdate: new Date(), alertHistory: [{ id: "ah1", type: "warning", temp: -17.5, timestamp: new Date(), acknowledged: false }] },
  { id: "f3", fridgeName: "Frigo Desserts", location: "Cuisine pâtisserie", currentTemp: 6.8, maxTemp: 5, minTemp: 2, status: "critical", lastUpdate: new Date(), alertHistory: [{ id: "ah2", type: "critical", temp: 6.8, timestamp: new Date(), acknowledged: false }, { id: "ah3", type: "warning", temp: 5.5, timestamp: new Date(Date.now() - 3600000), acknowledged: true }] },
  { id: "f4", fridgeName: "Congélateur Viandes", location: "Stock B", currentTemp: -20, maxTemp: -18, minTemp: -25, status: "normal", lastUpdate: new Date(), alertHistory: [] },
]

export const pilotageSettings: PilotageSettings = {
  baseHours: 35,
  globalMultiplier: 1,
  objectives: objectives.map((obj) => ({
    id: obj.id,
    title: obj.title,
    description: obj.description,
    type: obj.type,
    isActive: obj.isActive,
    target: obj.target,
    unit: obj.unit,
    paliers: obj.paliers.map((p) => ({
      id: p.id,
      name: p.name,
      threshold: p.target,
      reward: p.reward,
      description: p.description,
    })),
  })),
}

export const userStats: UserStats = {
  level: 3,
  xp: 2450,
  maxXp: 3000,
  streak: 12,
  achievements: [
    { id: "a1", title: "Premier Pas", description: "Compléter votre premier objectif", icon: "star", unlocked: true, unlockedAt: new Date("2025-11-15"), rarity: "common" },
    { id: "a2", title: "En Feu", description: "Maintenir une série de 7 jours", icon: "flame", unlocked: true, unlockedAt: new Date("2025-12-01"), rarity: "rare" },
    { id: "a3", title: "Champion Bronze", description: "Atteindre le palier Bronze", icon: "trophy", unlocked: true, unlockedAt: new Date("2025-12-10"), rarity: "common" },
    { id: "a4", title: "Champion Argent", description: "Atteindre le palier Argent", icon: "trophy", unlocked: true, unlockedAt: new Date("2026-01-05"), rarity: "rare" },
    { id: "a5", title: "Champion Or", description: "Atteindre le palier Or", icon: "crown", unlocked: false, rarity: "epic" },
    { id: "a6", title: "Légende", description: "Atteindre le niveau maximum", icon: "gem", unlocked: false, rarity: "legendary" },
    { id: "a7", title: "Perfectionniste", description: "Compléter tous les objectifs du mois", icon: "target", unlocked: false, rarity: "epic" },
    { id: "a8", title: "Vétéran", description: "30 jours consécutifs", icon: "medal", unlocked: false, rarity: "legendary" },
  ],
}

export const siteCategories: SiteCategory[] = [
  { id: "aides", name: "Aides", icon: "heart-handshake", color: "#10B981" },
  { id: "avantages", name: "Avantages", icon: "gift", color: "#8B5CF6" },
  { id: "planning", name: "Planning", icon: "calendar", color: "#06B6D4" },
  { id: "sante", name: "Santé", icon: "heart-pulse", color: "#EF4444" },
  { id: "formation", name: "Formation", icon: "graduation-cap", color: "#F59E0B" },
  { id: "rh", name: "RH", icon: "users", color: "#EC4899" },
  { id: "impots", name: "Impôts", icon: "landmark", color: "#6366F1" },
  { id: "logement", name: "Logement", icon: "home", color: "#14B8A6" },
  { id: "emploi", name: "Emploi", icon: "briefcase", color: "#F97316" },
]

export const usefulSites: UsefulSite[] = [
  { id: "s1", name: "CAF", description: "Les caisses d'allocations familiales gèrent les allocations familiales du régime général de la Sécurité sociale.", url: "https://www.caf.fr", category: "aides" },
  { id: "s2", name: "WIZBII", description: "WIZBII améliore votre pouvoir d'achat et facilite l'obtention de vos aides financières", url: "https://www.wizbii.com", category: "aides" },
  { id: "s3", name: "PouvoirPlus", description: "Profitez de remises tout au long de l'année sur plus de 100 000 offres variées", url: "https://www.pouvoirplus.fr", category: "avantages" },
  { id: "s4", name: "Combo", description: "Combo est un logiciel de planning et de gestion pour organiser vos équipes", url: "https://www.combo.com", category: "planning" },
  { id: "s5", name: "Alan", description: "Votre partenaire santé qui prévient, assure et accompagne au quotidien", url: "https://www.alan.com", category: "sante" },
  { id: "s6", name: "Ameli", description: "Le site de l'Assurance Maladie pour gérer vos remboursements et démarches", url: "https://www.ameli.fr", category: "sante" },
  { id: "s7", name: "Impots.gouv.fr", description: "Portail officiel de l'administration fiscale pour déclarer et payer vos impôts", url: "https://www.impots.gouv.fr", category: "impots" },
  { id: "s8", name: "Service-Public.fr", description: "Le site officiel de l'administration française - toutes vos démarches en ligne", url: "https://www.service-public.fr", category: "aides" },
  { id: "s9", name: "Action Logement", description: "Aides au logement pour les salariés : avance Loca-Pass, garantie Visale, aide à la mobilité", url: "https://www.actionlogement.fr", category: "logement" },
  { id: "s10", name: "Pôle Emploi", description: "Services pour les demandeurs d'emploi et les entreprises qui recrutent", url: "https://www.pole-emploi.fr", category: "emploi" },
  { id: "s11", name: "CPAM", description: "Caisse Primaire d'Assurance Maladie - vos droits et démarches santé", url: "https://www.ameli.fr", category: "sante" },
  { id: "s12", name: "1% Logement", description: "Aides au logement pour les salariés d'entreprises privées", url: "https://www.actionlogement.fr", category: "logement" },
]

export const adminSiteCategories: AdminSiteCategory[] = [
  { id: "gestion", name: "Gestion", icon: "settings", color: "#8B5CF6" },
  { id: "livraison", name: "Livraison", icon: "truck", color: "#10B981" },
  { id: "communication", name: "Communication", icon: "message-circle", color: "#06B6D4" },
  { id: "rh-admin", name: "RH Admin", icon: "users", color: "#EC4899" },
  { id: "finance", name: "Finance", icon: "wallet", color: "#F59E0B" },
]

export const adminSites: AdminSite[] = [
  { id: "as1", name: "Dood", description: "Plateforme de gestion des commandes et livraisons en temps réel", url: "https://www.dood.com", category: "livraison", logo: "/dood-logo-green-food-delivery.jpg" },
  { id: "as2", name: "Mal", description: "Outil de gestion des plannings et ressources humaines", url: "https://www.mal.com", category: "gestion", logo: "/mal-logo-purple-planning.jpg" },
  { id: "as3", name: "Slack", description: "Messagerie d'équipe pour la communication interne", url: "https://slack.com", category: "communication", logo: "/slack-logo-colorful-hashtag.jpg" },
  { id: "as4", name: "Notion", description: "Documentation et wiki interne de l'entreprise", url: "https://www.notion.so", category: "gestion", logo: "/notion-logo-black-white-minimal.jpg" },
  { id: "as5", name: "PayFit", description: "Gestion de la paie et des congés", url: "https://www.payfit.com", category: "rh-admin", logo: "/payfit-logo-blue-payroll.jpg" },
  { id: "as6", name: "Pennylane", description: "Comptabilité et gestion financière", url: "https://www.pennylane.com", category: "finance", logo: "/pennylane-logo-yellow-accounting.jpg" },
  { id: "as7", name: "Uber Eats Manager", description: "Gestion des commandes Uber Eats", url: "https://merchants.ubereats.com", category: "livraison", logo: "/uber-eats-logo-green-black.jpg" },
  { id: "as8", name: "Deliveroo Partner Hub", description: "Tableau de bord partenaire Deliveroo", url: "https://partner.deliveroo.com", category: "livraison", logo: "/deliveroo-logo-teal-rider.jpg" },
]

export const usefulContacts: UsefulContact[] = [
  { id: "c1", name: "Fixe Heiko", phone: "01.40.00.24.30", role: "Siège", category: "siege" },
  { id: "c2", name: "Steve", phone: "06.09.98.28.45", role: "Responsable", category: "management" },
  { id: "c3", name: "Teddy", phone: "06.50.03.02.11", role: "Technique", category: "technique" },
]

// Helper functions (simples wrappers)
export const getPrincipalObjective = () => objectives.find((o) => o.type === "principal")
export const getSecondaryObjectives = () => objectives.filter((o) => o.type === "secondary")
export const getCurrentPrime = () => primes.find((p) => p.status === "pending")
export const getNextPalier = (objective: Objective) => objective.paliers.find((p) => !p.unlocked)
export const calculateTotalPotentialPrime = () => objectives.reduce((sum, obj) => sum + obj.reward, 0)
export const getDaysRemaining = () => {
  const now = new Date()
  return Math.ceil((new Date(now.getFullYear(), now.getMonth() + 1, 0).getTime() - now.getTime()) / (86400000))
}
export const calculateProRataPrime = (basePrime: number, contractHours: number, baseHours: number) => Math.round((basePrime * contractHours) / baseHours)
export const getCriticalAlerts = () => fridgeAlerts.filter((f) => f.status === "critical" || f.status === "warning")
