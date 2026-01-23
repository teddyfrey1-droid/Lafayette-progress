export async function logSystemAction(data: {
  userId: string
  userName: string
  userRole: string
  companyId: string
  companyName: string
  action: string
  details: string
}) {
  try {
    // On appelle notre API sécurisée
    await fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
    });
    console.log("✅ Log envoyé via API");
  } catch (error) {
    console.error("❌ Erreur Log API:", error);
  }
}
