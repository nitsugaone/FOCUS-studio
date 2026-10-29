// Browser playback resources and external media actions, independent of the audio graph.
export function createBrowserPlaybackServices({
  navigator,isPlaying,play,pause,getMediaMetadata=()=>globalThis.MediaMetadata
}) {
  let wakeLock=null;

  async function requestWakeLock() {
    if ('wakeLock' in navigator && isPlaying() && !wakeLock) {
      try {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => {
          wakeLock = null;
        });
      } catch (_) {
        wakeLock = null;
      }
    }
  }

  async function releaseWakeLock() {
    if (wakeLock) {
      try {
        await wakeLock.release();
      } catch (_) {}
      wakeLock = null;
    }
  }

  function setupMediaSession() {
    if (!('mediaSession' in navigator)) return;
    try {
      const MediaMetadata=getMediaMetadata();
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'Focus — Paisaje Sonoro',
        artist: 'Síntesis Binaural',
        album: 'Motor Procedural',
        artwork: [
          {
            src: './icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: './icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => { play(); });
      navigator.mediaSession.setActionHandler('pause', () => { pause(); });
      navigator.mediaSession.setActionHandler('stop', () => { pause(); });
    } catch (_) {}
  }

  return {requestWakeLock,releaseWakeLock,setupMediaSession};
}
