const CACHE_NAME = 'focus-audio-v3.45';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './src/session/cycles.js',
  './src/storage/backups.js',
  './src/storage/StorageService.js',
  './src/storage/DailyHistory.js',
  './src/ui/FocusController.js',
  './src/ui/PlaybackController.js',
  './src/ui/BrowserPlaybackServices.js',
  './src/ui/PwaController.js',
  './src/ui/InsightsController.js',
  './src/ui/BackupController.js',
  './src/ui/SharedMixController.js',
  './src/ui/CycleController.js',
  './src/ui/MixLibraryView.js',
  './src/ui/StudioController.js',
  './src/ui/VolumeController.js',
  './src/ui/SessionExtensionController.js',
  './src/ui/MixLibraryController.js',
  './src/main.js',
  './src/ui/HistoryView.js',
  './src/ui/ResponsiveController.js',
  './src/session/sharing.js',
  './src/storage/insights.js',
  './src/storage/mixes.js',
  './src/session/SessionClock.js',
  './src/session/SessionPersistence.js',
  './src/session/ListeningProgress.js',
  './src/audio/FocusAudioEngine.js',
  './src/audio/scenes.js',
  './src/audio/dsp.js',
  './audio/noise-processor.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './screenshots/screenshot-desktop.png',
  './screenshots/screenshot-mobile.png'
];

// Instalación y pre-cacheo de recursos críticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Activation requires a request from a paused client; installation alone never forces it.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    event.waitUntil(self.skipWaiting());
  }
});

// Activación y limpieza de versiones obsoletas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key.startsWith('focus-audio-') && key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estrategia Cache-First para funcionamiento 100% offline
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html').then((page) => page || caches.match('./'));
        }
      });
    })
  );
});
