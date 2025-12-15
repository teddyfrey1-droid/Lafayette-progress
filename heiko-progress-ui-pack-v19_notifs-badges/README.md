# Heiko Progress — structure prête pour évolutions

Ce dossier reprend **à l’identique** ton `index.html` (visuels + logique + Firebase),
mais en le découpant pour pouvoir ajouter des fonctionnalités plus facilement.

## Arborescence

- `index.html` : page principale (inchangé fonctionnellement)
- `assets/css/styles.css` : tout le CSS qui était dans la balise `<style>`
- `assets/js/app.js` : tout le JS qui était dans la dernière balise `<script>`

## Ajouter des fonctionnalités plus tard (sans casser l’existant)

- Mets de nouveaux fichiers JS dans `assets/js/modules/` puis importe-les depuis `assets/js/app.js`.
- Mets les images dans `assets/img/`.

## Déploiement (Render / Static site)

Déploie ce dossier comme un site statique. `index.html` est à la racine.
