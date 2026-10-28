      function entryEnvelope(elapsedMs,seconds=12) {
        if(!Number.isFinite(elapsedMs)||elapsedMs<0||![0,3,12,30].includes(seconds))throw Error('Entrada de sesión inválida.');
        return seconds===0?1:Math.min(1,0.4+elapsedMs/(seconds/0.6*1000));
      }

      function scheduleSessionEntry(context,param,elapsedMs,seconds=12,silent=false,smooth=false) {
        const value=entryEnvelope(elapsedMs,seconds),now=context.currentTime;
        const remaining=Math.max(0,seconds-elapsedMs/1000);
        const transition=smooth&&!silent?Math.min(0.06,remaining||0.06):0;
        const initial=transition?param.value:(silent?0:value);
        param.cancelScheduledValues(now);
        param.setValueAtTime(initial,now);
        if(transition)param.linearRampToValueAtTime(entryEnvelope(elapsedMs+transition*1000,seconds),now+transition);
        if(!silent&&remaining>transition)param.linearRampToValueAtTime(1,now+remaining);
      }

      function sessionEnvelope(elapsedMs,durationMinutes,fadeOutSeconds=20) {
        if(!Number.isFinite(elapsedMs)||elapsedMs<0||!Number.isInteger(durationMinutes)||durationMinutes<0||durationMinutes>180||![5,20,60].includes(fadeOutSeconds))throw Error('Cierre de sesión inválido.');
        const entry=Math.min(1,0.4+elapsedMs/20000);
        const effectiveFade=durationMinutes?Math.min(fadeOutSeconds,durationMinutes*30):0;
        const exit=durationMinutes?Math.min(1,Math.max(0,(durationMinutes*60000-elapsedMs)/(effectiveFade*1000))):1;
        return {entry,exit,effectiveFade};
      }

      function scheduleSessionClosing(context,param,elapsedMs,durationMinutes,fadeOutSeconds=20,silent=false,smooth=false) {
        const {exit,effectiveFade}=sessionEnvelope(elapsedMs,durationMinutes,fadeOutSeconds);
        const now=context.currentTime;
        const remaining=durationMinutes?Math.max(0,durationMinutes*60-elapsedMs/1000):0;
        const initial=smooth&&!silent&&(!durationMinutes||remaining-effectiveFade>0.06)?param.value:null;
        param.cancelScheduledValues(now);
        param.setValueAtTime(initial??(silent?0:exit),now);
        if(initial!==null)param.linearRampToValueAtTime(exit,now+0.06);
        if(!silent&&durationMinutes&&remaining>0) {
          if(remaining>effectiveFade)param.setValueAtTime(1,now+remaining-effectiveFade);
          param.linearRampToValueAtTime(0,now+remaining);
        }
      }

      function windCoefficients(evolution) {
        if(!Number.isFinite(evolution)||evolution<0||evolution>100)throw Error('Ráfagas inválidas.');
        return {base:0.52,slow:0.18*evolution/100,slower:0.12*evolution/100};
      }

      function createWindGust(context,input,output,evolution=35) {
        const envelope=context.createGain();envelope.gain.value=0.52;
        const oscillators=[context.createOscillator(),context.createOscillator()];
        const depths=[context.createGain(),context.createGain()];
        input.connect(envelope);envelope.connect(output);
        oscillators.forEach((osc,index)=>{
          osc.type='sine';osc.frequency.value=1/(2*Math.PI*(index===0?9:23));
          osc.connect(depths[index]);depths[index].connect(envelope.gain);
        });
        let current=null;
        function setEvolution(value) {
          const coefficients=windCoefficients(value);if(value===current)return;
          const first=current===null;current=value;
          depths.forEach((node,index)=>{
            const target=index===0?coefficients.slow:coefficients.slower;
            if(first)node.gain.value=target;
            else {node.gain.cancelScheduledValues(context.currentTime);node.gain.setTargetAtTime(target,context.currentTime,0.5);}
          });
        }
        setEvolution(evolution);
        return {envelope,oscillators,depths,setEvolution,start(){oscillators.forEach(osc=>osc.start());}};
      }

      function createStereoBrownBuffer(audioContext, seconds = 16) {
        const length = Math.floor(audioContext.sampleRate * seconds);
        const crossfade = Math.min(Math.floor(audioContext.sampleRate * 1.5), Math.floor(length / 4));
        const buffer = audioContext.createBuffer(2, length, audioContext.sampleRate);

        for (let ch = 0; ch < 2; ch++) {
          const raw = new Float32Array(length + crossfade);
          let last = 0;
          for (let i = 0; i < raw.length; i++) {
            const white = Math.random() * 2 - 1;
            last = (last + 0.024 * white) / 1.024;
            raw[i] = last;
          }

          const data = buffer.getChannelData(ch);
          let peak = 0;
          for (let i = 0; i < length; i++) {
            if (i < crossfade) {
              const t = (i / crossfade) * Math.PI / 2;
              data[i] = raw[i] * Math.sin(t) + raw[length + i] * Math.cos(t);
            } else {
              data[i] = raw[i];
            }
            peak = Math.max(peak, Math.abs(data[i]));
          }
          const normalization = peak > 0 ? 0.82 / peak : 1;
          for (let i = 0; i < length; i++) data[i] *= normalization;
        }
        return buffer;
      }

      function createWarmReverbImpulse(audioContext, duration = 3.2, decay = 2.6) {
        const length = Math.floor(audioContext.sampleRate * duration);
        const impulse = audioContext.createBuffer(2, length, audioContext.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
          const data = impulse.getChannelData(ch);
          let lp = 0;
          for (let i = 0; i < length; i++) {
            const env = Math.pow(1 - i / length, decay);
            const white = (Math.random() * 2 - 1) * env;
            // Suavizado pasa-bajos para evitar cola metálica
            lp = lp + 0.18 * (white - lp);
            data[i] = lp * 0.7;
          }
        }
        return impulse;
      }

      function createCrackleBuffer(context) {
        const buffer=context.createBuffer(2,context.sampleRate*19,context.sampleRate);
        const decay=Math.exp(-1/(context.sampleRate*0.006)),edge=context.sampleRate*0.02;
        for(let ch=0;ch<2;ch++) {
          const data=buffer.getChannelData(ch);let envelope=0;
          for(let i=0;i<data.length;i++) {
            if(Math.random()<8/context.sampleRate)envelope=Math.min(1,envelope+0.3+Math.random()*0.7);
            envelope*=decay;
            data[i]=(Math.random()*2-1)*envelope*0.45*Math.min(1,i/edge,(data.length-1-i)/edge);
          }
        }
        return buffer;
      }

      function stereoCoefficients(value) {
        if(!Number.isFinite(value)||value<0||value>100)throw Error('Amplitud estéreo inválida.');
        const width=value/100;
        return {direct:(1+width)/2,cross:(1-width)/2};
      }

      function createStereoField(context,input,output,width=100) {
        const stereo=context.createGain();
        stereo.channelCount=2;stereo.channelCountMode='explicit';stereo.channelInterpretation='speakers';
        const splitter=context.createChannelSplitter(2),merger=context.createChannelMerger(2);
        const directL=context.createGain(),directR=context.createGain(),crossL=context.createGain(),crossR=context.createGain();
        input.connect(stereo);stereo.connect(splitter);
        splitter.connect(directL,0);splitter.connect(crossL,0);
        splitter.connect(directR,1);splitter.connect(crossR,1);
        directL.connect(merger,0,0);crossR.connect(merger,0,0);
        directR.connect(merger,0,1);crossL.connect(merger,0,1);
        merger.connect(output);
        let currentWidth=null;
        function setWidth(value,smooth=0.08) {
          const coefficients=stereoCoefficients(value);
          if(value===currentWidth)return;
          currentWidth=value;
          [[directL,coefficients.direct],[directR,coefficients.direct],[crossL,coefficients.cross],[crossR,coefficients.cross]].forEach(([node,target])=>{
            if(smooth>0){node.gain.cancelScheduledValues(context.currentTime);node.gain.setTargetAtTime(target,context.currentTime,smooth);}
            else node.gain.value=target;
          });
        }
        setWidth(width,0);
        return {setWidth};
      }

      function balanceCoefficients(value) {
        if(!Number.isInteger(value)||value<-100||value>100)throw Error('Balance inválido.');
        return {left:Math.min(1,1-value/100),right:Math.min(1,1+value/100)};
      }

      function balanceLabel(value=0) {
        return value===0?'Centro':Math.abs(value)+'% '+(value<0?'izquierda':'derecha');
      }

      function createChannelBalance(context,input,output,value=0) {
        const stereo=context.createGain();
        stereo.channelCount=2;stereo.channelCountMode='explicit';stereo.channelInterpretation='speakers';
        const splitter=context.createChannelSplitter(2),merger=context.createChannelMerger(2);
        const left=context.createGain(),right=context.createGain();
        input.connect(stereo);stereo.connect(splitter);
        splitter.connect(left,0);splitter.connect(right,1);
        left.connect(merger,0,0);right.connect(merger,0,1);merger.connect(output);
        let current=null;
        function setBalance(next,smooth=0.08) {
          const coefficients=balanceCoefficients(next);
          if(next===current)return;current=next;
          [[left,coefficients.left],[right,coefficients.right]].forEach(([node,target])=>{
            if(smooth>0){node.gain.cancelScheduledValues(context.currentTime);node.gain.setTargetAtTime(target,context.currentTime,smooth);}
            else node.gain.value=target;
          });
        }
        setBalance(value,0);return {setBalance};
      }

      function noteDelaySeconds(interval,evolution,pace='normal',random=Math.random()) {
        const factors={sparse:2,normal:1,frequent:.75};
        if(!Number.isFinite(interval)||interval<=0||!Number.isFinite(evolution)||evolution<0||evolution>100||!Object.prototype.hasOwnProperty.call(factors,pace)||!Number.isFinite(random)||random<0||random>1)throw Error('Ritmo de notas inválido.');
        return interval*factors[pace]*(1+random*evolution/100);
      }
export {entryEnvelope,scheduleSessionEntry,sessionEnvelope,scheduleSessionClosing,windCoefficients,createWindGust,createStereoBrownBuffer,createWarmReverbImpulse,createCrackleBuffer,stereoCoefficients,createStereoField,balanceCoefficients,balanceLabel,createChannelBalance,noteDelaySeconds};
