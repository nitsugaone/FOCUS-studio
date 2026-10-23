import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

const errors=new WeakMap();
test.beforeEach(async({page},info)=>{
 if(info.title.startsWith('guided cycles')||info.title.startsWith('focus view')||info.title.startsWith('custom duration'))await page.clock.install();
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
 await expect(page.locator('#cycle-status')).toContainText('Descanso');
 await expect(page.locator('#timer')).toHaveText('00:05:00');
 await expect(page.locator('#session-feedback')).toBeHidden();
 await page.clock.fastForward(5*60000+1000);
 await expect(page.locator('#play-label')).toHaveText('Siguiente');
 await expect(page.locator('#session-feedback')).toBeHidden();
 await page.locator('#toggle').click();
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
