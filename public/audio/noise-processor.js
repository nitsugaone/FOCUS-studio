// Generates continuous stereo noise in the audio rendering thread.
// No allocations, buffers or timers in process().
class FocusNoiseProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const seed=(options?.processorOptions?.seed ?? (Math.random()*0xffffffff))>>>0;
    this.states=new Uint32Array([seed||0x12345678,(seed^0x9e3779b9)>>>0||0x87654321]);
    this.brown=new Float64Array(2);
    this.pole=Math.exp(-2*Math.PI*180/sampleRate);
  }
  process(inputs,outputs) {
    const brown=outputs[0],white=outputs[1];
    if(!brown||!white)return true;
    for(let ch=0;ch<2;ch++) {
      const b=brown[ch],w=white[ch];
      if(!b||!w)continue;
      let state=this.states[ch],last=this.brown[ch];
      for(let i=0;i<b.length;i++) {
        state^=state<<13;state^=state>>>17;state^=state<<5;
        const value=(state>>>0)/2147483648-1;
        last=this.pole*last+(1-this.pole)*value;
        b[i]=Math.tanh(last*3)*0.82;
        w[i]=value*0.38;
      }
      this.states[ch]=state>>>0;this.brown[ch]=last;
    }
    return true;
  }
}
registerProcessor('focus-continuous-noise',FocusNoiseProcessor);
