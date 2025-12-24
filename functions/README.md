# Push notifications (FCM) — Quick setup

## 1) VAPID key (obligatoire)
Firebase Console → Cloud Messaging → Web Push certificates → génère la clé (VAPID public key)

Puis, mets-la dans la Realtime Database :
/config/vapidKey = "<TA_CLE_VAPID_PUBLIC>"

## 2) Déployer la function (optionnel)
Ce dossier contient une callable function `sendPushToAll` (admin/superadmin).

- firebase init functions
- firebase deploy --only functions

## 3) Côté front
Dans le menu du dashboard, bouton 🔔 "Activer les notifications".
⚠️ Sur iPhone/iPad, l’app doit être "Ajouter à l’écran d’accueil" pour recevoir les push.


## 4) Email fallback (optionnel)
Dans l’onglet Admin → 🔔 Notifications, tu peux cocher “📧 Envoyer aussi par email…”.

⚠️ Pour que l’email fonctionne, il faut configurer un SMTP côté Cloud Functions.

### Option A — variables d’environnement (recommandé)
- SMTP_HOST
- SMTP_PORT (ex: 465 ou 587)
- SMTP_USER
- SMTP_PASS
- MAIL_FROM (ex: "Heiko Lafayette <no-reply@ton-domaine.fr>")

### Option B — firebase functions config
Exemple :
- firebase functions:config:set smtp.host="..." smtp.port="587" smtp.user="..." smtp.pass="..." mail.from="..."
- firebase deploy --only functions
