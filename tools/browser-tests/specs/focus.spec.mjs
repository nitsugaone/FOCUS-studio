import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

const errors=new WeakMap();
test.beforeEach(async({page},info)=>{
 if(info.title.startsWith('guided cycles')||info.title.startsWith('focus view')||info.title.startsWith('custom duration')||info.title.startsWith('stereo width')||info.title.startsWith('note timing')||info.title.startsWith('fade session')||info.title.startsWith('keep mix')||info.title.startsWith('silent rest')||info.title.startsWith('channel balance'))await page.clock.install();
 if(info.title.startsWith('note timing')||info.title.startsWith('channel balance'))await page.addInitScript(()=>{
  window.createdOscillators=0;
  const Context=window.AudioContext||window.webkitAudioContext;
  if(Context){const original=Context.prototype.createOscillator;Context.prototype.createOscillator=function(){window.createdOscillators++;return original.call(this);};}
 });
 if(info.title.startsWith('silent rest')||info.title.startsWith('wind scene')||info.title.startsWith('audio deadline'))await page.addInitScript(()=>{
  const Context=window.AudioContext||window.webkitAudioContext;
  window.restOscillators=0;
  if(Context){
   const original=Context.prototype.createMediaStreamDestination,oscillator=Context.prototype.createOscillator;
   Context.prototype.createMediaStreamDestination=function(){const node=original.call(this);window.restContext=this;window.restStream=node.stream;return node;};
   Context.prototype.createOscillator=function(){window.restOscillators++;return oscillator.call(this);};
  }
 });
 if(info.title.startsWith('audio deadline'))await page.addInitScript(()=>{window.setInterval=()=>0;});
 const pageErrors=[];errors.set(page,pageErrors);
 page.on('pageerror',error=>pageErrors.push(error.message));
 await page.goto('./');
 await expect(page.locator('#toggle')).toBeVisible();
});
test.afterEach(async({page})=>{expect(errors.get(page)).toEqual([]);});

async function expand(page,id) {
 if(!(await page.locator('#'+id).evaluate(element=>element.open)))await page.locator('#'+id+'>summary').click();
}
async function noOverflow(page) {
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
}

test('layout adapts without horizontal overflow and produces a review screenshot',async({page},info)=>{
 await noOverflow(page);
 await expect(page.locator('#session-feedback')).toBeHidden();
 const width=page.viewportSize().width,compact=width<=900;
 await expect(page.locator('#sound-settings')).toHaveJSProperty('open',!compact);
 const player=await page.locator('#player-card').boundingBox(),mixer=await page.locator('.mixer-card').boundingBox();
 if(compact)expect(mixer.y).toBeGreaterThanOrEqual(player.y+player.height-1);
 else {expect(mixer.x).toBeGreaterThanOrEqual(player.x+player.width-1);expect(Math.abs(mixer.y-player.y)).toBeLessThan(2);}
 const play=await page.locator('#toggle').boundingBox();
 expect(play.y+play.height).toBeLessThanOrEqual(page.viewportSize().height);
 await page.screenshot({path:info.outputPath('layout.png'),fullPage:true,animations:'disabled'});
});

test('audio, dock and resizing share one playback state',async({page})=>{
 await page.locator('#toggle').click();
 await expect(page.locator('#status-text')).toHaveText('Sonando');
 await expect(page.locator('#error-message')).toBeHidden();
 await expect.poll(()=>page.locator('#timer').textContent()).not.toBe('00:00:00');
 await page.setViewportSize({width:1100,height:900});
 await expect(page.locator('#sound-settings')).toHaveJSProperty('open',true);
 await expect(page.locator('#play-label')).toHaveText('Pausar');
 await noOverflow(page);
 await page.setViewportSize({width:390,height:844});
 await expect(page.locator('#sound-settings')).toHaveJSProperty('open',false);
 await page.locator('footer').scrollIntoViewIfNeeded();
 await expect(page.locator('#mobile-player')).toBeVisible();
 await expect(page.locator('#mobile-toggle')).toHaveText('Pausar');
 await expect.poll(()=>page.evaluate(()=>document.getElementById('mobile-timer').textContent===document.getElementById('timer').textContent)).toBe(true);
 await page.locator('#mobile-toggle').click();
 await expect(page.locator('#play-label')).toHaveText('Iniciar');
 await page.locator('#toggle').scrollIntoViewIfNeeded();
 await expect(page.locator('#mobile-player')).toBeHidden();
});

test('favorite mixes persist after reload',async({page})=>{
 await page.locator('#soundscape').selectOption('space');
 await expand(page,'mix-settings');
 await page.locator('#preset-name').fill('Mi lectura');
 await page.locator('#save-mix').click();
 await page.locator('#favorite-mix').click();
 await expect(page.locator('#favorite-mixes button')).toHaveText('★ Mi lectura');
 await page.reload();
 await page.locator('#favorite-mixes button').click();
 await expect(page.locator('#studio-status')).toHaveText('Mezcla cargada.');
 await expect(page.locator('#soundscape')).toHaveValue('space');
});

test('backup downloads, previews, imports and undoes in a real browser',async({page})=>{
 await expand(page,'backup-panel');
 const downloadPromise=page.waitForEvent('download');
 await page.locator('#export-backup').click();
 const download=await downloadPromise;
 const backup=JSON.parse(await readFile(await download.path(),'utf8'));
 expect(backup.format).toBe('focus-studio-backup');
 const before=await page.evaluate(()=>localStorage.getItem('focus-mixes-v3'));
 backup.data.mixes=[{scene:'rain',evolution:35,brightness:50,melody:true,name:'Importada',duration:25,favorite:true,levels:{master:60,noise:70,drone:20,notes:10}}];
 await page.locator('#backup-file').setInputFiles({name:'focus.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
 await expect(page.locator('#backup-preview')).toBeVisible();
 expect(await page.evaluate(()=>localStorage.getItem('focus-mixes-v3'))).toBe(before);
 await Promise.all([page.waitForEvent('load'),page.locator('#import-backup').click()]);
 await expect(page.locator('#favorite-mixes button')).toHaveText('★ Importada');
 await expand(page,'backup-panel');
 await Promise.all([page.waitForEvent('load'),page.locator('#undo-backup').click()]);
 expect(await page.evaluate(()=>localStorage.getItem('focus-mixes-v3'))).toBe(before);
});

test('installed cache reloads and plays while offline',async({page,context})=>{
 await page.evaluate(()=>navigator.serviceWorker.ready);
 await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
 await context.setOffline(true);
 await page.reload();
 await expect(page.locator('#soundscape')).toBeVisible();
 await page.locator('#toggle').click();
 await expect(page.locator('#status-text')).toHaveText('Sonando');
 await expect(page.locator('#error-message')).toBeHidden();
 await context.setOffline(false);
});

test('ratings filter correctly without overflowing the mobile page',async({page},info)=>{
 await page.evaluate(()=>{
 const date=new Date(Date.now()-1000).toISOString();
 localStorage.setItem('focus-feedback-v3',JSON.stringify([
 ...Array.from({length:3},()=>({scene:'rain',rating:5,date,minutes:25,distractions:'low'})),
 ...Array.from({length:3},()=>({scene:'ocean',rating:4,date,minutes:25,distractions:'medium'}))
 ]));
 });
 await page.reload();
 await expand(page,'history-card');
 await expect(page.locator('#insights-summary')).toContainText('6 valoraciones');
 await expect(page.locator('#insights-rows tr')).toHaveCount(2);
 await page.locator('#insights-scene').selectOption('ocean');
 await expect(page.locator('#insights-summary')).toContainText('3 valoraciones');
 await expect(page.locator('#insights-rows tr')).toHaveCount(1);
 await noOverflow(page);
 await page.screenshot({path:info.outputPath('ratings.png'),fullPage:true,animations:'disabled'});
});

test('guided cycles wait for explicit start and restore a paused break',async({page})=>{
 await page.locator('#session-plan').selectOption('25-5');
 await expect(page.locator('#cycle-status')).toContainText('Ronda 1 de 4');
 await expect(page.locator('#timer')).toHaveText('00:25:00');
 await expect(page.locator('[data-minutes="25"]')).toBeDisabled();
 await page.locator('#focus-view-toggle').click();
 await page.locator('#toggle').click();
 await expect(page.locator('#status-text')).toHaveText('Sonando');
 await expect(page.locator('#session-plan')).toBeDisabled();
 await page.clock.fastForward(25*60000+1000);
 await expect(page.locator('#status-text')).toHaveText('Tramo terminado');
 await expect(page.locator('#play-label')).toHaveText('Descansar');
 await expect(page.locator('#session-feedback')).toBeVisible();
 await page.locator('#save-feedback').click();
 await expect(page.locator('#feedback-status')).toHaveText('Valoración guardada en este dispositivo.');
 await expect(page.locator('#studio-status')).not.toHaveText('Valoración guardada en este dispositivo.');
 await page.clock.fastForward(60000);
 await expect(page.locator('#play-label')).toHaveText('Descansar');
 await page.locator('#toggle').click();
 await expect(page.locator('#status-text')).toHaveText('Sonando');
 await expect(page.locator('#cycle-status')).toContainText('Descanso');
 await expect(page.locator('#timer')).toHaveText('00:05:00');
 await expect(page.locator('#session-feedback')).toBeHidden();
 await page.clock.fastForward(5*60000+1000);
 await expect(page.locator('#play-label')).toHaveText('Siguiente');
 await expect(page.locator('#session-feedback')).toBeHidden();
 await page.locator('#toggle').click();
 await expect(page.locator('#status-text')).toHaveText('Sonando');
 await expect(page.locator('#cycle-status')).toContainText('Ronda 2 de 4');
 await page.locator('#toggle').click();
 await page.locator('#focus-view-toggle').click();
 await page.locator('#session-plan').selectOption('50-10');
 await expect(page.locator('#timer')).toHaveText('00:50:00');
 await expand(page,'backup-panel');
 const recoveryDownload=page.waitForEvent('download');
 await page.locator('#export-backup').click();
 const recoveryFile=await recoveryDownload;
 const recovery=JSON.parse(await readFile(await recoveryFile.path(),'utf8'));
 recovery.data.session={duration:10,elapsed:120000,cycle:{plan:'50-10',round:1,phase:'rest',completed:false,singleDuration:0}};
 await page.locator('#backup-file').setInputFiles({name:'recovery.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(recovery))});
 await expect(page.locator('#backup-preview')).toBeVisible();
 await page.locator('#backup-settings').check();
 await Promise.all([page.waitForEvent('load'),page.locator('#import-backup').click()]);
 await expect(page.locator('#session-plan')).toHaveValue('50-10');
 await expect(page.locator('#cycle-status')).toContainText('Descanso');
 await expect(page.locator('#timer')).toHaveText('00:08:00');
 await expect(page.locator('#status-text')).toHaveText('En pausa');
 await expand(page,'mix-settings');
 await page.locator('#preset-name').fill('Rutina 50');
 await page.locator('#save-mix').click();
 await expand(page,'backup-panel');
 const downloadPromise=page.waitForEvent('download');
 await page.locator('#export-backup').click();
 const download=await downloadPromise;
 const backup=JSON.parse(await readFile(await download.path(),'utf8'));
 expect(backup.data.session.cycle.phase).toBe('rest');
 expect(backup.data.mixes[0].cyclePlan).toBe('50-10');
 await page.locator('#session-plan').selectOption('single');
 await expect(page.locator('#cycle-hint')).toBeHidden();
 await expect(page.locator('[data-minutes="25"]')).toBeEnabled();
 await page.locator('[data-minutes="45"]').click();
 await expand(page,'mix-settings');
 await page.locator('#saved-mixes').selectOption('0');
 await page.locator('#load-mix').click();
 await expect(page.locator('#session-plan')).toHaveValue('50-10');
 await page.locator('#session-plan').selectOption('single');
 await expect(page.locator('#timer')).toHaveText('00:45:00');
 await noOverflow(page);
});


test('focus view preserves playback, volume and progress and exits with Escape',async({page},info)=>{
 await page.locator('[data-minutes="25"]').click();
 await page.locator('#toggle').click();
 await expect(page.locator('#status-text')).toHaveText('Sonando');
 await page.clock.fastForward(60000);
 await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
 const timer=await page.locator('#timer').textContent();
 const settings=await page.evaluate(()=>localStorage.getItem('focus-audio-settings-v2'));
 await page.locator('#focus-view-toggle').click();
 await expect(page.locator('#focus-view-toggle')).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('#focus-view-toggle')).toHaveText('Ver todos los controles');
 await expect(page.locator('.mixer-card')).toBeHidden();
 await expect(page.locator('#soundscape')).toBeHidden();
 await expect(page.locator('#session-plan')).toBeHidden();
 await expect(page.locator('#history-card')).toBeHidden();
 await expect(page.locator('#backup-panel')).toBeHidden();
 await expect(page.locator('#focus-view-scene')).toHaveText('Lluvia cálida');
 await expect(page.locator('#play-label')).toHaveText('Pausar');
 await expect(page.locator('#timer')).toHaveText(timer);
 expect(await page.evaluate(()=>localStorage.getItem('focus-audio-settings-v2'))).toBe(settings);
 await expect(page.locator('.orbit')).toHaveCSS('animation-name','none');
 await noOverflow(page);
 await page.screenshot({path:info.outputPath('focus-view.png'),fullPage:true,animations:'disabled'});
 await page.locator('#vol-master').focus();
 await page.keyboard.press('ArrowLeft');
 const volume=await page.locator('#vol-master').inputValue();
 await page.keyboard.press('Escape');
 await expect(page.locator('#focus-view-toggle')).toBeFocused();
 await expect(page.locator('#focus-view-toggle')).toHaveAttribute('aria-pressed','false');
 await expect(page.locator('.mixer-card')).toBeVisible();
 await expect(page.locator('#soundscape')).toBeVisible();
 await expect(page.locator('#play-label')).toHaveText('Pausar');
 await expect(page.locator('#timer')).toHaveText(timer);
 await expect(page.locator('#vol-master')).toHaveValue(volume);
 await page.locator('#toggle').click();
 await page.locator('#focus-view-toggle').click();
 await expect(page.locator('#play-label')).toHaveText('Iniciar');
 await page.locator('#focus-view-toggle').click();
 await expect(page.locator('.mixer-card')).toBeVisible();
 await page.locator('#focus-view-toggle').click();
 await page.reload();
 await expect(page.locator('#focus-view-toggle')).toHaveAttribute('aria-pressed','false');
 await expect(page.locator('.mixer-card')).toBeVisible();
 await expect(page.locator('#status-text')).toHaveText('En pausa');
 await expect(page.locator('#vol-master')).toHaveValue(volume);
});

test('custom duration validates, survives mixes and backup, and completes without autoplay',async({page})=>{
 const original=await page.locator('#timer').textContent();
 for(const value of ['', '0', '181', '1.5']) {
  await page.locator('#custom-minutes').fill(value);
  await page.locator('#apply-duration').click();
  await expect(page.locator('#custom-minutes')).toHaveAttribute('aria-invalid','true');
  await expect(page.locator('#timer')).toHaveText(original);
 }
 await page.locator('#custom-minutes').fill('17');
 await page.locator('#custom-minutes').press('Enter');
 await expect(page.locator('#timer')).toHaveText('00:17:00');
 await expect(page.locator('#custom-minutes')).toHaveAttribute('aria-invalid','false');
 await expect(page.locator('.mode-chip[aria-pressed="true"]')).toHaveCount(0);
 await page.locator('#session-plan').selectOption('25-5');
 await expect(page.locator('#custom-minutes')).toBeDisabled();
 await page.locator('#session-plan').selectOption('single');
 await expect(page.locator('#timer')).toHaveText('00:17:00');
 await expand(page,'mix-settings');
 await page.locator('#preset-name').fill('Sesión de 17 minutos');
 await page.locator('#save-mix').click();
 await page.locator('[data-minutes="45"]').click();
 await page.locator('#saved-mixes').selectOption('0');
 await page.locator('#load-mix').click();
 await expect(page.locator('#timer')).toHaveText('00:17:00');
 await page.reload();
 await expect(page.locator('#timer')).toHaveText('00:17:00');
 await expect(page.locator('#custom-minutes')).toHaveValue('17');
 await expect(page.locator('#status-text')).toHaveText('En pausa');
 await expand(page,'backup-panel');
 const promise=page.waitForEvent('download');
 await page.locator('#export-backup').click();
 const download=await promise;
 const backup=JSON.parse(await readFile(await download.path(),'utf8'));
 expect(backup.data.mixes[0].duration).toBe(17);
 expect(backup.data.session.duration).toBe(17);
 await page.locator('[data-minutes="45"]').click();
 await page.locator('#backup-file').setInputFiles({name:'custom.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
 await page.locator('#backup-settings').check();
 await Promise.all([page.waitForEvent('load'),page.locator('#import-backup').click()]);
 await expect(page.locator('#timer')).toHaveText('00:17:00');
 await expect(page.locator('#custom-minutes')).toHaveValue('17');
 await page.locator('#custom-minutes').fill('1');
 await page.locator('#apply-duration').click();
 await page.locator('#toggle').click();
 await expect(page.locator('#status-text')).toHaveText('Sonando');
 await expect(page.locator('#custom-minutes')).toBeDisabled();
 await expect(page.locator('#apply-duration')).toBeDisabled();
 await page.clock.fastForward(61000);
 await expect(page.locator('#status-text')).toHaveText('En pausa');
 await expect(page.locator('#timer')).toHaveText('00:00:00');
 await expect(page.locator('#session-feedback')).toBeVisible();
 await expect(page.locator('#apply-duration')).toBeEnabled();
 await page.locator('#focus-view-toggle').click();
 await expect(page.locator('.custom-duration')).toBeHidden();
 await noOverflow(page);
 await page.locator('#focus-view-toggle').click();
 await expect(page.locator('.custom-duration')).toBeVisible();
 await page.goto('./?duration=17');
 await expect(page.locator('#timer')).toHaveText('00:17:00');
 await expect(page.locator('#status-text')).toHaveText('En pausa');
 await expand(page,'backup-panel');
 const shortcutDownload=page.waitForEvent('download');
 await page.locator('#export-backup').click();
 const shortcutFile=await shortcutDownload;
 const shortcutBackup=JSON.parse(await readFile(await shortcutFile.path(),'utf8'));
 expect(shortcutBackup.data.session.duration).toBe(17);
 expect(shortcutBackup.data.session.cycle.singleDuration).toBe(17);
 await page.goto('./?duration=181');
 await expect(page.locator('#timer')).toHaveText('00:17:00');
 await page.goto('./?mode=19');
 await expect(page.locator('#timer')).toHaveText('00:19:00');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('focus-session-v1')).duration)).toBe(19);
});


test('shared mix links preview before applying and preserve personal data',async({page},info)=>{
 await page.locator('#soundscape').selectOption('ocean');
 await page.locator('#vol-master').evaluate(el=>{el.value='28';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.locator('#custom-minutes').fill('17');
 await page.locator('#apply-duration').click();
 await expand(page,'mix-settings');
 await page.locator('#preset-name').fill('Nombre privado');
 await page.locator('#save-mix').click();
 const personal=await page.evaluate(()=>({mixes:localStorage.getItem('focus-mixes-v3'),ratings:localStorage.getItem('focus-feedback-v3')}));
 await page.locator('#create-share-link').click();
 const link=await page.locator('#share-link').inputValue();
 const data=JSON.parse(decodeURIComponent(new URL(link).hash.slice(5)));
 expect(data.duration).toBe(17);
 expect(Object.keys(data).sort()).toEqual(['v','scene','evolution','brightness','melody','stereoWidth','balance','notePace','fadeOutSeconds','preserveMix','restSound','cyclePlan','duration','levels'].sort());
 expect(link).not.toContain('Nombre');
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedMix=text;}}}));
 await page.locator('#copy-share-link').click();
 await expect(page.locator('#share-link-status')).toHaveText('Enlace copiado.');
 expect(await page.evaluate(()=>window.copiedMix)).toBe(link);
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('Blocked');}}}));
 await page.locator('#copy-share-link').click();
 await expect(page.locator('#share-link')).toBeFocused();
 await expect(page.locator('#share-link-status')).toContainText('manualmente');
 expect(await page.locator('#share-link').evaluate(el=>el.selectionEnd-el.selectionStart)).toBe(link.length);
 await page.locator('#soundscape').selectOption('space');
 await page.locator('[data-minutes="45"]').click();
 await page.goto(link);
 await expect(page.locator('#shared-mix-preview')).toBeVisible();
 await expect(page.locator('#shared-mix-summary')).toContainText('Océano profundo · 17 minutos');
 await expect(page.locator('#soundscape')).toHaveValue('space');
 await expect(page.locator('#timer')).toHaveText('00:45:00');
 await expect(page.locator('#status-text')).toHaveText('En pausa');
 await noOverflow(page);
 await page.screenshot({path:info.outputPath('shared-mix-preview.png'),fullPage:true,animations:'disabled'});
 await page.locator('#toggle').click();
 await expect(page.locator('#apply-shared-mix')).toBeDisabled();
 await page.locator('#toggle').click();
 await page.locator('#apply-shared-mix').click();
 await expect(page.locator('#soundscape')).toHaveValue('ocean');
 await expect(page.locator('#vol-master')).toHaveValue('28');
 await expect(page.locator('#timer')).toHaveText('00:17:00');
 await expect(page.locator('#status-text')).toHaveText('En pausa');
 await expect(page.locator('#shared-mix-preview')).toBeHidden();
 expect(await page.evaluate(()=>window.location.hash)).toBe('');
 expect(await page.evaluate(()=>localStorage.getItem('focus-mixes-v3'))).toBe(personal.mixes);
 expect(await page.evaluate(()=>localStorage.getItem('focus-feedback-v3'))).toBe(personal.ratings);
 await page.reload();
 await expect(page.locator('#timer')).toHaveText('00:17:00');
 await expect(page.locator('#soundscape')).toHaveValue('ocean');
 await expect(page.locator('#status-text')).toHaveText('En pausa');
 await page.locator('#session-plan').selectOption('50-10');
 await expand(page,'mix-settings');
 await page.locator('#create-share-link').click();
 const cycleLink=await page.locator('#share-link').inputValue();
 await page.locator('#session-plan').selectOption('single');
 await page.goto(cycleLink);
 await expect(page.locator('#shared-mix-summary')).toContainText('50/10');
 await page.locator('#apply-shared-mix').click();
 await expect(page.locator('#cycle-status')).toContainText('Ronda 1 de 2');
 await expect(page.locator('#timer')).toHaveText('00:50:00');
 await page.locator('#session-plan').selectOption('single');
 await expect(page.locator('#timer')).toHaveText('00:17:00');
 await page.goto(link);
 await expect(page.locator('#shared-mix-preview')).toBeVisible();
 const before=await page.evaluate(()=>JSON.stringify({...localStorage}));
 await page.locator('#dismiss-shared-mix').click();
 expect(await page.evaluate(()=>JSON.stringify({...localStorage}))).toBe(before);
 await expect(page.locator('#shared-mix-preview')).toBeHidden();
 await page.goto('./#mix=%3Cscript%3E');
 await expect(page.locator('#shared-mix-status')).toContainText('no es válido');
 await expect(page.locator('#shared-mix-preview')).toBeHidden();
 await expect(page.locator('#timer')).toHaveText('00:17:00');
 await expect(page.locator('#status-text')).toHaveText('En pausa');
 await noOverflow(page);
});


test('stereo width persists in mixes, shared links and backups without restarting playback',async({page},info)=>{
 await page.locator('#custom-minutes').fill('17');
 await page.locator('#apply-duration').click();
 await expand(page,'sound-settings');
 await expect(page.locator('#stereo-width')).toHaveValue('100');
 await page.locator('#toggle').click();
 await page.clock.fastForward(60000);
 await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
 const timer=await page.locator('#timer').textContent(),master=await page.locator('#vol-master').inputValue();
 await page.locator('#stereo-width').evaluate(el=>{el.value='25';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await expect(page.locator('#stereo-width-value')).toHaveText('25%');
 await expect(page.locator('#timer')).toHaveText(timer);
 await expect(page.locator('#status-text')).toHaveText('Sonando');
 await expect(page.locator('#vol-master')).toHaveValue(master);
 await page.locator('#toggle').click();
 await expand(page,'mix-settings');
 await page.locator('#preset-name').fill('Lectura centrada');
 await page.locator('#save-mix').click();
 await page.locator('#create-share-link').click();
 const shared=await page.locator('#share-link').inputValue();
 expect(JSON.parse(decodeURIComponent(new URL(shared).hash.slice(5))).stereoWidth).toBe(25);
 await expand(page,'backup-panel');
 const promise=page.waitForEvent('download');
 await page.locator('#export-backup').click();
 const download=await promise;
 const backup=JSON.parse(await readFile(await download.path(),'utf8'));
 expect(backup.data.studio.stereoWidth).toBe(25);expect(backup.data.mixes[0].stereoWidth).toBe(25);
 await page.locator('#stereo-width').evaluate(el=>{el.value='80';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.locator('#saved-mixes').selectOption('0');await page.locator('#load-mix').click();
 await expect(page.locator('#stereo-width')).toHaveValue('25');
 await page.reload();
 await expand(page,'sound-settings');
 await expect(page.locator('#stereo-width')).toHaveValue('25');
 await expect(page.locator('#status-text')).toHaveText('En pausa');
 delete backup.data.studio.stereoWidth;backup.data.mixes.forEach(mix=>delete mix.stereoWidth);
 await expand(page,'backup-panel');
 await page.locator('#backup-file').setInputFiles({name:'old-stereo.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
 await page.locator('#backup-settings').check();
 await Promise.all([page.waitForEvent('load'),page.locator('#import-backup').click()]);
 await expand(page,'sound-settings');
 await expect(page.locator('#stereo-width')).toHaveValue('100');
 await page.goto(shared);
 await expect(page.locator('#shared-mix-summary')).toContainText('Amplitud estéreo: 25%');
 await page.locator('#apply-shared-mix').click();
 await expect(page.locator('#stereo-width')).toHaveValue('25');
 await expect(page.locator('#status-text')).toHaveText('En pausa');
 await noOverflow(page);
 await page.screenshot({path:info.outputPath('stereo-width.png'),fullPage:true,animations:'disabled'});
});

test('stereo field renders identity, mono and intermediate widths with real Web Audio',async({page})=>{
 const html=await readFile(new URL('../../../index.html',import.meta.url),'utf8');
 const start=html.indexOf('      function stereoCoefficients('),end=html.indexOf('      async function initAudio()',start);
 const result=await page.evaluate(async source=>{
  const create=new Function(source+'return createStereoField;')();
  const Context=window.OfflineAudioContext||window.webkitOfflineAudioContext;
  const results=[];
  for(const [width,channels] of [[100,2],[50,2],[0,2],[100,1],[0,1]]) {
   const size=2048,ctx=new Context(2,size,44100),buffer=ctx.createBuffer(channels,size,44100);
   for(let i=0;i<size;i++){buffer.getChannelData(0)[i]=.2*Math.sin(i*.13);if(channels===2)buffer.getChannelData(1)[i]=.13*Math.cos(i*.07);}
   const node=ctx.createBufferSource();node.buffer=buffer;
   create(ctx,node,ctx.destination,width);node.start();
   const output=await ctx.startRendering(),direct=(1+width/100)/2,cross=(1-width/100)/2;
   let error=0,excess=0,channelDiff=0;
   for(let i=0;i<size;i++){
    const left=buffer.getChannelData(0)[i],right=channels===1?left:buffer.getChannelData(1)[i],a=output.getChannelData(0)[i],b=output.getChannelData(1)[i];
    error=Math.max(error,Math.abs(a-(left*direct+right*cross)),Math.abs(b-(right*direct+left*cross)));
    excess=Math.max(excess,Math.max(Math.abs(a),Math.abs(b))-Math.max(Math.abs(left),Math.abs(right)));
    channelDiff=Math.max(channelDiff,Math.abs(a-b));
   }
   results.push({width,channels,error,excess,channelDiff});
  }
  return results;
 },html.slice(start,end));
 for(const value of result){
  expect(value.error).toBeLessThan(0.000001);
  expect(value.excess).toBeLessThan(0.000001);
  if(value.width===0||value.channels===1)expect(value.channelDiff).toBeLessThan(0.000001);
 }
});


test('note timing changes future notes, cancels on mute and persists with mixtures',async({page},info)=>{
 await page.locator('#soundscape').selectOption('space');
 await expand(page,'sound-settings');
 await page.locator('#evolution').evaluate(el=>{el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.locator('#custom-minutes').fill('17');await page.locator('#apply-duration').click();
 await page.locator('#note-pace').selectOption('frequent');
 await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
 await page.locator('#toggle').click();
 await expect(page.locator('#status-text')).toHaveText('Sonando');
 const initial=await page.evaluate(()=>window.createdOscillators);
 const volume=await page.locator('#vol-notes').inputValue();
 await page.clock.fastForward(5999);
 expect(await page.evaluate(()=>window.createdOscillators)).toBe(initial);
 await page.clock.fastForward(2);
 expect(await page.evaluate(()=>window.createdOscillators)).toBe(initial+2);
 await page.locator('#note-pace').selectOption('sparse');
 expect(await page.evaluate(()=>window.createdOscillators)).toBe(initial+2);
 await page.clock.fastForward(15999);
 expect(await page.evaluate(()=>window.createdOscillators)).toBe(initial+2);
 await page.clock.fastForward(2);
 expect(await page.evaluate(()=>window.createdOscillators)).toBe(initial+4);
 await page.locator('#note-pace').selectOption('normal');
 await page.clock.fastForward(7999);
 expect(await page.evaluate(()=>window.createdOscillators)).toBe(initial+4);
 await page.clock.fastForward(2);
 expect(await page.evaluate(()=>window.createdOscillators)).toBe(initial+6);
 await page.locator('#melody').uncheck();
 await expect(page.locator('#note-pace')).toBeDisabled();
 await page.clock.fastForward(20000);
 expect(await page.evaluate(()=>window.createdOscillators)).toBe(initial+6);
 await page.locator('#melody').check();
 expect(await page.evaluate(()=>window.createdOscillators)).toBe(initial+6);
 await page.clock.fastForward(8001);
 expect(await page.evaluate(()=>window.createdOscillators)).toBe(initial+8);
 await expect(page.locator('#vol-notes')).toHaveValue(volume);
 await expect(page.locator('#timer')).toHaveText('00:16:02');
 await expect(page.locator('#status-text')).toHaveText('Sonando');
 await page.locator('#toggle').click();
 await page.locator('#note-pace').selectOption('sparse');
 await expand(page,'mix-settings');
 await page.locator('#preset-name').fill('Notas espaciadas');await page.locator('#save-mix').click();
 await page.locator('#create-share-link').click();
 const link=await page.locator('#share-link').inputValue();
 expect(JSON.parse(decodeURIComponent(new URL(link).hash.slice(5))).notePace).toBe('sparse');
 await expand(page,'backup-panel');
 const promise=page.waitForEvent('download');await page.locator('#export-backup').click();const download=await promise;
 const backup=JSON.parse(await readFile(await download.path(),'utf8'));
 expect(backup.data.studio.notePace).toBe('sparse');expect(backup.data.mixes[0].notePace).toBe('sparse');
 await page.locator('#note-pace').selectOption('frequent');
 await page.locator('#saved-mixes').selectOption('0');await page.locator('#load-mix').click();
 await expect(page.locator('#note-pace')).toHaveValue('sparse');
 await page.reload();await expand(page,'sound-settings');
 await expect(page.locator('#note-pace')).toHaveValue('sparse');
 await expect(page.locator('#status-text')).toHaveText('En pausa');
 delete backup.data.studio.notePace;backup.data.mixes.forEach(mix=>delete mix.notePace);
 await expand(page,'backup-panel');
 await page.locator('#backup-file').setInputFiles({name:'old-pace.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
 await page.locator('#backup-settings').check();
 await Promise.all([page.waitForEvent('load'),page.locator('#import-backup').click()]);
 await expand(page,'sound-settings');
 await expect(page.locator('#note-pace')).toHaveValue('normal');
 await page.goto(link);
 await expect(page.locator('#shared-mix-summary')).toContainText('Notas: más espaciadas');
 await page.locator('#apply-shared-mix').click();
 await expect(page.locator('#note-pace')).toHaveValue('sparse');
 await expect(page.locator('#status-text')).toHaveText('En pausa');
 await noOverflow(page);
 await page.screenshot({path:info.outputPath('note-pace.png'),fullPage:true,animations:'disabled'});
});


test('fade session closing starts at the chosen time and survives portable settings',async({page},info)=>{
 await expand(page,'sound-settings');
 await expect(page.locator('#fade-out')).toHaveValue('20');await expect(page.locator('#fade-out')).toBeDisabled();
 await page.locator('#custom-minutes').fill('3');await page.locator('#apply-duration').click();
 await page.locator('#fade-out').selectOption('60');
 await expect(page.locator('#fade-out-hint')).toContainText('60 segundos');
 const volume=await page.locator('#vol-master').inputValue();
 await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
 await page.locator('#toggle').click();await expect(page.locator('#status-text')).toHaveText('Sonando');
 await expect(page.locator('#fade-out')).toBeDisabled();
 await page.locator('#fade-out').evaluate(el=>{el.value='5';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await expect(page.locator('#fade-out')).toHaveValue('60');
 await page.clock.fastForward(61000);
 await expect(page.locator('#session-phase')).toHaveText('Concentración sostenida');
 await page.clock.fastForward(60000);
 await expect(page.locator('#session-phase')).toHaveText('Cierre gradual');
 await expect(page.locator('#vol-master')).toHaveValue(volume);
 await page.clock.fastForward(60000);
 await expect(page.locator('#status-text')).toHaveText('En pausa');
 await expect(page.locator('#timer')).toHaveText('00:00:00');
 await expect(page.locator('#session-feedback')).toBeVisible();
 await expect(page.locator('#fade-out')).toBeEnabled();
 await page.locator('#custom-minutes').fill('1');await page.locator('#apply-duration').click();
 await expect(page.locator('#fade-out-hint')).toContainText('30 segundos');
 await page.locator('#toggle').click();await expect(page.locator('#status-text')).toHaveText('Sonando');
 await page.clock.fastForward(29000);
 await expect(page.locator('#session-phase')).toHaveText('Concentración sostenida');
 await page.clock.fastForward(2000);
 await expect(page.locator('#session-phase')).toHaveText('Cierre gradual');
 await page.locator('#toggle').click();
 await expand(page,'mix-settings');
 await page.locator('#preset-name').fill('Cierre tranquilo');await page.locator('#save-mix').click();
 await page.locator('#create-share-link').click();
 const link=await page.locator('#share-link').inputValue();
 expect(JSON.parse(decodeURIComponent(new URL(link).hash.slice(5))).fadeOutSeconds).toBe(60);
 await expand(page,'backup-panel');
 const promise=page.waitForEvent('download');await page.locator('#export-backup').click();const download=await promise;
 const backup=JSON.parse(await readFile(await download.path(),'utf8'));
 expect(backup.data.studio.fadeOutSeconds).toBe(60);expect(backup.data.mixes[0].fadeOutSeconds).toBe(60);
 await page.locator('#fade-out').selectOption('5');
 await page.locator('#saved-mixes').selectOption('0');await page.locator('#load-mix').click();
 await expect(page.locator('#fade-out')).toHaveValue('60');
 await page.reload();await expand(page,'sound-settings');
 await expect(page.locator('#fade-out')).toHaveValue('60');await expect(page.locator('#status-text')).toHaveText('En pausa');
 delete backup.data.studio.fadeOutSeconds;backup.data.mixes.forEach(mix=>delete mix.fadeOutSeconds);
 await expand(page,'backup-panel');
 await page.locator('#backup-file').setInputFiles({name:'old-fade.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
 await page.locator('#backup-settings').check();
 await Promise.all([page.waitForEvent('load'),page.locator('#import-backup').click()]);
 await expand(page,'sound-settings');await expect(page.locator('#fade-out')).toHaveValue('20');
 await page.goto(link);await expect(page.locator('#shared-mix-summary')).toContainText('Cierre: 60 s');
 await page.locator('#apply-shared-mix').click();await expect(page.locator('#fade-out')).toHaveValue('60');
 await expect(page.locator('#status-text')).toHaveText('En pausa');
 await page.locator('[data-minutes="0"]').click();await expect(page.locator('#fade-out')).toBeDisabled();
 await page.locator('#session-plan').selectOption('25-5');await expect(page.locator('#fade-out')).toBeEnabled();
 await expect(page.locator('#fade-out')).toHaveValue('60');
 await noOverflow(page);
 await page.screenshot({path:info.outputPath('session-closing.png'),fullPage:true,animations:'disabled'});
});


test('keep mix preserves levels and melody across scenes and portable settings',async({page},info)=>{
 await expand(page,'sound-settings');
 await expect(page.locator('#preserve-mix')).not.toBeChecked();
 await page.locator('#custom-minutes').fill('17');await page.locator('#apply-duration').click();
 for(const [key,value] of [['master','27'],['noise','55'],['drone','14'],['notes','9']]){
  await page.locator('#vol-'+key).evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));},value);
 }
 await page.locator('#melody').uncheck();await page.locator('#preserve-mix').check();
 const levels=await page.evaluate(()=>['master','noise','drone','notes'].map(key=>document.getElementById('vol-'+key).value));
 await page.locator('#toggle').click();await expect(page.locator('#status-text')).toHaveText('Sonando');
 await page.clock.fastForward(61000);await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
 const timer=await page.locator('#timer').textContent();
 for(const scene of ['ocean','space','speech','rain']){
  await page.locator('#soundscape').selectOption(scene);
  expect(await page.evaluate(()=>['master','noise','drone','notes'].map(key=>document.getElementById('vol-'+key).value))).toEqual(levels);
  await expect(page.locator('#melody')).not.toBeChecked();
  await expect(page.locator('#timer')).toHaveText(timer);
  await expect(page.locator('#status-text')).toHaveText('Sonando');
 }
 await page.locator('#melody').check();await page.locator('#soundscape').selectOption('speech');
 await expect(page.locator('#melody')).toBeChecked();
 expect(await page.evaluate(()=>['master','noise','drone','notes'].map(key=>document.getElementById('vol-'+key).value))).toEqual(levels);
 await page.locator('#preserve-mix').uncheck();
 expect(await page.evaluate(()=>['master','noise','drone','notes'].map(key=>document.getElementById('vol-'+key).value))).toEqual(levels);
 await expect(page.locator('#melody')).toBeChecked();
 await page.locator('#soundscape').selectOption('space');
 await expect(page.locator('#vol-noise')).toHaveValue('30');await expect(page.locator('#vol-drone')).toHaveValue('65');await expect(page.locator('#vol-notes')).toHaveValue('48');
 await expect(page.locator('#vol-master')).toHaveValue('27');
 await page.locator('#soundscape').selectOption('speech');await expect(page.locator('#melody')).not.toBeChecked();
 await expect(page.locator('#vol-noise')).toHaveValue('82');await expect(page.locator('#vol-drone')).toHaveValue('0');await expect(page.locator('#vol-notes')).toHaveValue('0');
 await expect(page.locator('#timer')).toHaveText(timer);
 await page.locator('#toggle').click();
 await page.locator('#preserve-mix').check();
 await expand(page,'mix-settings');await page.locator('#preset-name').fill('Mis niveles');await page.locator('#save-mix').click();
 await page.locator('#create-share-link').click();
 const link=await page.locator('#share-link').inputValue();
 expect(JSON.parse(decodeURIComponent(new URL(link).hash.slice(5))).preserveMix).toBe(true);
 await expand(page,'backup-panel');
 const promise=page.waitForEvent('download');await page.locator('#export-backup').click();const download=await promise;
 const backup=JSON.parse(await readFile(await download.path(),'utf8'));
 expect(backup.data.studio.preserveMix).toBe(true);expect(backup.data.mixes[0].preserveMix).toBe(true);
 await page.locator('#preserve-mix').uncheck();
 await page.locator('#saved-mixes').selectOption('0');await page.locator('#load-mix').click();await expect(page.locator('#preserve-mix')).toBeChecked();
 await page.reload();await expand(page,'sound-settings');
 await expect(page.locator('#preserve-mix')).toBeChecked();await expect(page.locator('#status-text')).toHaveText('En pausa');
 delete backup.data.studio.preserveMix;backup.data.mixes.forEach(mix=>delete mix.preserveMix);
 await expand(page,'backup-panel');
 await page.locator('#backup-file').setInputFiles({name:'old-scene-levels.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
 await page.locator('#backup-settings').check();
 await Promise.all([page.waitForEvent('load'),page.locator('#import-backup').click()]);
 await expand(page,'sound-settings');await expect(page.locator('#preserve-mix')).not.toBeChecked();
 await page.goto(link);await expect(page.locator('#shared-mix-summary')).toContainText('Conserva volúmenes y melodía');
 await page.locator('#apply-shared-mix').click();await expect(page.locator('#preserve-mix')).toBeChecked();
 await expect(page.locator('#status-text')).toHaveText('En pausa');
 await noOverflow(page);
 await page.screenshot({path:info.outputPath('preserve-mix.png'),fullPage:true,animations:'disabled'});
});


async function attachRestMeter(page){
 await page.evaluate(()=>{
  const ctx=window.restContext,source=ctx.createMediaStreamSource(window.restStream),analyser=ctx.createAnalyser(),mute=ctx.createGain();
  analyser.fftSize=256;mute.gain.value=0;source.connect(analyser);analyser.connect(mute);mute.connect(ctx.destination);
  const data=new Float32Array(256);
  window.readRestPeak=()=>{analyser.getFloatTimeDomainData(data);return data.reduce((max,value)=>Math.max(max,Math.abs(value)),0);};
 });
}
test('silent rest mutes output, excludes listening time and resumes focus explicitly',async({page},info)=>{
 await page.locator('#session-plan').selectOption('25-5');await page.locator('#rest-sound').selectOption('silent');
 await expand(page,'mix-settings');await page.locator('#preset-name').fill('Descanso tranquilo');await page.locator('#save-mix').click();
 await page.locator('#create-share-link').click();const link=await page.locator('#share-link').inputValue();
 expect(JSON.parse(decodeURIComponent(new URL(link).hash.slice(5))).restSound).toBe('silent');
 const levels=await page.evaluate(()=>['master','noise','drone','notes'].map(key=>document.getElementById('vol-'+key).value));
 await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
 await page.locator('#toggle').click();await expect(page.locator('#status-text')).toHaveText('Sonando');
 await attachRestMeter(page);
 await expect.poll(()=>page.evaluate(()=>window.readRestPeak())).toBeGreaterThan(.00001);
 await expect(page.locator('#rest-sound')).toBeDisabled();
 await page.clock.fastForward(25*60000+1000);
 await expect(page.locator('#play-label')).toHaveText('Descansar');
 await page.locator('#toggle').click();await expect(page.locator('#status-text')).toHaveText('Descanso en silencio');
 await expect(page.locator('#session-phase')).toHaveText('Descanso en silencio');
 await expect.poll(()=>page.evaluate(()=>window.readRestPeak())).toBeLessThan(.000001);
 const history=await page.evaluate(()=>localStorage.getItem('focus-daily-history-v1')),oscillators=await page.evaluate(()=>window.restOscillators);
 await page.clock.fastForward(61000);
 expect(await page.evaluate(()=>localStorage.getItem('focus-daily-history-v1'))).toBe(history);
 expect(await page.evaluate(()=>window.restOscillators)).toBe(oscillators);
 expect(await page.evaluate(()=>['master','noise','drone','notes'].map(key=>document.getElementById('vol-'+key).value))).toEqual(levels);
 await expect(page.locator('#session-feedback')).toBeHidden();
 await page.locator('#toggle').click();
 await expand(page,'backup-panel');
 const promise=page.waitForEvent('download');await page.locator('#export-backup').click();const download=await promise;
 const backup=JSON.parse(await readFile(await download.path(),'utf8'));
 expect(backup.data.studio.restSound).toBe('silent');expect(backup.data.mixes[0].restSound).toBe('silent');expect(backup.data.session.cycle.phase).toBe('rest');
 await page.locator('#rest-sound').selectOption('sound');
 await expand(page,'mix-settings');await page.locator('#saved-mixes').selectOption('0');await page.locator('#load-mix').click();
 await expect(page.locator('#rest-sound')).toHaveValue('silent');
 await page.locator('#backup-file').setInputFiles({name:'silent-rest.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
 await page.locator('#backup-settings').check();
 await Promise.all([page.waitForEvent('load'),page.locator('#import-backup').click()]);
 await expect(page.locator('#cycle-status')).toContainText('Descanso en silencio');
 await expect(page.locator('#rest-sound')).toHaveValue('silent');
 await expect(page.locator('#status-text')).toHaveText('En pausa');
 await expect(page.locator('#mobile-scene')).toHaveText('Descanso en silencio');
 await page.locator('#focus-view-toggle').click();await expect(page.locator('#focus-view-scene')).toHaveText('Descanso en silencio');
 await page.locator('#focus-view-toggle').click();
 await page.locator('#toggle').click();await expect(page.locator('#status-text')).toHaveText('Descanso en silencio');
 await attachRestMeter(page);await expect.poll(()=>page.evaluate(()=>window.readRestPeak())).toBeLessThan(.000001);
 await page.clock.fastForward(241000);
 await expect(page.locator('#play-label')).toHaveText('Siguiente');
 expect(await page.evaluate(()=>localStorage.getItem('focus-daily-history-v1'))).toBe(history);
 await expect(page.locator('#session-feedback')).toBeHidden();
 await page.locator('#toggle').click();await expect(page.locator('#status-text')).toHaveText('Sonando');
 await expect(page.locator('#cycle-status')).toContainText('Ronda 2 de 4');
 await expect.poll(()=>page.evaluate(()=>window.readRestPeak())).toBeGreaterThan(.00001);
 await page.clock.fastForward(61000);
 expect(await page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('focus-daily-history-v1'))).reduce((a,b)=>a+b,0))).toBeGreaterThan(Object.values(JSON.parse(history)).reduce((a,b)=>a+b,0)+.5);
 await page.locator('#toggle').click();
 const old=JSON.parse(JSON.stringify(backup));delete old.data.studio.restSound;old.data.mixes.forEach(mix=>delete mix.restSound);
 await expand(page,'backup-panel');await page.locator('#backup-file').setInputFiles({name:'old-rest.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(old))});
 await page.locator('#backup-settings').check();
 await Promise.all([page.waitForEvent('load'),page.locator('#import-backup').click()]);
 await expect(page.locator('#rest-sound')).toHaveValue('sound');
 await page.goto(link);await expect(page.locator('#shared-mix-summary')).toContainText('Descansos: en silencio');
 await page.locator('#apply-shared-mix').click();await expect(page.locator('#rest-sound')).toHaveValue('silent');
 await expect(page.locator('#status-text')).toHaveText('En pausa');
 await noOverflow(page);
 await page.screenshot({path:info.outputPath('silent-rest.png'),fullPage:true,animations:'disabled'});
});

test('fire scene plays, switches, saves and shares on mobile and desktop',async({page},info)=>{
 await page.locator('#soundscape').selectOption('fire');
 await expect(page.locator('#scene-description')).toContainText('crepitaciones');
 await expand(page,'sound-settings');await expect(page.locator('#melody')).not.toBeChecked();
 await expect(page.locator('#vol-drone')).toHaveValue('0');await expect(page.locator('#vol-notes')).toHaveValue('0');
 await page.locator('#toggle').click();await expect(page.locator('#status-text')).toHaveText('Sonando');
 await expect(page.locator('#error-message')).toBeHidden();
 await page.locator('#soundscape').selectOption('rain');await expect(page.locator('#status-text')).toHaveText('Sonando');
 await page.locator('#soundscape').selectOption('fire');await expect(page.locator('#status-text')).toHaveText('Sonando');
 await page.locator('#toggle').click();
 await expand(page,'mix-settings');await page.locator('#preset-name').fill('Mi fogón');await page.locator('#save-mix').click();
 await page.locator('#favorite-mix').click();await page.locator('#create-share-link').click();
 const link=await page.locator('#share-link').inputValue();
 expect(JSON.parse(decodeURIComponent(new URL(link).hash.slice(5))).scene).toBe('fire');
 await page.reload();await page.locator('#favorite-mixes button').click();
 await expect(page.locator('#soundscape')).toHaveValue('fire');await expect(page.locator('#status-text')).toHaveText('En pausa');
 await expand(page,'backup-panel');const promise=page.waitForEvent('download');await page.locator('#export-backup').click();
 const backup=JSON.parse(await readFile(await (await promise).path(),'utf8'));
 expect(backup.data.studio.scene).toBe('fire');expect(backup.data.mixes[0].scene).toBe('fire');
 await page.locator('#backup-file').setInputFiles({name:'fire.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
 await expect(page.locator('#backup-preview')).toBeVisible();await page.locator('#cancel-backup').click();
 await page.goto(link);await expect(page.locator('#shared-mix-summary')).toContainText('Fogón suave');
 await page.locator('#apply-shared-mix').click();await expect(page.locator('#soundscape')).toHaveValue('fire');
 await expect(page.locator('#status-text')).toHaveText('En pausa');await noOverflow(page);
 await page.screenshot({path:info.outputPath('fire.png'),fullPage:true,animations:'disabled'});
});

test('wind scene produces audio, follows ambient volume and survives portable settings',async({page},info)=>{
 await page.locator('#soundscape').selectOption('wind');
 await expect(page.locator('#scene-description')).toContainText('ráfagas');
 await expand(page,'sound-settings');await expect(page.locator('#melody')).not.toBeChecked();
 await expect(page.locator('#vol-noise')).toHaveValue('70');await expect(page.locator('#vol-drone')).toHaveValue('0');
 await page.locator('#toggle').click();await expect(page.locator('#status-text')).toHaveText('Sonando');
 await attachRestMeter(page);
 await expect.poll(()=>page.evaluate(()=>window.readRestPeak())).toBeGreaterThan(.00001);
 await page.locator('#vol-noise').evaluate(el=>{el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await expect.poll(()=>page.evaluate(()=>window.readRestPeak())).toBeLessThan(.000001);
 await page.locator('#vol-noise').evaluate(el=>{el.value='70';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await expect.poll(()=>page.evaluate(()=>window.readRestPeak())).toBeGreaterThan(.00001);
 await page.locator('#evolution').evaluate(el=>{el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.locator('#soundscape').selectOption('fire');await expect(page.locator('#status-text')).toHaveText('Sonando');
 await page.locator('#soundscape').selectOption('wind');await expect(page.locator('#status-text')).toHaveText('Sonando');
 await page.locator('#toggle').click();
 await expand(page,'mix-settings');await page.locator('#preset-name').fill('Mi brisa');await page.locator('#save-mix').click();
 await page.locator('#favorite-mix').click();await page.locator('#create-share-link').click();
 const link=await page.locator('#share-link').inputValue();
 expect(JSON.parse(decodeURIComponent(new URL(link).hash.slice(5))).scene).toBe('wind');
 await page.reload();await page.locator('#favorite-mixes button').click();
 await expect(page.locator('#soundscape')).toHaveValue('wind');await expect(page.locator('#status-text')).toHaveText('En pausa');
 await expand(page,'sound-settings');await expect(page.locator('#evolution')).toHaveValue('0');
 await expand(page,'backup-panel');const promise=page.waitForEvent('download');await page.locator('#export-backup').click();
 const backup=JSON.parse(await readFile(await (await promise).path(),'utf8'));
 expect(backup.data.studio.scene).toBe('wind');expect(backup.data.mixes[0].scene).toBe('wind');
 await page.locator('#backup-file').setInputFiles({name:'wind.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
 await expect(page.locator('#backup-preview')).toBeVisible();await page.locator('#cancel-backup').click();
 await page.goto(link);await expect(page.locator('#shared-mix-summary')).toContainText('Viento entre hojas');
 await page.locator('#apply-shared-mix').click();await expect(page.locator('#soundscape')).toHaveValue('wind');
 await expect(page.locator('#status-text')).toHaveText('En pausa');await noOverflow(page);
 await page.screenshot({path:info.outputPath('wind.png'),fullPage:true,animations:'disabled'});
});

test('wind gusts render continuously in the audio graph without screen timers',async({page})=>{
 const html=await readFile(new URL('../../../index.html',import.meta.url),'utf8');
 const start=html.indexOf('      function windCoefficients('),end=html.indexOf('      function applyScene(',start);
 const results=await page.evaluate(async source=>{
  const create=new Function(source+'return createWindGust;')(),Context=window.OfflineAudioContext||window.webkitOfflineAudioContext;
  const results=[];
  for(const evolution of [0,100]) {
   const rate=44100,size=46*rate,ctx=new Context(1,size,rate),buffer=ctx.createBuffer(1,size,rate);
   buffer.getChannelData(0).fill(.25);const input=ctx.createBufferSource();input.buffer=buffer;
   const gust=create(ctx,input,ctx.destination,evolution);gust.start();input.start();
   const output=(await ctx.startRendering()).getChannelData(0);
   const samples=[1,9,18,30,45].map(second=>({actual:output[second*rate],expected:.25*(.52+(evolution/100)*(.18*Math.sin(second/9)+.12*Math.sin(second/23)))}));
   let min=Infinity,max=-Infinity;for(const value of output){min=Math.min(min,value);max=Math.max(max,value);}
   results.push({evolution,samples,min,max});
  }
  return results;
 },html.slice(start,end));
 for(const result of results) {
  for(const sample of result.samples)expect(Math.abs(sample.actual-sample.expected)).toBeLessThan(.0002);
  expect(result.min).toBeGreaterThanOrEqual(.25*.22-.0002);expect(result.max).toBeLessThanOrEqual(.25*.82+.0002);
  if(result.evolution===0)expect(result.max-result.min).toBeLessThan(.00001);
  else expect(result.max-result.min).toBeGreaterThan(.04);
 }
});

test('audio deadline closes output with screen timers stopped and reconciles history on return',async({page})=>{
 await page.addInitScript(()=>{
  const date=new Date(),key=date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
  localStorage.setItem('focus-daily-history-v1',JSON.stringify({[key]:.1}));
  localStorage.setItem('focus-session-v1',JSON.stringify({duration:1,elapsed:58000}));
  localStorage.setItem('focus-studio-v3',JSON.stringify({scene:'wind',evolution:35,brightness:50,melody:false,fadeOutSeconds:5}));
  localStorage.setItem('focus-audio-settings-v2',JSON.stringify({master:75,noise:70,drone:0,notes:0}));
 });
 await page.reload();await expect(page.locator('#timer')).toHaveText('00:00:02');
 await page.locator('#toggle').click();await expect(page.locator('#status-text')).toHaveText('Sonando');
 await attachRestMeter(page);await expect.poll(()=>page.evaluate(()=>window.readRestPeak())).toBeGreaterThan(.00001);
 await expect.poll(()=>page.evaluate(()=>window.readRestPeak())).toBeLessThan(.000001);
 await expect(page.locator('#status-text')).toHaveText('Sonando');
 await expect(page.locator('#timer')).toHaveText('00:00:02');
 await page.evaluate(()=>{
  const now=Date.now;Date.now=()=>now()+5*60000;
  Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));
 });
 await expect(page.locator('#status-text')).toHaveText('En pausa');await expect(page.locator('#timer')).toHaveText('00:00:00');
 await expect(page.locator('#session-feedback')).toBeVisible();
 const result=await page.evaluate(()=>({session:JSON.parse(localStorage.getItem('focus-session-v1')),history:JSON.parse(localStorage.getItem('focus-daily-history-v1'))}));
 expect(result.session.elapsed).toBe(60000);
 expect(Object.values(result.history).reduce((a,b)=>a+b,0)).toBe(.1); // The two new seconds round down to the stored tenth of a minute.
});
test('audio closing renders the selected fade and stays silent after the deadline without timers',async({page})=>{
 const html=await readFile(new URL('../../../index.html',import.meta.url),'utf8');
 const start=html.indexOf('      function sessionEnvelope('),end=html.indexOf('      function syncFadeUI()',start);
 const results=await page.evaluate(async source=>{
  const schedule=new Function(source+'return scheduleSessionClosing;')(),Context=window.OfflineAudioContext||window.webkitOfflineAudioContext;
  const results=[];
  for(const [duration,elapsed,fade,silent] of [[1,0,5,false],[1,0,60,false],[1,58000,5,false],[0,0,20,false],[1,61000,20,false],[5,0,20,true]]) {
   const rate=44100,size=62*rate,ctx=new Context(1,size,rate),buffer=ctx.createBuffer(1,size,rate);buffer.getChannelData(0).fill(.25);
   const input=ctx.createBufferSource();input.buffer=buffer;const gain=ctx.createGain();input.connect(gain);gain.connect(ctx.destination);
   schedule(ctx,gain.gain,elapsed,duration,fade,silent);input.start();
   const output=(await ctx.startRendering()).getChannelData(0),effective=Math.min(fade,duration*30);
   const samples=[0,1,3,30,45,55,57,60,61].map(second=>{
    const remaining=duration*60-elapsed/1000-second;
    const expected=silent?0:duration?Math.min(1,Math.max(0,remaining/effective)):1;
    return {actual:output[second*rate],expected:expected*.25};
   });
   results.push(samples);
  }
  return results;
 },html.slice(start,end));
 for(const samples of results)for(const sample of samples)expect(Math.abs(sample.actual-sample.expected)).toBeLessThan(.00001);
});

test('audio deadline reset replaces the old cutoff while preserving playback',async({page})=>{
 await page.addInitScript(()=>{
  localStorage.setItem('focus-session-v1',JSON.stringify({duration:1,elapsed:58000}));
  localStorage.setItem('focus-studio-v3',JSON.stringify({scene:'wind',evolution:35,brightness:50,melody:false,fadeOutSeconds:5}));
  localStorage.setItem('focus-audio-settings-v2',JSON.stringify({master:75,noise:70,drone:0,notes:0}));
 });
 await page.reload();await page.locator('#toggle').click();await expect(page.locator('#status-text')).toHaveText('Sonando');
 await attachRestMeter(page);await page.locator('#reset-timer').click();await expect(page.locator('#timer')).toHaveText('00:01:00');
 await page.waitForTimeout(2300);
 await expect.poll(()=>page.evaluate(()=>window.readRestPeak())).toBeGreaterThan(.00001);
 await page.locator('[data-minutes="0"]').click();await expect(page.locator('#status-text')).toHaveText('Sonando');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('focus-session-v1')).duration)).toBe(0);
 await expect.poll(()=>page.evaluate(()=>window.readRestPeak())).toBeGreaterThan(.00001);
 await page.locator('#toggle').click();await expect(page.locator('#status-text')).toHaveText('En pausa');
});

test('channel balance persists in settings, mixes, shared links and old backups',async({page},info)=>{
 await page.locator('#soundscape').selectOption('wind');await expand(page,'sound-settings');
 await expect(page.locator('#channel-balance')).toHaveValue('0');await expect(page.locator('#channel-balance-value')).toHaveText('Centro');
 await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
 await page.locator('#toggle').click();await expect(page.locator('#status-text')).toHaveText('Sonando');
 await page.clock.fastForward(10000);
 const timer=await page.locator('#timer').textContent(),oscillators=await page.evaluate(()=>window.createdOscillators);
 const levels=await page.evaluate(()=>['master','noise','drone','notes'].map(key=>document.getElementById('vol-'+key).value));
 await page.locator('#channel-balance').evaluate(el=>{el.value='-40';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await expect(page.locator('#channel-balance-value')).toHaveText('40% izquierda');
 await expect(page.locator('#channel-balance')).toHaveAttribute('aria-valuetext','40% izquierda');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('focus-studio-v3')).balance)).toBe(-40);
 expect(await page.evaluate(()=>window.createdOscillators)).toBe(oscillators);
 await expect(page.locator('#timer')).toHaveText(timer);
 expect(await page.evaluate(()=>['master','noise','drone','notes'].map(key=>document.getElementById('vol-'+key).value))).toEqual(levels);
 await page.locator('#center-balance').click();await expect(page.locator('#channel-balance')).toHaveValue('0');
 await expect(page.locator('#channel-balance-value')).toHaveText('Centro');
 await page.locator('#channel-balance').evaluate(el=>{el.value='-40';el.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.locator('#toggle').click();
 await expand(page,'mix-settings');await page.locator('#preset-name').fill('Mi balance');await page.locator('#save-mix').click();
 await page.locator('#create-share-link').click();const link=await page.locator('#share-link').inputValue();
 expect(JSON.parse(decodeURIComponent(new URL(link).hash.slice(5))).balance).toBe(-40);
 await page.reload();await expand(page,'sound-settings');await expect(page.locator('#channel-balance')).toHaveValue('-40');
 await expect(page.locator('#status-text')).toHaveText('En pausa');
 await page.locator('#center-balance').click();
 await expand(page,'mix-settings');await page.locator('#saved-mixes').selectOption('0');await page.locator('#load-mix').click();
 await expect(page.locator('#channel-balance')).toHaveValue('-40');
 await expand(page,'backup-panel');const promise=page.waitForEvent('download');await page.locator('#export-backup').click();
 const backup=JSON.parse(await readFile(await (await promise).path(),'utf8'));
 expect(backup.data.studio.balance).toBe(-40);expect(backup.data.mixes[0].balance).toBe(-40);
 delete backup.data.studio.balance;backup.data.mixes.forEach(mix=>delete mix.balance);
 await page.locator('#backup-file').setInputFiles({name:'old-balance.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
 await page.locator('#backup-settings').check();await Promise.all([page.waitForEvent('load'),page.locator('#import-backup').click()]);
 await expand(page,'sound-settings');await expect(page.locator('#channel-balance')).toHaveValue('0');
 const old=new URL(link),payload=JSON.parse(decodeURIComponent(old.hash.slice(5)));delete payload.balance;old.hash='mix='+encodeURIComponent(JSON.stringify(payload));
 await page.goto(old.toString());await expect(page.locator('#shared-mix-summary')).toContainText('Balance: Centro');
 await page.locator('#apply-shared-mix').click();await expand(page,'sound-settings');await expect(page.locator('#channel-balance')).toHaveValue('0');
 await page.goto(link);await expect(page.locator('#shared-mix-summary')).toContainText('Balance: 40% izquierda');
 await page.locator('#apply-shared-mix').click();await expand(page,'sound-settings');
 await expect(page.locator('#channel-balance')).toHaveValue('-40');await expect(page.locator('#status-text')).toHaveText('En pausa');
 await noOverflow(page);await page.screenshot({path:info.outputPath('balance.png'),fullPage:true,animations:'disabled'});
});
test('channel balance renders each channel after stereo width with real Web Audio',async({page})=>{
 const html=await readFile(new URL('../../../index.html',import.meta.url),'utf8');
 const start=html.indexOf('      function stereoCoefficients('),end=html.indexOf('      async function initAudio()',start);
 const results=await page.evaluate(async source=>{
  const tools=new Function(source+'return {createStereoField,createChannelBalance};')(),Context=window.OfflineAudioContext||window.webkitOfflineAudioContext;
  const results=[];
  for(const channels of [1,2])for(const width of [0,100])for(const balance of [-100,-50,0,50,100]) {
   const size=2048,ctx=new Context(2,size,44100),buffer=ctx.createBuffer(channels,size,44100);
   for(let i=0;i<size;i++){buffer.getChannelData(0)[i]=.2*Math.sin(i*.13);if(channels===2)buffer.getChannelData(1)[i]=.13*Math.cos(i*.07);}
   const input=ctx.createBufferSource();input.buffer=buffer;const between=ctx.createGain();
   tools.createStereoField(ctx,input,between,width);tools.createChannelBalance(ctx,between,ctx.destination,balance);input.start();
   const output=await ctx.startRendering(),direct=(1+width/100)/2,cross=(1-width/100)/2,leftGain=Math.min(1,1-balance/100),rightGain=Math.min(1,1+balance/100);
   let error=0,excess=0;
   for(let i=0;i<size;i++){
    const left=buffer.getChannelData(0)[i],right=channels===1?left:buffer.getChannelData(1)[i],a=output.getChannelData(0)[i],b=output.getChannelData(1)[i];
    error=Math.max(error,Math.abs(a-(left*direct+right*cross)*leftGain),Math.abs(b-(right*direct+left*cross)*rightGain));
    excess=Math.max(excess,Math.abs(a)-Math.max(Math.abs(left),Math.abs(right)),Math.abs(b)-Math.max(Math.abs(left),Math.abs(right)));
   }
   results.push({error,excess});
  }
  return results;
 },html.slice(start,end));
 for(const value of results){expect(value.error).toBeLessThan(.000001);expect(value.excess).toBeLessThan(.000001);}
});
