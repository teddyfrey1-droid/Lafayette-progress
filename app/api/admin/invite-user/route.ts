import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { sendWelcomeEmail } from "@/lib/email-service"; // Ajustez le chemin si nécessaire (ex: "@/lib/email-service")
import { UserRole } from "@/lib/rbac-schema"; // Import des types

export async function POST(req: Request) {
  console.log("🚀 [API] Début invitation Pulse App");
  
  try {
    const body = await req.json();
    const { email, firstName, lastName, role, contractHours, company } = body;

    if (!email || !firstName || !lastName) {
      return NextResponse.json({ error: "Champs requis manquants." }, { status: 400 });
    }

    const displayName = `${firstName} ${lastName}`.trim();
    
    // 1. Auth : Création du compte
    const userRecord = await adminAuth.createUser({ email, displayName, emailVerified: true });
    
    // 2. Firestore : Sauvegarde avec Type sécurisé pour le rôle
    await adminDb.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      displayName,
      firstName,
      lastName,
      // Utilisation de l'Enum (fallback sur EMPLOYEE si invalide ou vide)
      role: Object.values(UserRole).includes(role) ? role : UserRole.EMPLOYEE,
      contractHours: Number(contractHours) || 0,
      company: company || "Heiko",
      disabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 3. Email : Utilisation du Service unifié
    const actionLink = await adminAuth.generatePasswordResetLink(email);
    
    // Note : On n'attend pas forcément l'envoi d'email pour répondre au client si on veut aller vite,
    // mais ici on attend pour être sûr de capter une erreur SMTP.
    await sendWelcomeEmail(email, firstName, company, actionLink);

    return NextResponse.json({ success: true, uid: userRecord.uid });

  } catch (error: any) {
    console.error("❌ [API] Erreur Invite:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH et DELETE restent inchangés sauf pour l'usage de UserRole si vous voulez le typer strictement.
// Pour l'instant, seul POST était critique pour le refactoring email.
export async function PATCH(req: Request) {
    // ... (Votre code PATCH existant, rien de critique à changer ici pour l'instant)
    // Copiez votre fonction PATCH actuelle ici
    try {
        const body = await req.json();
        const { uid, email, firstName, lastName, role, contractHours, company } = body;
    
        // ... (Logique Auth update) ...
        const authUpdates: any = {};
        if (email) authUpdates.email = email;
        if (firstName || lastName) {
             const newDisplayName = `${firstName || ""} ${lastName || ""}`.trim();
             if (newDisplayName) authUpdates.displayName = newDisplayName;
        }
        if (Object.keys(authUpdates).length > 0) await adminAuth.updateUser(uid, authUpdates);

        // ... (Logique Firestore update) ...
        const updateData: any = { updatedAt: new Date() };
        if (email) updateData.email = email;
        if (firstName) updateData.firstName = firstName;
        if (lastName) updateData.lastName = lastName;
        if (firstName || lastName) updateData.displayName = `${firstName || ""} ${lastName || ""}`.trim();
        if (role) updateData.role = role; // Idéalement valider avec UserRole ici aussi
        if (contractHours !== undefined) updateData.contractHours = Number(contractHours);
        if (company) updateData.company = company;
    
        await adminDb.collection("users").doc(uid).update(updateData);
    
        return NextResponse.json({ success: true });
      } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
}

export async function DELETE(req: Request) {
    // ... (Votre code DELETE existant)
    try {
        const { searchParams } = new URL(req.url);
        const uid = searchParams.get("uid");
        if (!uid) return NextResponse.json({ error: "UID requis" }, { status: 400 });
    
        await adminAuth.deleteUser(uid);
        await adminDb.collection("users").doc(uid).delete();
    
        return NextResponse.json({ success: true });
      } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
}
