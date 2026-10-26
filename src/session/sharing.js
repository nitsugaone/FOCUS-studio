import {createCycleTools} from './cycles.js';
      function createShareTools() {
        const cycles=createCycleTools(),scenes=['rain','ocean','space','speech','fire','wind'];
        const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
        const number=value=>Number.isFinite(value)&&value>=0&&value<=100;
        function normalize(value) {
          if(!object(value)||value.v!==1||!scenes.includes(value.scene)||!number(value.evolution)||!number(value.brightness)||typeof value.melody!=='boolean'||(value.stereoWidth!==undefined&&!number(value.stereoWidth))||(value.balance!==undefined&&(!Number.isInteger(value.balance)||value.balance<-100||value.balance>100))||!(value.notePace===undefined||['sparse','normal','frequent'].includes(value.notePace))||!(value.fadeInSeconds===undefined||[0,3,12,30].includes(value.fadeInSeconds))||!(value.fadeOutSeconds===undefined||[5,20,60].includes(value.fadeOutSeconds))||!(value.preserveMix===undefined||typeof value.preserveMix==='boolean')||!(value.restSound===undefined||['sound','silent'].includes(value.restSound))||!Object.prototype.hasOwnProperty.call(cycles.plans,value.cyclePlan)||!object(value.levels)||!['master','noise','drone','notes'].every(key=>number(value.levels[key])))throw Error('Enlace de mezcla inválido.');
          if(value.cyclePlan==='single'?!cycles.validDuration(value.duration):cycles.plans[value.cyclePlan].focus!==value.duration)throw Error('Duración de mezcla inválida.');
          return {v:1,scene:value.scene,evolution:value.evolution,brightness:value.brightness,melody:value.melody,stereoWidth:value.stereoWidth??100,balance:value.balance??0,notePace:value.notePace??'normal',fadeOutSeconds:value.fadeOutSeconds??20,fadeInSeconds:value.fadeInSeconds??12,preserveMix:value.preserveMix??false,restSound:value.restSound??'sound',cyclePlan:value.cyclePlan,duration:value.duration,
            levels:Object.fromEntries(['master','noise','drone','notes'].map(key=>[key,value.levels[key]]))};
        }
        function encode(mix) {return '#mix='+encodeURIComponent(JSON.stringify(normalize({...mix,v:1})));}
        function decode(hash) {
          if(typeof hash!=='string'||!hash.startsWith('#mix=')||hash.length>4096)throw Error('Enlace de mezcla inválido.');
          return normalize(JSON.parse(decodeURIComponent(hash.slice(5))));
        }
        return {normalize,encode,decode};
      }
export {createShareTools};
