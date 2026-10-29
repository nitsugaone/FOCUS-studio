import {createCycleTools} from './cycles.js';

const SESSION_KEY='focus-session-v1';

// Session snapshots, save cadence and restore rules without UI or clock mutation.
export class SessionPersistence {
  constructor({storage,cycleTools=createCycleTools(),currentTime=()=>Date.now()}) {
    this.storage=storage;
    this.cycleTools=cycleTools;
    this.currentTime=()=>currentTime();
    this.lastSave=0;
  }

  save(snapshot,force=false) {
    if(!force&&this.currentTime()-this.lastSave<5000)return;
    this.lastSave=this.currentTime();
    return this.storage.write(SESSION_KEY,snapshot);
  }

  restore() {
    const saved=this.storage.read(SESSION_KEY,null),cycleTools=this.cycleTools;
    if(!saved||!Number.isFinite(saved.elapsed)||saved.elapsed<0||saved.elapsed>7*86400000)return null;
    let cycle=saved.cycle?cycleTools.normalize(saved.cycle):cycleTools.initial('single',cycleTools.validDuration(saved.duration)?saved.duration:0);
    if(!cycle||cycleTools.duration(cycle)!==saved.duration)return null;
    const duration=saved.duration,elapsed=duration?Math.min(saved.elapsed,duration*60000):saved.elapsed;
    if(cycle.plan!=='single'&&elapsed>=duration*60000)cycle=cycleTools.complete(cycle);
    return {duration,elapsed,cycle};
  }
}
