import {validStudio,studioSettings} from './mixes.js';
import {createBackupTools} from './backups.js';

// The adapter is injected; storage failures do not have UI side effects.
export class StorageService {
  constructor(adapter) { this.adapter=adapter; this.backups=createBackupTools(adapter); }
  getItem(key) { return this.adapter.getItem(key); }
  setItem(key,value) { this.adapter.setItem(key,value); }
  removeItem(key) { this.adapter.removeItem(key); }
  read(key,fallback) { try { return JSON.parse(this.getItem(key))??fallback; } catch { return fallback; } }
  write(key,value) { try { this.setItem(key,JSON.stringify(value)); return true; } catch { return false; } }
  loadStudio(key) {
    const loaded=this.read(key,null);
    return validStudio(loaded)?studioSettings(loaded):null;
  }
  loadMixes(levelKeys) {
    const mixes=this.read('focus-mixes-v3',[]);
    return Array.isArray(mixes) ? mixes.filter(m=>validStudio(m)&&typeof m.name==='string'&&m.levels&&levelKeys.every(k=>Number.isFinite(m.levels[k])&&m.levels[k]>=0&&m.levels[k]<=100)).slice(0,50) : [];
  }
  exportBackup() { return this.backups.exportBackup(); }
  parseBackup(text) { const file=JSON.parse(text); this.validateBackup(file); return file; }
  serializeBackup() { return JSON.stringify(this.exportBackup(),null,2); }
  validateBackup(file) { return this.backups.validateBackup(file); }
  planImport(file,includeSettings=false) { return this.backups.planImport(file,includeSettings); }
  applyImport(file,includeSettings=false) { return this.backups.applyImport(file,includeSettings); }
  undoImport() { return this.backups.undoImport(); }
  canUndo() { return this.backups.canUndo(); }
}
