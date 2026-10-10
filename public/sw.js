// Queue rules (shouldQueue, pickHeaders) live in their own file so tests can
// load them.
importScripts('/sw-queue-rules.js');

const CACHE_NAME = 'asset-tracker-v2';
// Holds worker state that must survive the browser stopping an idle worker.
const META_CACHE_NAME = 'asset-tracker-meta';
const META_USER_KEY = '/__sw-meta/user';
const OFFLINE_URL = '/offline';

// Static assets to pre-cache
const PRECACHE_URLS = [
  '/',
  '/offline',
  '/manifest.json',
  '/icons/icon.svg',
];

// Install event - pre-cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== META_CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// --- IndexedDB helpers for offline mutation queue (raw IDB, no library in SW) ---
const IDB_NAME = 'asset-tracker-offline';
const IDB_STORE = 'mutation-queue';

function openQueueDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function storeInQueue(entry) {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(entry, entry.id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function clearQueueStore() {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// --- Who is signed in ---
// The worker cannot read the session. The page tells it with a SET_USER
// message and each queued change is stamped with that id, so a change is only
// ever replayed for the user who made it. The id is also kept in Cache Storage
// because the browser stops idle workers and the in-memory value would be lost.
// undefined = not loaded yet, null = nobody signed in.
let currentUserId;

async function loadStoredUserId() {
  try {
    const cache = await caches.open(META_CACHE_NAME);
    const stored = await cache.match(META_USER_KEY);
    if (!stored) return null;
    const data = await stored.json();
    return typeof data.userId === 'string' ? data.userId : null;
  } catch {
    return null;
  }
}

async function getCurrentUserId() {
  if (currentUserId === undefined) {
    const stored = await loadStoredUserId();
    // A SET_USER or CLEAR_QUEUE that arrived while the stored value was being
    // read is newer, so it wins.
    if (currentUserId === undefined) currentUserId = stored;
  }
  return currentUserId;
}

async function setCurrentUserId(userId) {
  currentUserId = userId;
  try {
    const cache = await caches.open(META_CACHE_NAME);
    if (userId === null) {
      await cache.delete(META_USER_KEY);
    } else {
      await cache.put(META_USER_KEY, new Response(JSON.stringify({ userId })));
    }
  } catch {
    // The in-memory value still applies until the worker is stopped.
  }
}

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'SET_USER') {
    const userId =
      typeof data.userId === 'string' && data.userId ? data.userId : null;
    event.waitUntil(setCurrentUserId(userId));
  } else if (data.type === 'CLEAR_QUEUE') {
    event.waitUntil(Promise.all([clearQueueStore(), setCurrentUserId(null)]));
  }
});

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Keeps a mutation whose network request failed and answers 202. A body that
// may hold a credential is not kept: the caller gets the 503 below instead, as
// if the request had simply failed.
async function queueFailedMutation(request) {
  try {
    const body = await request.clone().text();
    if (self.bodyHasSecrets(request.headers.get('content-type'), body)) {
      return jsonResponse(503, {
        error: 'You are offline. This request contains credentials, so it was not saved.',
        code: 'offline_not_queued',
      });
    }
    const entry = {
      id: crypto.randomUUID(),
      url: request.url,
      method: request.method,
      headers: self.pickHeaders(request.headers),
      body: body || null,
      timestamp: Date.now(),
      retryCount: 0,
      userId: await getCurrentUserId(),
    };
    await storeInQueue(entry);
    // Notify all clients
    const clients = await self.clients.matchAll();
    clients.forEach((c) => c.postMessage({ type: 'MUTATION_QUEUED' }));
    return jsonResponse(202, { queued: true, id: entry.id });
  } catch {
    return jsonResponse(503, { error: 'Offline and queue failed' });
  }
}

// Fetch event - network first for pages, cache first for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-http(s) schemes (e.g. chrome-extension)
  if (!url.protocol.startsWith('http')) return;

  // Failed app API mutations are queued (sw-queue-rules.js decides which).
  // Anything else that is not a GET, such as auth calls, uploads, replays and
  // the HEAD connectivity probe, goes to the network untouched.
  const sameOrigin = url.origin === self.location.origin;
  if (sameOrigin && self.shouldQueue(request.method, url.pathname, request.headers)) {
    event.respondWith(
      fetch(request.clone()).catch(() => queueFailedMutation(request))
    );
    return;
  }

  // Skip non-GET requests that aren't API calls
  if (request.method !== 'GET') return;

  // Skip API requests and auth
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/api/auth')) return;

  // For navigation requests (HTML pages) - network first
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            if (cached) return cached;
            return caches.match(OFFLINE_URL).then((offlinePage) => {
              if (offlinePage) return offlinePage;
              return caches.match('/');
            });
          });
        })
    );
    return;
  }

  // For static assets - stale while revalidate
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|gif|woff2?)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
        return cached || fetchPromise;
      })
    );
    return;
  }
});
