// ==========================================================================
// CONFIG PRO PRODUKČNÍ A OFFLINE PROVOZ
// ==========================================================================
const ENABLE_CACHE = false; // ZAPNUTO pro plný offline provoz
const CACHE_NAME = 'ozora-2026-v4';

// Zde necháváme jen absolutní základ, který v dist/ zaručeně existuje.
// Všechny ostatní skripty, styly a fonty si fetch handler nacacheuje dynamicky!
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.webmanifest'
];

// ==========================================================================
// INSTALACE (Precaching základních souborů & okamžitá aktivace)
// ==========================================================================
self.addEventListener('install', (event) => {
  // Okamžitě přinutí nový Service Worker aktivovat se bez čekání na zavření záložek
  self.skipWaiting();

  if (!ENABLE_CACHE) {
    console.log('[SW] Cache je VYPNUTÁ');
    return;
  }

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Ukládám základní App Shell do cache');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .catch((err) => {
        console.error('[SW] Chyba při precachování (instalace i tak pokračuje):', err);
      })
  );
});

// ==========================================================================
// AKTIVACE (Čištění starých cache & převzetí kontroly nad klienty)
// ==========================================================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME || !ENABLE_CACHE) {
            console.log('[SW] Mazání staré cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      // Okamžitě převezme kontrolu nad všemi otevřenými oknami/záložkami
      return self.clients.claim();
    })
  );
});

// ==========================================================================
// FETCH (Odchytávání požadavků & Dynamické kešování pro Offline)
// ==========================================================================
self.addEventListener('fetch', (event) => {
  if (!ENABLE_CACHE) {
    event.respondWith(fetch(event.request));
    return;
  }

  const requestUrl = new URL(event.request.url);

  // 1. STRATEGIE PRO JSON API (Network First -> Fallback do Cache)
  if (requestUrl.href.includes('ozora_2026_json.php') || requestUrl.href.includes('data.json')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Pokud selže síť (offline), vrátíme uložený JSON z cache
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
          });
        })
    );
    return;
  }

  // 2. STRATEGIE PRO STATIKU A PARCEL BUNDLY (Cache First -> Fallback na Síť + Dynamické uložení)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Pokud máme soubor v cache, rovnou ho vrátíme
      if (cachedResponse) {
        return cachedResponse;
      }

      // Pokud v cache není (např. zkompilované JS/CSS z Parcelu), stáhneme ho ze sítě a uložíme pro příště
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });

        return networkResponse;
      }).catch((err) => {
        console.warn('[SW] Požadavek selhal a není v cache:', event.request.url, err);
      });
    })
  );
});