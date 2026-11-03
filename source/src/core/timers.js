/** Timers that pause with the page and cleanly cancel on game disposal. */
export class TimerBag {
  constructor(){this.tasks=new Set();this.paused=false;}
  setTimeout(fn,delay){
    const t={fn,remaining:delay,started:0,id:null}; this.tasks.add(t); if(!this.paused)this._arm(t); return t;
  }
  _arm(t){t.started=performance.now();t.id=setTimeout(()=>{t.id=null;this.tasks.delete(t);t.fn();},Math.max(0,t.remaining));}
  clearTimeout(t){if(!t)return;clearTimeout(t.id);this.tasks.delete(t);}
  pause(){if(this.paused)return;this.paused=true;for(const t of this.tasks){if(t.id!==null){clearTimeout(t.id);t.id=null;t.remaining=Math.max(0,t.remaining-(performance.now()-t.started));}}}
  resume(){if(!this.paused)return;this.paused=false;for(const t of this.tasks)this._arm(t);}
  clearAll(){for(const t of this.tasks)clearTimeout(t.id);this.tasks.clear();}
}
