export function formatFirebaseAuthError(err: unknown): string {
  const maybeError = err as { code?: string; message?: string }
  const code = maybeError?.code ?? ""
  if ((maybeError?.message ?? "").includes("Firebase n'est pas configuré")) {
    return "Configuration manquante : renseigne les variables Firebase (voir .env.example)."
  }
  switch (code) {
    case "auth/invalid-email":
      return "Email invalide."
    case "auth/user-disabled":
      return "Ce compte est désactivé."
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Email ou mot de passe incorrect."
    case "auth/email-already-in-use":
      return "Cet email est déjà utilisé."
    case "auth/weak-password":
      return "Mot de passe trop faible."
    case "auth/network-request-failed":
      return "Erreur réseau. Vérifie ta connexion."
    default:
      return "Une erreur est survenue. Réessaie."
  }
}
