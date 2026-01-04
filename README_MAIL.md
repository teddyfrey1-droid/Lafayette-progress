# Module Mail (Lafayette-progress)

Ce dépôt ajoute un onglet **📧 Mail** dans le panneau admin, avec :
- sélection des destinataires (individuels)
- envoi via **groupes** (groupes sauvegardés en base)
- appel d'une Cloud Function `sendBulkEmail` pour l'envoi réel

## 1) Côté Front (déjà inclus)
- Onglet : **Admin > Mail**
- Paramètres :
  - `settings/functionsRegion` (optionnel, défaut `us-central1`)
  - `settings/mailFromName` (optionnel)
- Groupes : `mailGroups/{groupId}`

## 2) Côté Backend (Cloud Functions)
Un dossier `functions/` est inclus avec :
- `sendBulkEmail` (callable)
- envoi SMTP via `nodemailer`

### Déploiement (Firebase)
1. Installer les deps dans `functions/`
2. Définir les paramètres/secret SMTP (recommandé via Secrets)
3. Déployer les functions

> Important : l'onglet front appelle la région stockée dans `settings/functionsRegion`.
> La fonction dans `functions/index.js` est configurée en **us-central1** par défaut.

### Paramètres attendus
- `SMTP_HOST` ou `SMTP_SERVICE`
- `SMTP_PORT`
- `SMTP_USER` (secret)
- `SMTP_PASS` (secret)
- `MAIL_FROM_EMAIL`
- `MAIL_FROM_NAME_DEFAULT` (optionnel)

## 3) Automatisation future (planning)
Le front est prêt pour être déclenché automatiquement via une Cloud Function (RTDB trigger) quand une entrée de planning est créée/modifiée.
La structure exacte du `planning` n'est pas définie ici : il faudra adapter le trigger à votre schéma.
