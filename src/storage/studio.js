import {SCENES} from '../audio/scenes.js';
      function validStudio(value) {
        return value && SCENES[value.scene] && Number.isFinite(value.evolution) && value.evolution >= 0 && value.evolution <= 100
          && Number.isFinite(value.brightness) && value.brightness >= 0 && value.brightness <= 100 && typeof value.melody === 'boolean'
          && (value.stereoWidth===undefined||(Number.isFinite(value.stereoWidth)&&value.stereoWidth>=0&&value.stereoWidth<=100))
          && (value.balance===undefined||(Number.isInteger(value.balance)&&value.balance>=-100&&value.balance<=100))
          && (value.notePace===undefined||['sparse','normal','frequent'].includes(value.notePace))
          && (value.fadeInSeconds===undefined||[0,3,12,30].includes(value.fadeInSeconds))
          && (value.fadeOutSeconds===undefined||[5,20,60].includes(value.fadeOutSeconds))
          && (value.preserveMix===undefined||typeof value.preserveMix==='boolean')
          && (value.restSound===undefined||['sound','silent'].includes(value.restSound));
      }

// Project existing studio fields with the same defaults for legacy settings/mixes.
function studioSettings(value) {
  return {scene:value.scene,evolution:value.evolution,brightness:value.brightness,melody:value.melody,stereoWidth:value.stereoWidth??100,balance:value.balance??0,notePace:value.notePace??'normal',fadeOutSeconds:value.fadeOutSeconds??20,fadeInSeconds:value.fadeInSeconds??12,preserveMix:value.preserveMix??false,restSound:value.restSound??'sound'};
}
export {validStudio,studioSettings};
