// Wall-clock time is independent of rendering, storage and audio nodes.
export class SessionClock {
 constructor({now=()=>Date.now(),setInterval=globalThis.setInterval,clearInterval=globalThis.clearInterval}={}) {
  this.now=()=>now();this.setInterval=(...args)=>setInterval(...args);this.clearInterval=(...args)=>clearInterval(...args);
  this.elapsedMs=0;this.lastTimestamp=0;this.durationMinutes=0;this.timer=null;
 }
 advance(active=true) {
  if(!active||this.lastTimestamp<=0)return;
  const now=this.now();
  this.elapsedMs+=Math.max(0,now-this.lastTimestamp);
  if(this.durationMinutes>0)this.elapsedMs=Math.min(this.elapsedMs,this.durationMinutes*60000);
  this.lastTimestamp=now;
 }
 start(onTick) {
  this.clearInterval(this.timer);
  this.lastTimestamp=this.now();
  this.timer=this.setInterval(onTick,500);
 }
 stop(active=true) {
  this.advance(active);this.lastTimestamp=0;
  this.clearInterval(this.timer);this.timer=null;
 }
}
