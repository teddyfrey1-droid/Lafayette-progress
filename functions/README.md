# Cloud Function `sendBulkEmail` — Setup

Ce dossier contient une Cloud Function **callable** :
- `sendBulkEmail` : envoi **Email / Push / Email+Push** (selon le canal choisi dans `diffusion.html`).

## Pré-requis
- Runtime Node.js 20 (voir `functions/package.json`).

## Déploiement
Depuis la racine du projet :

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

## Configuration SMTP (obligatoire pour l'envoi Email)
La fonction envoie les emails via **nodemailer**. Elle lit la configuration dans :
- **Variables d'environnement** (recommandé) : `SMTP_*` et `MAIL_*`
- ou, en fallback, via `functions.config()` si tu utilises encore la config runtime Firebase.

Variables attendues :
- `SMTP_SERVICE` *(optionnel)* (ex: "gmail")
- `SMTP_HOST` *(si pas de service)*
- `SMTP_PORT` *(ex: 587 ou 465)*
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_SECURE` *(optionnel: "true"/"false" ; si absent, `465` ⇒ secure)*
- `MAIL_FROM_EMAIL` *(optionnel, défaut = `SMTP_USER`)*
- `MAIL_FROM_NAME_DEFAULT` *(optionnel)*

> Si `channel` = `push` et que l'option **fallback email** est activée, la fonction enverra un email **uniquement** aux utilisateurs sans token push.
