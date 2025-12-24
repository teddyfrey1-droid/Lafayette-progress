# Email (Cloud Functions) — Quick setup

Ce projet a **désactivé** les notifications push pour le moment.
Les messages aux équipes passent donc **uniquement par email** via Cloud Functions.

## 1) Pré-requis SMTP

Il te faut des identifiants SMTP (fournisseur mail / domaine / service SMTP) :
- host
- port
- user
- pass
- from (adresse expéditeur)

⚠️ Sans ça, la Function renverra `EMAIL_NOT_CONFIGURED`.

## 2) Configurer la Function (2 options supportées par le code)

### Option A — Firebase Functions config (CLI)

Exemple (à adapter) :

```bash
firebase functions:config:set   smtp.host="SMTP_HOST"   smtp.port="587"   smtp.user="SMTP_USER"   smtp.pass="SMTP_PASS"   mail.from="Heiko Lafayette <no-reply@ton-domaine.fr>"
```

### Option B — Variables d’environnement (process.env)

Le code lit aussi :

- SMTP_HOST
- SMTP_PORT
- SMTP_USER
- SMTP_PASS
- MAIL_FROM

## 3) Déployer

```bash
firebase deploy --only functions
```

## 4) Utilisation côté app

Dans le panneau Manager > onglet **📧 Emails** :
- Sélectionne 1 ou plusieurs destinataires
- Renseigne sujet + message (+ lien optionnel)
- Clique **Envoyer**

Le log est stocké dans RTDB : `notifications/sent`.
