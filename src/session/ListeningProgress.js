// Tracks elapsed time already accounted for, independently of UI and persistence.
export class ListeningProgress {
  constructor() {
    this.recordedMs=0;
  }

  checkpoint(elapsedMs=0) {
    this.recordedMs=elapsedMs;
  }

  advance(elapsedMs,{silent=false,flush=false}={}) {
    if(silent){this.checkpoint(elapsedMs);return 0;}
    const deltaMs=elapsedMs-this.recordedMs;
    if(deltaMs>=(flush?1000:5000)) {
      const seconds=Math.floor(deltaMs/1000);
      this.recordedMs+=seconds*1000;
      return seconds;
    }
    return 0;
  }
}
