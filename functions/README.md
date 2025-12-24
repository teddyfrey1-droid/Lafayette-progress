# Email (Cloud Functions) — Setup

Cette version **n’utilise plus les notifications push** : les messages partent **par email**.

## 1) Déployer les Cloud Functions

Depuis la racine du projet (là où se trouve `firebase.json`) :

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

Après déploiement, tu dois voir dans Firebase Console > Functions :
- `sendEmailToUser`
- `sendEmailToUsers`
- `getSmtpConfigStatus`
- `setSmtpConfig`
- `testSmtp`

## 2) Configurer le SMTP (sans CLI)

Dans l’app :
**Panneau Manager → 📧 Emails → ⚙️ Configuration SMTP**

1. Remplis :
   - SMTP host
   - Port (587 ou 465)
   - User / Pass
   - From (ex : `Heiko Lafayette <no-reply@ton-domaine.fr>`)
2. Clique **💾 Sauvegarder SMTP**
3. Clique **🧪 Tester** (ça t’envoie un email test)

📌 La configuration est stockée côté serveur dans Realtime Database sous :
`configPrivate/smtp` (écrit/lu par Cloud Functions).

⚠️ Le mot de passe SMTP est sensible.
Idéalement, protège l’accès à `configPrivate/*` dans tes règles RTDB (lecture côté clients désactivée).

## 3) Si des anciennes Functions “push” apparaissent encore

Si ton projet avait des Functions `sendPush*`, elles peuvent rester dans la console.
Lors du `firebase deploy`, la CLI propose généralement de supprimer les Functions qui n’existent plus dans le code : accepte pour nettoyer.
