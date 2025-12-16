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
