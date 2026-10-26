import {createBackupTools} from './backups.js';

// The adapter is injected; storage failures do not have UI side effects.
export class StorageService {
  constructor(adapter) { this.adapter=adapter; this.backups=createBackupTools(adapter); }
  getItem(key) { return this.adapter.getItem(key); }
  setItem(key,value) { this.adapter.setItem(key,value); }
  removeItem(key) { this.adapter.removeItem(key); }
  read(key,fallback) { try { return JSON.parse(this.getItem(key))??fallback; } catch { return fallback; } }
  write(key,value) { try { this.setItem(key,JSON.stringify(value)); return true; } catch { return false; } }
  exportBackup() { return this.backups.exportBackup(); }
  parseBackup(text) { const file=JSON.parse(text); this.validateBackup(file); return file; }
  serializeBackup() { return JSON.stringify(this.exportBackup(),null,2); }
  validateBackup(file) { return this.backups.validateBackup(file); }
  planImport(file,includeSettings=false) { return this.backups.planImport(file,includeSettings); }
  applyImport(file,includeSettings=false) { return this.backups.applyImport(file,includeSettings); }
  undoImport() { return this.backups.undoImport(); }
  canUndo() { return this.backups.canUndo(); }
}
