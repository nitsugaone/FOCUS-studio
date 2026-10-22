import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

const errors=new WeakMap();
test.beforeEach(async({page})=>{
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
