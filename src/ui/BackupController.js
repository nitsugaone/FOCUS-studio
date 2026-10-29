// Coordinates backup UI; validation and transactions remain in StorageService.
export function createBackupController({window,document,$,storage,URL,Blob,getPlaybackState,reloadAfterRestore}) {
  const backupTools=storage;
  let pendingBackup=null,backupReadSequence=0;

  function syncBackupButtons() {
    const {playing,transitioning}=getPlaybackState();
    $('import-backup').disabled=!pendingBackup||playing||transitioning;
    try{$('undo-backup').hidden=!backupTools.canUndo();}catch(_){$('undo-backup').hidden=true;}
    $('undo-backup').disabled=playing||transitioning;
  }
  function previewBackup() {
    const {playing}=getPlaybackState();
    if(!pendingBackup)return;
    try {
      const plan=backupTools.planImport(pendingBackup,$('backup-settings').checked);
      const info=plan.summary;
      $('backup-summary').textContent='Archivo: '+info.mixesInFile+' mezclas, '+info.daysInFile+' días y '+info.ratingsInFile+' valoraciones. Se agregarán '+info.mixesAdded+' mezclas y '+info.ratingsAdded+' valoraciones.'+
        (info.ratingsDiscarded?' Se descartarán '+info.ratingsDiscarded+' valoraciones antiguas por el límite de 200.':'')+
        (info.includeSettings?' Se usarán también los ajustes y la sesión de la copia.':' Tus volúmenes, ambiente y sesión actuales se mantienen.');
      $('backup-preview').hidden=false;
      $('backup-status').textContent=playing?'Pausá la reproducción antes de importar.':'Revisá la vista previa y elegí Importar para aplicar.';
      syncBackupButtons();
    }catch(error){pendingBackup=null;$('backup-preview').hidden=true;$('backup-status').textContent=error.message;syncBackupButtons();}
  }
  function initBackups() {
    $('backup-file').addEventListener('change',async()=>{
      const sequence=++backupReadSequence;
      pendingBackup=null;$('backup-preview').hidden=true;syncBackupButtons();
      const file=$('backup-file').files?.[0];if(!file)return;
      if(file.size>1048576){$('backup-status').textContent='El archivo supera el límite de 1 MB.';return;}
      $('backup-status').textContent='Leyendo copia…';
      try {
        const text=await file.text();if(sequence!==backupReadSequence)return;
        const parsed=backupTools.parseBackup(text);pendingBackup=parsed;previewBackup();
      }catch(error){if(sequence===backupReadSequence){$('backup-status').textContent='No se pudo abrir la copia: '+error.message;syncBackupButtons();}}
    });
    $('backup-settings').addEventListener('change',previewBackup);
    $('cancel-backup').addEventListener('click',()=>{
      backupReadSequence++;pendingBackup=null;$('backup-file').value='';$('backup-preview').hidden=true;
      $('backup-status').textContent='Importación cancelada.';syncBackupButtons();
    });
    $('import-backup').addEventListener('click',()=>{
      const {playing,transitioning}=getPlaybackState();
      if(!pendingBackup||playing||transitioning)return;
      try{backupTools.applyImport(pendingBackup,$('backup-settings').checked);reloadAfterRestore();}
      catch(error){$('backup-status').textContent=error.message;syncBackupButtons();}
    });
    $('undo-backup').addEventListener('click',()=>{
      const {playing,transitioning}=getPlaybackState();
      if(playing||transitioning)return;
      try{backupTools.undoImport();reloadAfterRestore();}
      catch(error){$('backup-status').textContent=error.message;syncBackupButtons();}
    });
    $('export-backup').addEventListener('click',()=>{
      try {
        const content=backupTools.serializeBackup();
        const url=URL.createObjectURL(new Blob([content],{type:'application/json'}));
        const link=document.createElement('a');link.href=url;
        link.download='focus-copia-'+new Date().toISOString().slice(0,10)+'.json';
        document.body.append(link);link.click();link.remove();
        window.setTimeout(()=>URL.revokeObjectURL(url),10000);
        $('backup-status').textContent='Copia preparada para descargar.';
      }catch(error){$('backup-status').textContent='No se pudo crear la copia: '+error.message;}
    });
    syncBackupButtons();
  }

  return {syncBackupButtons,initBackups};
}
