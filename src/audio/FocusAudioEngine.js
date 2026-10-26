import {SCENES} from './scenes.js';
import {entryEnvelope,scheduleSessionEntry,sessionEnvelope,scheduleSessionClosing,windCoefficients,createWindGust,createStereoBrownBuffer,createWarmReverbImpulse,createCrackleBuffer,stereoCoefficients,createStereoField,balanceCoefficients,createChannelBalance,noteDelaySeconds} from './dsp.js';

// All audio resources and automation belong to this engine. No DOM or storage.
export class FocusAudioEngine {
 constructor({platform=globalThis,clearTimeout:cancelTimer=globalThis.clearTimeout}={}) {
      const SCALE = [164.81, 220.00, 261.63, 293.66, 329.63, 392.00, 440.00];
      const TRIM = { master: 0.9, noise: 0.42, drone: 0.34, notes: 0.28 };
      let ctx=null,nodes={},playing=false,noteTimer=null,suspendTimer=null,lastNote=-1,noteStep=0;
      let studio={},levels={},accumulatedMs=0,targetDurationMinutes=0,silent=false;
      const clearTimeout=cancelTimer;
      const isSilentRest=()=>silent;
      const level=id=>{const value=Number(levels[id])/100;return value*value*TRIM[id];};
      const ramp = (param, value, timeConstant = 0.06) => {
        if (!ctx || !param) return;
        param.cancelScheduledValues(ctx.currentTime);
        param.setTargetAtTime(value, ctx.currentTime, timeConstant);
      };

      function applyScene(smooth=1.5) {
        if (!ctx || !nodes.textureGain) return;
        nodes.stereoField?.setWidth(studio.stereoWidth);
        nodes.channelBalance?.setBalance(studio.balance);
        const scene=SCENES[studio.scene], evolution=studio.evolution/100;
        const drift=1+0.12*evolution*Math.sin(accumulatedMs/110000);
        ramp(nodes.lp.frequency,scene.cutoff*(0.65+studio.brightness/100)*drift,smooth);
        ramp(nodes.lfo.frequency,scene.rate,smooth);
        ramp(nodes.lfoDepth.gain,scene.depth*evolution,smooth);
        ramp(nodes.textureFilter.frequency,scene.cutoff*(0.65+studio.brightness/100)*drift,smooth);
        ramp(nodes.textureGain.gain,scene.white,smooth);
        ramp(nodes.brownGain.gain,scene.brown??(1-scene.white),smooth);
        ramp(nodes.windGain.gain,scene.wind??0,smooth);
        nodes.windGust.setEvolution(studio.evolution);
        ramp(nodes.windLowpass.frequency,2600+studio.brightness*40,smooth);
        ramp(nodes.crackleGain.gain,scene.crackle??0,smooth);
        ramp(nodes.droneFilter.frequency,220+studio.brightness*6,smooth);
        ramp(nodes.droneLfoDepth.gain,110*evolution,smooth);
        const ratios=[1,2,3];
        nodes.droneOscs.forEach((osc,i)=>ramp(osc.frequency,scene.root*ratios[i]*(1+0.002*evolution*Math.sin(accumulatedMs/150000)),smooth));
      }
      function startBufferedNoise() {
        nodes.noiseSrc=ctx.createBufferSource();
        nodes.noiseSrc.buffer=createStereoBrownBuffer(ctx);
        nodes.noiseSrc.loop=true;
        const texture=ctx.createBuffer(2,ctx.sampleRate*19,ctx.sampleRate);
        for(let ch=0;ch<2;ch++) {
          const data=texture.getChannelData(ch);
          for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*0.38;
        }
        nodes.textureSrc=ctx.createBufferSource();
        nodes.textureSrc.buffer=texture;nodes.textureSrc.loop=true;
        nodes.noiseSrc.connect(nodes.brownGain);
        nodes.textureSrc.connect(nodes.textureFilter);
        nodes.textureSrc.connect(nodes.windHighpass);
        nodes.textureSrc.start();nodes.noiseSrc.start();
        nodes.crackleSrc=ctx.createBufferSource();
        nodes.crackleSrc.buffer=createCrackleBuffer(ctx);nodes.crackleSrc.loop=true;
        nodes.crackleSrc.connect(nodes.crackleFilter);nodes.crackleSrc.start();
      }

      async function startNoiseSources() {
        if(ctx.audioWorklet && platform.AudioWorkletNode) {
          try {
            await ctx.audioWorklet.addModule('./audio/noise-processor.js');
            const source=new platform.AudioWorkletNode(ctx,'focus-continuous-noise',{
              numberOfInputs:0,numberOfOutputs:3,outputChannelCount:[2,2,2]
            });
            source.connect(nodes.brownGain,0);
            source.connect(nodes.textureFilter,1);
            source.connect(nodes.crackleFilter,2);
            source.connect(nodes.windHighpass,1);
            nodes.noiseWorklet=source;
            source.addEventListener('processorerror',()=>{
              source.disconnect();
              nodes.noiseWorklet=null;
              if(ctx.state!=='closed')startBufferedNoise();
            },{once:true});
            return;
          } catch (_) {
            // Browsers without worklet support or with a blocked module keep audio.
          }
        }
        startBufferedNoise();
      }

      async function initAudio() {
        const AudioContextClass = platform.AudioContext || platform.webkitAudioContext;
        if (!AudioContextClass) throw new Error('Este navegador no admite Web Audio API.');

        ctx = new AudioContextClass({ latencyHint: 'playback' });
        if(ctx.state==='suspended')await ctx.resume();

        // Compresor / Limitador maestro
        nodes.comp = ctx.createDynamicsCompressor();
        nodes.comp.threshold.value = -18;
        nodes.comp.knee.value = 22;
        nodes.comp.ratio.value = 6;
        nodes.comp.attack.value = 0.012;
        nodes.comp.release.value = 0.35;

        nodes.fade = ctx.createGain();
        nodes.fade.gain.value = 0;
        nodes.master = ctx.createGain();
        nodes.master.gain.value = level('master');
        nodes.sessionGain = ctx.createGain();
        nodes.master.connect(nodes.sessionGain);
        nodes.closingGain=ctx.createGain();
        nodes.closingGain.gain.value=1;
        nodes.sessionGain.connect(nodes.closingGain);
        nodes.closingGain.connect(nodes.fade);
        nodes.balanceInput=ctx.createGain();
        nodes.stereoField=createStereoField(ctx,nodes.fade,nodes.balanceInput,studio.stereoWidth);
        nodes.channelBalance=createChannelBalance(ctx,nodes.balanceInput,nodes.comp,studio.balance);
        nodes.comp.connect(ctx.destination);

        // MediaStreamAudioDestinationNode para supervivencia del audio con pantalla apagada en móviles
        nodes.streamDest = ctx.createMediaStreamDestination();
        nodes.comp.connect(nodes.streamDest);

        // CAPA 1: Ruido marrón estéreo con doble modulación orgánica

        nodes.lp = ctx.createBiquadFilter();
        nodes.lp.type = 'lowpass';
        nodes.lp.frequency.value = 340;
        nodes.lp.Q.value = 0.65;

        nodes.lfo = ctx.createOscillator();
        nodes.lfo.type = 'sine';
        nodes.lfo.frequency.value = 0.065;
        nodes.lfoDepth = ctx.createGain();
        nodes.lfoDepth.gain.value = 185;
        nodes.lfo.connect(nodes.lfoDepth);
        nodes.lfoDepth.connect(nodes.lp.frequency);

        nodes.noiseGain = ctx.createGain();
        nodes.noiseGain.gain.value = level('noise');
        nodes.brownGain=ctx.createGain();
        nodes.textureGain=ctx.createGain();
        nodes.windGain=ctx.createGain();nodes.windGain.gain.value=0;
        nodes.windHighpass=ctx.createBiquadFilter();nodes.windHighpass.type='highpass';nodes.windHighpass.frequency.value=650;nodes.windHighpass.Q.value=0.5;
        nodes.windLowpass=ctx.createBiquadFilter();nodes.windLowpass.type='lowpass';nodes.windLowpass.Q.value=0.5;
        nodes.windHighpass.connect(nodes.windLowpass);
        nodes.windGust=createWindGust(ctx,nodes.windLowpass,nodes.windGain,studio.evolution);
        nodes.windGain.connect(nodes.noiseGain);
        nodes.crackleGain=ctx.createGain();
        nodes.crackleGain.gain.value=0;
        nodes.crackleFilter=ctx.createBiquadFilter();
        nodes.crackleFilter.type='lowpass';nodes.crackleFilter.frequency.value=3400;nodes.crackleFilter.Q.value=0.5;
        nodes.crackleFilter.connect(nodes.crackleGain);nodes.crackleGain.connect(nodes.noiseGain);
        nodes.textureFilter=ctx.createBiquadFilter();
        nodes.textureFilter.type='lowpass';
        nodes.textureFilter.Q.value=0.5;
        nodes.textureFilter.connect(nodes.textureGain);
        nodes.textureGain.connect(nodes.noiseGain);
        nodes.brownGain.connect(nodes.lp);
        nodes.lp.connect(nodes.noiseGain);
        nodes.noiseGain.connect(nodes.master);

        // CAPA 2: Drone armónico con apertura estéreo y filtro pasa-bajos cálido
        nodes.droneFilter = ctx.createBiquadFilter();
        nodes.droneFilter.type = 'lowpass';
        nodes.droneFilter.frequency.value = 420;
        nodes.droneFilter.Q.value = 0.5;

        nodes.droneLfo = ctx.createOscillator();
        nodes.droneLfo.type = 'sine';
        nodes.droneLfo.frequency.value = 0.04;
        nodes.droneLfoDepth = ctx.createGain();
        nodes.droneLfoDepth.gain.value = 110;
        nodes.droneLfo.connect(nodes.droneLfoDepth);
        nodes.droneLfoDepth.connect(nodes.droneFilter.frequency);

        nodes.droneGain = ctx.createGain();
        nodes.droneGain.gain.value = level('drone');
        nodes.droneFilter.connect(nodes.droneGain);
        nodes.droneGain.connect(nodes.master);

        const droneDefs = [
          { type: 'sine',     frequency: 55,  detune: 0,  amplitude: 0.32, pan: 0.0 },   // Sub-fundamental
          { type: 'sine',     frequency: 110, detune: -5, amplitude: 0.45, pan: -0.28 }, // Tónica izq
          { type: 'triangle', frequency: 165, detune: 5,  amplitude: 0.26, pan: 0.28 }   // Quinta der (filtrada)
        ];

        nodes.droneOscs = droneDefs.map((def) => {
          const osc = ctx.createOscillator();
          osc.type = def.type;
          osc.frequency.value = def.frequency;
          osc.detune.value = def.detune;
          const gain = ctx.createGain();
          gain.gain.value = def.amplitude;

          if (ctx.createStereoPanner) {
            const panner = ctx.createStereoPanner();
            panner.pan.value = def.pan;
            osc.connect(gain);
            gain.connect(panner);
            panner.connect(nodes.droneFilter);
          } else {
            osc.connect(gain);
            gain.connect(nodes.droneFilter);
          }
          return osc;
        });

        // CAPA 3: Notas pentatónicas con bus de reverberación paralela
        nodes.notesGain = ctx.createGain();
        nodes.notesGain.gain.value = level('notes');
        nodes.notesGain.connect(nodes.master);

        nodes.reverb = ctx.createConvolver();
        nodes.reverb.buffer = createWarmReverbImpulse(ctx);
        nodes.reverbWet = ctx.createGain();
        nodes.reverbWet.gain.value = 0.55;
        nodes.reverb.connect(nodes.reverbWet);
        nodes.reverbWet.connect(nodes.notesGain);

        await startNoiseSources();
        applyScene(0.05);
        nodes.lfo.start();
        nodes.droneLfo.start();
        nodes.droneOscs.forEach((osc) => osc.start());
        nodes.windGust.start();
      }

      function playNote() {
        if (!ctx || ctx.state !== 'running' || !nodes.notesGain || !studio.melody || isSilentRest()) return;
        let index;
        if(studio.evolution===0) {
          index=[0,2,4,2][noteStep++ % 4];
        } else if(lastNote<0) {
          index=0;
        } else {
          const leap=Math.random()<studio.evolution/250 ? 2 : 1;
          const direction=Math.random()<0.5 ? -1 : 1;
          index=lastNote+direction*leap;
          if(index<0 || index>=SCALE.length)index=lastNote-direction*leap;
        }
        lastNote=index;

        const start = ctx.currentTime;
        const attack = 0.85;
        const decay = 4.2;
        const end = start + attack + decay;

        const oscFund = ctx.createOscillator();
        const oscHarm = ctx.createOscillator();
        const harmGain = ctx.createGain();
        const envelope = ctx.createGain();

        const baseFreq = SCENES[studio.scene].root * [2, 2.378414, 2.66968, 3, 3.563595, 4, 4.756828][index];
        oscFund.type = 'sine';
        oscFund.frequency.value = baseFreq;
        oscFund.detune.value = (Math.random() - 0.5) * 6;

        // Armónico sutil de octava superior para timbre cristalino
        oscHarm.type = 'sine';
        oscHarm.frequency.value = baseFreq * 2;
        harmGain.gain.value = 0.12;

        envelope.gain.setValueAtTime(0.0001, start);
        envelope.gain.linearRampToValueAtTime(0.85, start + attack);
        envelope.gain.exponentialRampToValueAtTime(0.0001, end);

        oscFund.connect(envelope);
        oscHarm.connect(harmGain);
        harmGain.connect(envelope);

        let outputNode = envelope;
        if (ctx.createStereoPanner) {
          const panner = ctx.createStereoPanner();
          panner.pan.value = (Math.random() - 0.5) * 0.9; // Paneo suave entre -0.45 y +0.45
          envelope.connect(panner);
          outputNode = panner;
        }

        // Señal directa + envío a reverberación
        outputNode.connect(nodes.notesGain);
        if (nodes.reverb) outputNode.connect(nodes.reverb);

        oscFund.addEventListener('ended', () => {
          outputNode.disconnect();
          envelope.disconnect();
          harmGain.disconnect();
          oscFund.disconnect();
          oscHarm.disconnect();
        }, { once: true });

        oscFund.start(start);
        oscHarm.start(start);
        oscFund.stop(end + 0.1);
        oscHarm.stop(end + 0.1);
      }

      function scheduleNextNote() {
        clearTimeout(noteTimer);noteTimer=null;
        if (!playing || !studio.melody || isSilentRest()) return;
        const delay=noteDelaySeconds(SCENES[studio.scene].interval,studio.evolution,studio.notePace)*1000;
        noteTimer = platform.setTimeout(() => {
          if (!playing || !studio.melody || isSilentRest()) return;
          playNote();
          scheduleNextNote();
        }, delay);
      }
      this.configure=(settings,volumes,session={})=>{
        studio={...settings};levels={...volumes};
        accumulatedMs=session.elapsedMs??0;targetDurationMinutes=session.durationMinutes??0;silent=session.silent??false;
      };
      this.applyScene=applyScene;
      this.resetNotes=()=>{lastNote=-1;noteStep=0;};
      this.restartNotes=scheduleNextNote;
      this.stream=()=>nodes.streamDest?.stream;
      this.initialized=()=>ctx!==null;
      this.resume=async()=>{
        if(!ctx)await initAudio();
        clearTimeout(suspendTimer);
        if(ctx.state!=='running')await ctx.resume();
      };
      this.scheduleClosing=(smooth=false)=>{if(ctx)scheduleSessionClosing(ctx,nodes.closingGain.gain,accumulatedMs,targetDurationMinutes,studio.fadeOutSeconds,silent,smooth);};
      this.scheduleEntry=(smooth=false)=>{if(ctx)scheduleSessionEntry(ctx,nodes.sessionGain.gain,accumulatedMs,studio.fadeInSeconds,silent,smooth);};
      this.start=()=>{
        playing=true;this.scheduleClosing();this.scheduleEntry();
        ramp(nodes.fade.gain,1,0.65);playNote();scheduleNextNote();
      };
      this.pause=(slowFade=false)=>{
        playing=false;clearTimeout(noteTimer);noteTimer=null;
        ramp(nodes.fade&&nodes.fade.gain,0,slowFade?1.8:0.14);
        clearTimeout(suspendTimer);
        suspendTimer=platform.setTimeout(()=>{
          if(!playing&&ctx&&ctx.state==='running')ctx.suspend().catch(()=>{});
        },slowFade?4500:750);
      };
      this.updateLevel=(id,value)=>{
        levels[id]=value;
        const params={master:nodes.master,noise:nodes.noiseGain,drone:nodes.droneGain,notes:nodes.notesGain};
        if(params[id]&&ctx&&ctx.state!=='closed')ramp(params[id].gain,level(id),0.06);
      };
      this.close=()=>{
        playing=false;clearTimeout(noteTimer);clearTimeout(suspendTimer);
        if(ctx&&ctx.state!=='closed')return ctx.close().catch(()=>{});
      };
 }
}
