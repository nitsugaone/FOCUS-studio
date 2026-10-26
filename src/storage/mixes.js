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

      function mixSearchIndices(mixes,query='') {
        if(!Array.isArray(mixes)||typeof query!=='string')return [];
        const fold=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es');
        const words=fold(query).trim().split(/\s+/).filter(Boolean);
        return mixes.reduce((indices,mix,index)=>{
          if(mix&&typeof mix.name==='string'){
            const text=fold(mix.name);
            if(words.every(word=>text.includes(word)))indices.push(index);
          }
          return indices;
        },[]);
      }

      function createMixCopy(mixes,index) {
        if(!Array.isArray(mixes)||!Number.isInteger(index)||index<0||index>=mixes.length)throw Error('Elegí una mezcla para duplicar.');
        if(mixes.length>=50)throw Error('Podés guardar hasta 50 mezclas.');
        const source=mixes[index];
        if(!source||typeof source.name!=='string'||!source.levels||typeof source.levels!=='object'||Array.isArray(source.levels))throw Error('La mezcla seleccionada no es válida.');
        const key=name=>name.trim().normalize('NFC').toLocaleLowerCase('es');
        const used=new Set(mixes.filter(mix=>mix&&typeof mix.name==='string').map(mix=>key(mix.name)));
        const base=source.name.trim()||'Mezcla';
        for(let number=1;number<=50;number++){
          const suffix=number===1?' (copia)':' (copia '+number+')';
          let stem='';
          for(const char of base){if(stem.length+char.length>60-suffix.length)break;stem+=char;}
          const name=stem.trimEnd()+suffix;
          if(!used.has(key(name)))return {...source,name,favorite:false,levels:{...source.levels}};
        }
        throw Error('No se pudo elegir un nombre para la copia.');
      }
export {validStudio,mixSearchIndices,createMixCopy};
