/** Original arcade sounds, with one shared AudioContext for both game modes. */
export function createAudioManager(){
  let ac=null,master=null;
  function init(){
    if (!ac){ const AC=window.AudioContext||window.webkitAudioContext; if(!AC)return;
      ac=new AC();master=ac.createGain();master.gain.value=.5;master.connect(ac.destination);
    }
    if(ac.state==='suspended')ac.resume().catch(()=>{});
  }
  function tone(f,dur,{type='square',vol=.16,at=0,to=null,attack=.005}={}){
    if(!ac||ac.state==='closed')return;
    const t=ac.currentTime+at,o=ac.createOscillator(),g=ac.createGain();o.type=type;
    o.frequency.setValueAtTime(f,t);if(to)o.frequency.exponentialRampToValueAtTime(to,t+dur);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+Math.min(attack,dur/2));
    g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(g);g.connect(master);o.start(t);o.stop(t+dur+.02);
  }
  function noise(dur,{vol=.15,at=0,hp=1500}={}){
    if(!ac||ac.state==='closed')return;
    const t=ac.currentTime+at,n=Math.floor(ac.sampleRate*dur),buf=ac.createBuffer(1,n,ac.sampleRate),d=buf.getChannelData(0);
    for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n);
    const s=ac.createBufferSource(),f=ac.createBiquadFilter(),g=ac.createGain();
    f.type='highpass';f.frequency.value=hp;g.gain.value=vol;s.buffer=buf;s.connect(f);f.connect(g);g.connect(master);s.start(t);
  }
  const pose={
    ready(){[523,659,784].forEach((f,i)=>tone(f,.08,{at:i*.06,vol:.12}));},
    beep(){tone(440,.18,{vol:.2});},
    go(){[523,659,784,1046].forEach((f,i)=>tone(f,.14,{at:i*.05}));noise(.2,{vol:.1});},
    pose(){tone(659,.1,{vol:.14});tone(988,.18,{at:.1,vol:.14});},
    tick(){tone(900,.05,{type:'triangle',vol:.1});},tickHot(){tone(1400,.07,{vol:.14});},
    near(){tone(1200,.03,{type:'triangle',vol:.05});},
    clear(){[784,988,1175,1568].forEach((f,i)=>tone(f,.12,{at:i*.07,vol:.15}));noise(.35,{at:.25,vol:.1,hp:3000});},
    fail(){tone(330,.25,{type:'sawtooth',vol:.15,to:220});tone(220,.4,{type:'sawtooth',vol:.15,at:.22,to:110});},
    win(){[[523,0],[659,.12],[784,.24],[1046,.36],[784,.52],[1046,.64]].forEach(([f,a])=>tone(f,.16,{at:a,vol:.14}));tone(1318,.7,{at:.8,vol:.12,type:'triangle'});noise(.5,{at:.8,vol:.1,hp:3000});},
    lose(){[392,370,349,330].forEach((f,i)=>tone(f,.35,{type:'sawtooth',vol:.13,at:i*.32,to:i===3?220:null}));},
  };
  const pump={
    six(){tone(392,.09,{to:784,vol:.16});},seven(){tone(523,.09,{to:1046,vol:.16,type:'square'});},
    small(){tone(150,.07,{type:'triangle',vol:.12});},
    level(){tone(180,.12,{type:'sawtooth',vol:.12});tone(140,.14,{type:'sawtooth',vol:.1,at:.1});},
    clear(){[523,659,784,1046,1318,1568].forEach((f,i)=>tone(f,.12,{at:i*.07,vol:.15}));tone(2093,.7,{at:.45,vol:.12,type:'triangle'});noise(.5,{at:.4,vol:.12,hp:3000});},
    ready(){[523,659,784].forEach((f,i)=>tone(f,.08,{at:i*.06,vol:.12}));},beep(){tone(440,.18,{vol:.2});},
    go(){[523,659,784,1046].forEach((f,i)=>tone(f,.14,{at:i*.05,vol:.15}));tone(1046,.45,{at:.2,vol:.14,type:'sawtooth'});noise(.25,{vol:.12});},
    tick(){tone(1200,.04,{vol:.1,type:'triangle'});},
    combo(n){const base=523*Math.pow(2,Math.min(n,60)/60);[1,1.25,1.5,2].forEach((m,i)=>tone(base*m,.07,{at:i*.045,vol:.11}));},
    end(){tone(220,.5,{type:'sawtooth',vol:.18,to:110});noise(.4,{vol:.15,hp:400});},
    fanfare(){[[523,0],[659,.12],[784,.24],[1046,.36],[784,.52],[1046,.64]].forEach(([f,a])=>tone(f,.16,{at:a,vol:.14}));tone(1318,.6,{at:.8,vol:.12,type:'triangle'});}
  };
  return {init,pose,pump};
}
