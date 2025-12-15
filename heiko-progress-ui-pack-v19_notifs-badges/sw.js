/* PWA Service Worker (NO-CACHE / Network-only)
   Objectif: éviter tout contenu "stale" après mise à jour.
   - pas de cache applicatif (HTML/CSS/JS) -> mise à jour immédiate
   - garde le SW uniquement pour les critères d'installation PWA
*/

const SW_VERSION = 'v3-nocache-' + Date.now();

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // purge tous les caches existants (anciens SW)
    try{
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }catch(e){}
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // same-origin uniquement ; Firebase/Google Fonts etc en réseau standard
  if (url.origin !== self.location.origin) return;

  // Network-only + no-store (quand supporté)
  event.respondWith((async () => {
    try{
      const noStoreReq = new Request(req, { cache: 'no-store' });
      return await fetch(noStoreReq);
    }catch(e){
      // fallback
      return fetch(req);
    }
  })());
});
