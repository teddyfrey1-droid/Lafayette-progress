# Push notifications (FCM) — Setup rapide

## 1) VAPID key (obligatoire)
Firebase Console → Cloud Messaging → Web Push certificates → génère la clé (VAPID **public key**)

Puis, mets-la dans la Realtime Database :
`/config/vapidKey = "<TA_CLE_VAPID_PUBLIC>"`

## 2) Déployer la Cloud Function
Ce dossier contient une callable function `sendPush` (admin/superadmin) avec ciblage :

- **all** : tout le monde
- **admins** : admins uniquement
- **users** : utilisateurs (hors admins)
- **one** : un utilisateur précis (targetUid)

Déploiement :
- `firebase init functions` (si pas déjà fait)
- `firebase deploy --only functions`

## 3) Côté front
Dans le menu du dashboard :
- bouton **📲 Installer l’app** (si le navigateur le permet)
- bouton **🔔 Activer les notifications**

⚠️ iPhone/iPad : les push Web ne fonctionnent que si l’app est "Ajouter à l’écran d’accueil" (PWA).
