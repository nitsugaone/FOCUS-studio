import {readApplicationSource,extractFunctions} from './support/application-source.mjs';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const html=await readApplicationSource();
const silent=new Function(extractFunctions(html,['isSilentRestState'])+'return isSilentRestState;')();
for(const plan of ['25-5','50-10']){
 assert.equal(silent({plan,phase:'rest'},'silent'),true);
 assert.equal(silent({plan,phase:'focus'},'silent'),false);
 assert.equal(silent({plan,phase:'rest'},'sound'),false);
}
assert.equal(silent({plan:'single',phase:'rest'},'silent'),false);
assert.equal(silent(null,'silent'),false);
const run=new Function(`
 let quiet=true,sessionRecordedMs=0,additions=[];const clock={elapsedMs:61500};
 function isSilentRest(){return quiet;}
 function addFocusSecondsToToday(value){additions.push(value);}
 function renderHistoryChart(){}
 ${extractFunctions(html,['syncFocusHistoryProgress'])}
 syncFocusHistoryProgress(true);
 const silentRecorded=sessionRecordedMs;
 quiet=false;clock.elapsedMs=122500;syncFocusHistoryProgress(true);
 quiet=true;clock.elapsedMs=123000;syncFocusHistoryProgress(true);
 return {silentRecorded,sessionRecordedMs,additions};
`);
assert.deepEqual(run(),{silentRecorded:61500,sessionRecordedMs:123000,additions:[61]});
console.log('PASS: silent rest classification and history exclusion without retroactive listening');
