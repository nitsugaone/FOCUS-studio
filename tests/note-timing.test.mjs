import {noteDelaySeconds as delay} from '../src/audio/dsp.js';
import assert from 'node:assert/strict';

for(const interval of [8,12,18,25]){
 assert.equal(delay(interval,0,'normal',0),interval);
 assert.equal(delay(interval,0,'sparse',0),interval*2);
 assert.equal(delay(interval,0,'frequent',0),interval*.75);
 assert.equal(delay(interval,100,'sparse',1),interval*4);
 for(const evolution of [0,35,100])for(const random of [0,.5,1]){
  const expected=interval*(1+random*evolution/100);
  assert.equal(delay(interval,evolution,'normal',random),expected,'Default reproduces the prior interval');
  assert.ok(delay(interval,evolution,'sparse',random)>delay(interval,evolution,'normal',random));
  assert.ok(delay(interval,evolution,'frequent',random)>=6,'Fastest supported scene leaves time for the 5.05-second note envelope');
 }
}
for(const args of [[0,0,'normal',0],[8,-1,'normal',0],[8,101,'normal',0],[8,0,'__proto__',0],[8,0,'normal',-1],[8,0,'normal',1.1],[8,0,null,0]])assert.throws(()=>delay(...args));
console.log('PASS: note timing, original default, evolution bounds, minimum envelope spacing and invalid inputs');
