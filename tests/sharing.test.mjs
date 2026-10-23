import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const start=html.indexOf('      function createCycleTools()'),end=html.indexOf('      const cycleTools=createCycleTools()',start);
const tools=new Function(html.slice(start,end)+'return createShareTools();')();
const mix={scene:'ocean',evolution:42,brightness:30,melody:false,cyclePlan:'single',duration:17,levels:{master:28,noise:65,drone:25,notes:0},name:'Privado',history:{secret:1},ratings:['private'],elapsed:90000};
const encoded=tools.encode(mix),data=tools.decode(encoded);
assert.equal(data.duration,17);assert.equal(data.levels.master,28);assert.equal(data.scene,'ocean');
for(const key of ['name','history','ratings','elapsed'])assert.equal(Object.hasOwn(data,key),false);
assert.equal(encoded.includes('Privado'),false);
assert.deepEqual(tools.decode(tools.encode(data)),data);
for(const duration of [0,1,180])assert.equal(tools.decode(tools.encode({...mix,duration})).duration,duration);
for(const [cyclePlan,duration] of [['25-5',25],['50-10',50]])assert.equal(tools.decode(tools.encode({...mix,cyclePlan,duration})).cyclePlan,cyclePlan);
for(const extra of [{v:2},{scene:'__proto__'},{scene:'<script>'},{evolution:101},{brightness:-1},{melody:'true'},{cyclePlan:'__proto__'},{cyclePlan:'25-5',duration:17},{duration:181},{duration:1.5},{levels:{...mix.levels,master:Infinity}}]){
 assert.throws(()=>tools.normalize({...data,...extra}));
}
for(const hash of ['#mix=%','invalid','#mix=null','#mix='+encodeURIComponent('{}'),'#mix='+encodeURIComponent('{"v":2}'),'#mix='+'x'.repeat(4096)])assert.throws(()=>tools.decode(hash));
assert.throws(()=>tools.decode(null));
console.log('PASS: shared mix round-trip, privacy whitelist, duration bounds, cycle lengths and malformed links');

assert.equal(tools.decode(encoded).stereoWidth,100,'Older shared links default to original stereo');
assert.equal(tools.decode(tools.encode({...mix,stereoWidth:0})).stereoWidth,0);
assert.equal(tools.decode(tools.encode({...mix,stereoWidth:37})).stereoWidth,37);
for(const stereoWidth of [-1,101,'50',null,NaN])assert.throws(()=>tools.normalize({...data,stereoWidth}));
console.log('PASS: stereo width round-trip and backwards compatible shared links');

assert.equal(tools.decode(encoded).notePace,'normal');
for(const notePace of ['sparse','normal','frequent'])assert.equal(tools.decode(tools.encode({...mix,notePace})).notePace,notePace);
for(const notePace of ['unknown','__proto__',1,null])assert.throws(()=>tools.normalize({...data,notePace}));
console.log('PASS: note pace links and backwards compatible defaults');

assert.equal(tools.decode(encoded).fadeOutSeconds,20);
for(const fadeOutSeconds of [5,20,60])assert.equal(tools.decode(tools.encode({...mix,fadeOutSeconds})).fadeOutSeconds,fadeOutSeconds);
for(const fadeOutSeconds of [0,10,61,'20',null])assert.throws(()=>tools.normalize({...data,fadeOutSeconds}));
console.log('PASS: closing preferences in links and older data defaults');

assert.equal(tools.decode(encoded).preserveMix,false);
for(const preserveMix of [true,false])assert.equal(tools.decode(tools.encode({...mix,preserveMix})).preserveMix,preserveMix);
for(const preserveMix of [0,1,'true',null])assert.throws(()=>tools.normalize({...data,preserveMix}));
console.log('PASS: preserving scene levels in links and old data defaults');

assert.equal(tools.decode(encoded).restSound,'sound');
for(const restSound of ['sound','silent'])assert.equal(tools.decode(tools.encode({...mix,restSound})).restSound,restSound);
for(const restSound of ['unknown',true,1,null])assert.throws(()=>tools.normalize({...data,restSound}));
console.log('PASS: silent rest in links and old data defaults');

assert.equal(tools.decode(tools.encode({...mix,scene:'fire',melody:false})).scene,'fire');

assert.equal(tools.decode(tools.encode({...mix,scene:'wind',melody:false})).scene,'wind');

for(const balance of [-100,-35,0,45,100])assert.equal(tools.decode(tools.encode({...mix,balance})).balance,balance);
assert.equal(tools.decode(tools.encode(mix)).balance,0);
for(const balance of [-101,101,NaN,null,'35',.5])assert.throws(()=>tools.encode({...mix,balance}));
console.log('PASS: balance links, defaults for older links and invalid values');

for(const fadeInSeconds of [0,3,12,30])assert.equal(tools.decode(tools.encode({...mix,fadeInSeconds})).fadeInSeconds,fadeInSeconds);
assert.equal(tools.decode(tools.encode(mix)).fadeInSeconds,12);
for(const fadeInSeconds of [-1,5,60,null,'12'])assert.throws(()=>tools.encode({...mix,fadeInSeconds}));
console.log('PASS: entry choices, old link defaults and invalid values');
