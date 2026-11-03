import {OFFSET_K, makeHand, updateHand} from './hand-tracker.js';
export function createPumpGame(api){
const GAME_MS = 20000;
const GOAL = 200;
const $ = id => api.root.querySelector('#' + id);
const video=api.camera.video,fx=api.view.canvas,ctx=api.view.ctx;
const COL6 = '#FF5A36', COL7 = '#FFD23F', OK = '#3DFFB0';

const audioInit=api.audio.init;
const sfx=api.audio.pump;

/* ---------- Shared camera / canvas ---------- */
let W=0,H=0,DPR=1;
function resize(){api.view.resize();W=api.view.W;H=api.view.H;DPR=api.view.DPR;}
api.listen(window, 'resize',resize);resize();
const toScreen=p=>api.view.toScreen(p);

let hands = { 6: makeHand(), 7: makeHand() };

/* ---------- Game state ---------- */
let state = 'intro';
let S = 120;               // shoulder width in px (smoothed)
let lastPose = null;
let calibHold = 0;
let g = null;              // current round
let pops = [];             // floating numbers + rings
let best = 0;
try { best = +localStorage.getItem('sixseven-best') || 0; } catch {}

const snap = document.createElement('canvas'); snap.width = 480; snap.height = 640;
const snapCtx = snap.getContext('2d');

function newRound(){
  hands = { 6: makeHand(), 7: makeHand() };
  return { start:0, score:0, c6:0, c7:0, combo:0, bestCombo:0, lastStroke:0, strokes:[], peak:0, lastSnap:0, snapRate:-1, lastTick:-1, lastSmall:0, lastLevel:0, level:0, cleared:false, pausedAt:0 };
}

function show(id, on){ $(id).hidden = !on; }

function setState(s){
  state = s;
  show('intro', s === 'intro'); show('loading', s === 'loading');
  show('calib', s === 'calib'); show('hud', s === 'play');
  show('result', s === 'result'); show('count', s === 'countdown' || s === 'ending');
}

/* ---------- Strokes ---------- */
function stroke(d, len){
  if (state !== 'play') return;
  const now = performance.now();
  const h = hands[d];
  g.score++; d == 6 ? g.c6++ : g.c7++;
  g.combo = (now - g.lastStroke < 650) ? g.combo + 1 : 1;
  g.lastStroke = now;
  g.bestCombo = Math.max(g.bestCombo, g.combo);
  g.strokes.push(now);
  const big = len > S * .8;
  pops.push({ kind:'num', d, x:h.x, y:h.y, t:now, big, rot:(Math.random()-.5)*.5, vx:(d==6?-1:1)*(20+Math.random()*40) });
  pops.push({ kind:'ring', d, x:h.x, y:h.y, t:now });
  d == 6 ? sfx.six() : sfx.seven();
  if (g.combo >= 10 && g.combo % 10 === 0){
    sfx.combo(g.combo);
    pops.push({ kind:'text', x:W/2, y:H*.42, t:now, text:'COMBO ×'+g.combo, color:OK });
  }
  if (g.score === GOAL && !g.cleared){
    g.cleared = true;
    sfx.clear();
    const f = $('flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
    pops.push({ kind:'text', x:W/2, y:H*.5, t:now, text:'200! THỬ THÁCH HOÀN THÀNH', color:COL7, hero:true });
  }
  const sc = $('score'); sc.textContent = g.score;
  sc.classList.remove('bump'); void sc.offsetWidth; sc.classList.add('bump');
  $('c6').textContent = g.c6; $('c7').textContent = g.c7;
}
function smallMove(d){
  if (state !== 'play') return;
  const now = performance.now();
  if (now - g.lastSmall < 1400) return;
  g.lastSmall = now;
  sfx.small();
  pops.push({ kind:'text', x:hands[d].x, y:hands[d].y - 50, t:now, text:'TO HƠN!', color:'#A49CC8', small:true });
}
function levelMove(d){
  if (state !== 'play') return;
  g.level++;
  const now = performance.now();
  if (now - g.lastLevel < 1200) return;
  g.lastLevel = now;
  sfx.level();
  pops.push({ kind:'text', x:W/2, y:H*.62, t:now, text:'SO LE TAY RA!', color:'#FF3D6E', small:true });
}

/* Pump works in portrait and landscape; do not block mobile users. */
const locked=false;
function tryLandscape(){}
$('rotate').hidden=true;

/* ---------- Confetti for the 200 challenge ---------- */
function confetti(ms = 5500){
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = $('confetti'), x = c.getContext('2d'); c.hidden = false;
  const w = c.width = innerWidth * DPR, h = c.height = innerHeight * DPR;
  const cols = [COL6, COL7, OK, '#F6F1FF'];
  const parts = Array.from({ length: 200 }, (_, i) => ({
    x: Math.random() * w, y: -Math.random() * h * .8,
    vx: (Math.random() - .5) * 3 * DPR, vy: (2 + Math.random() * 4) * DPR,
    r: Math.random() * 6.28, vr: (Math.random() - .5) * .3,
    s: (6 + Math.random() * 8) * DPR, c: cols[i % 4],
    digit: Math.random() < .3 ? (i % 2 ? '6' : '7') : null
  }));
  const t0 = performance.now();
  (function step(t){
    x.clearRect(0, 0, w, h);
    for (const p of parts){
      p.x += p.vx + Math.sin((t + p.s * 50) / 300) * DPR; p.y += p.vy; p.r += p.vr;
      x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c;
      if (p.digit){ x.font = `${p.s * 2.4}px Bungee, Impact, sans-serif`; x.textAlign = 'center'; x.fillText(p.digit, 0, 0); }
      else x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      x.restore();
    }
    if (t - t0 < ms) requestAnimationFrame(step);
    else { x.clearRect(0, 0, w, h); c.hidden = true; }
  })(t0);
}

/* ---------- Snapshot of the player ---------- */
function takeSnap(){ api.view.drawSnapshot(snap); }

/* ---------- Flow ---------- */
let starting=false;
$('startBtn').onclick=async()=>{
  if(starting)return;starting=true;
  audioInit();sfx.ready();tryLandscape();$('introErr').hidden=true;setState('loading');
  try{
    await api.prepare(1,t=>$('loadTxt').textContent=t);
    await document.fonts.load('100px Bungee').catch(()=>{});
    resize();toCalib();api.activate(loop);
  }catch(e){setState('intro');const er=$('introErr');er.hidden=false;er.textContent=api.explainError(e);}
  finally{starting=false;}
};

function toCalib(){
  api.timers.clearAll(); calibHold = 0; pops=[]; S=120; lastPose=null;
  hands={6:makeHand(),7:makeHand()};
  g = null;
  setState('calib');
}

function countdown(){
  setState('countdown');
  const b = $('countTxt');
  const seq = ['3','2','1','GO!'];
  seq.forEach((txt, i) => api.timers.setTimeout(() => {
    b.textContent = txt;
    b.className = 'anim' + (txt === 'GO!' ? ' go' : '');
    void b.offsetWidth;
    if (txt === 'GO!'){
      sfx.go();
      g = newRound(); g.start = performance.now();
      $('score').textContent = '0'; $('c6').textContent = '0'; $('c7').textContent = '0'; $('combo').textContent = '';
      setState('play'); show('count', true);
      api.timers.setTimeout(() => { if (state === 'play') show('count', false); }, 600);
    } else sfx.beep();
  }, i * 850));
}

function endRound(){
  setState('ending');
  const b = $('countTxt'); b.textContent = 'HẾT GIỜ!'; b.className = 'anim end';
  sfx.end();
  api.timers.setTimeout(showResult, 1300);
}

function rankFor(sc){
  if (sc < 30) return 'MỚI KHỞI ĐỘNG';
  if (sc < 60) return 'TAY ẤM RỒI ĐÓ';
  if (sc < 100) return 'MÁY BƠM CHẠY ĐIỆN';
  if (sc < 150) return 'QUẠT TRẦN SỐ 3';
  if (sc < GOAL) return 'CỐI XAY GIÓ';
  return 'THẦN SIX SEVEN';
}

function showResult(){
  const r = g;
  const isBest = r.score > best;
  if (isBest){ best = r.score; try { localStorage.setItem('sixseven-best', best); } catch {} }
  // compose photo card
  const out = $('snapOut'), o = out.getContext('2d');
  if (r.snapRate < 0) takeSnap();
  o.drawImage(snap, 0, 0);
  const grd = o.createLinearGradient(0, 380, 0, 640);
  grd.addColorStop(0, 'rgba(14,11,31,0)'); grd.addColorStop(1, 'rgba(14,11,31,.92)');
  o.fillStyle = grd; o.fillRect(0, 380, 480, 260);
  o.textAlign = 'left'; o.textBaseline = 'alphabetic';
  o.font = '150px Bungee, Impact, sans-serif';
  o.fillStyle = COL6; o.fillText('6', 24, 610);
  o.fillStyle = COL7; o.fillText('7', 130, 610);
  o.textAlign = 'right';
  o.fillStyle = '#F6F1FF'; o.font = '96px Bungee, Impact, sans-serif'; o.fillText(r.score, 456, 590);
  o.font = '22px Bungee, Impact, sans-serif'; o.fillStyle = '#A49CC8'; o.fillText('ĐIỂM / 20 GIÂY', 456, 620);
  o.textAlign = 'left'; o.font = '22px Bungee, Impact, sans-serif';
  o.fillStyle = 'rgba(14,11,31,.75)'; o.fillRect(0, 0, 480, 46);
  o.fillStyle = '#FFD23F'; o.fillText('SIX SEVEN PUMP', 18, 32);
  const cleared = r.score >= GOAL;
  if (cleared){
    o.save(); o.translate(360, 120); o.rotate(.22);
    o.fillStyle = '#FFD23F'; o.fillRect(-120, -34, 240, 68);
    o.fillStyle = '#0E0B1F'; o.font = '26px Bungee, Impact, sans-serif'; o.textAlign = 'center'; o.textBaseline = 'middle';
    o.fillText('CHALLENGE', 0, -10); o.fillText('CLEARED', 0, 18);
    o.restore();
  }
  $('challenge').hidden = !cleared;
  $('resPhoto').classList.toggle('gold', cleared);

  $('rankTxt').textContent = rankFor(r.score);
  $('rScore').textContent = r.score;
  $('rPeak').textContent = r.peak + '/s';
  $('r6').textContent = r.c6; $('r7').textContent = r.c7;
  $('rCombo').textContent = r.bestCombo;
  const tot = r.c6 + r.c7;
  $('rBal').textContent = tot ? Math.round(Math.abs(r.c6 - r.c7) / tot * 100) + '%' : '0%';
  $('bestTxt').innerHTML = isBest && r.score > 0 ? '<strong>KỶ LỤC MỚI!</strong> Bạn vừa vượt chính mình.' : 'Kỷ lục của bạn: <strong>' + best + '</strong> điểm';
  setState('result');
  if (cleared){ sfx.clear(); api.timers.setTimeout(() => sfx.fanfare(), 700); confetti(); }
  else sfx.fanfare();
}

$('againBtn').onclick = () => { audioInit(); sfx.ready(); toCalib(); };
$('saveBtn').onclick = () => api.save($('snapOut'), 'six-seven-'+(g?.score||0)+'.png');

/* ---------- Main loop ---------- */
let lastObserved=-Infinity;
function loop(now,dt,detection){
  if(detection.updated){
    lastPose=detection.landmarks[0]||null;
    lastObserved=now;
  }else if(now-lastObserved>240){lastPose=null;}

  let L = null;
  if (lastPose){
    L = {};
    for (const i of [11,12,13,14,15,16]) L[i] = toScreen(lastPose[i]);
    const sw = Math.hypot(L[11].x - L[12].x, L[11].y - L[12].y);
    if (sw > 20) S = S * .9 + sw * .1;
  }
  const ok6 = L && L[15].v > .5, ok7 = L && L[16].v > .5;

  if (locked){
    if (state === 'calib') calibHold = 0;
    if (state === 'play'){ if (!g.pausedAt) g.pausedAt = now; draw(now, null, false, false, false); return; }
  } else if (state === 'play' && g.pausedAt){
    g.start += now - g.pausedAt; g.pausedAt = 0;
    hands = { 6: makeHand(), 7: makeHand() };
  }

  if (state === 'calib' && !locked){
    const shoulderY = L ? (L[11].y + L[12].y) / 2 : 0;
    const up6 = ok6 && L[15].y < shoulderY + S * .9;
    const up7 = ok7 && L[16].y < shoulderY + S * .9;
    $('chip6').className = 'chip' + (up6 ? ' on6' : '');
    $('chip7').className = 'chip' + (up7 ? ' on7' : '');
    if (up6 && up7){
      calibHold += dt;
      $('calibTitle').textContent = 'GIỮ YÊN…';
      $('calibSub').textContent = 'Đã thấy cả hai tay. Chuẩn bị bơm!';
    } else {
      calibHold = Math.max(0, calibHold - dt * 2);
      $('calibTitle').textContent = !L ? 'CHƯA THẤY BẠN' : 'GIƠ 2 TAY LÊN';
      $('calibSub').textContent = !L ? 'Đứng vào khung hình, lùi lại để camera thấy từ thắt lưng trở lên.' : 'Giơ cả hai tay lên ngang ngực để camera bắt cổ tay.';
    }
    if (calibHold > 1100){ countdown(); }
  }

  if (state === 'play'){
    const y6 = ok6 ? L[15].y : hands[6].y, y7 = ok7 ? L[16].y : hands[7].y;
    if (detection.updated && ok6) updateHand(hands[6], L[15].x, L[15].y, y7, S, { stroke: len => stroke(6, len), small: () => smallMove(6), level: () => levelMove(6) });
    if (detection.updated && ok7) updateHand(hands[7], L[16].x, L[16].y, y6, S, { stroke: len => stroke(7, len), small: () => smallMove(7), level: () => levelMove(7) });
    const el = now - g.start, left = Math.max(0, GAME_MS - el);
    $('timefill').style.transform = `scaleX(${left / GAME_MS})`;
    $('timeTxt').textContent = (left / 1000).toFixed(1);
    $('timebar').classList.toggle('hurry', left < 5000);
    const sec = Math.ceil(left / 1000);
    if (left < 5000 && sec !== g.lastTick){ g.lastTick = sec; sfx.tick(); }
    g.strokes = g.strokes.filter(t => now - t < 1000);
    const rate = g.strokes.length;
    if (rate > g.peak) g.peak = rate;
    $('meter').querySelector('i').style.width = Math.min(100, rate / 12 * 100) + '%';
    $('rateTxt').textContent = rate + ' nhát/giây';
    $('combo').textContent = g.combo >= 5 && now - g.lastStroke < 650 ? 'CHUỖI ×' + g.combo : '';
    // keep the photo from the fastest moment
    if (el > 1500 && rate >= g.snapRate && now - g.lastSnap > 250){ g.snapRate = rate; g.lastSnap = now; takeSnap(); }
    if (left <= 0) endRound();
  } else if (L && (ok6 || ok7)){
    for (const [d, i] of [[6,15],[7,16]]) if (L[i].v > .5){ hands[d].x = L[i].x; hands[d].y = L[i].y; }
  }

  draw(now, L, ok6, ok7, detection.updated);
}

/* ---------- Drawing ---------- */
function arm(L, a, b, c, col){
  if (L[c].v < .5) return;
  ctx.strokeStyle = col; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.globalAlpha = .55;
  ctx.beginPath(); ctx.moveTo(L[a].x, L[a].y); ctx.lineTo(L[b].x, L[b].y); ctx.lineTo(L[c].x, L[c].y); ctx.stroke();
  ctx.globalAlpha = 1;
}
function wristBadge(x, y, d, col, fill){
  const r = Math.max(18, Math.min(34, S * .13));
  ctx.fillStyle = 'rgba(14,11,31,.55)';
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fill); ctx.stroke();
  ctx.fillStyle = col; ctx.font = `${Math.round(r * 1.1)}px Bungee, Impact, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(d), x, y + 2);
}
function draw(now, L, ok6, ok7, fresh){
  ctx.clearRect(0, 0, W, H);
  const active = state === 'calib' || state === 'countdown' || state === 'play' || state === 'ending';
  if (L && active){
    arm(L, 11, 13, 15, COL6); arm(L, 12, 14, 16, COL7);
    // live "so le" cue: dashed link between wrists, green when heights are far enough apart
    if (state === 'play' && ok6 && ok7){
      const apart = Math.abs(L[15].y - L[16].y) >= S * OFFSET_K;
      ctx.save();
      ctx.setLineDash([8, 10]); ctx.lineWidth = 3;
      ctx.strokeStyle = apart ? OK : '#FF3D6E'; ctx.globalAlpha = apart ? .8 : .65;
      ctx.beginPath(); ctx.moveTo(L[15].x, L[15].y); ctx.lineTo(L[16].x, L[16].y); ctx.stroke();
      ctx.restore();
    }
    for (const [d, i, col] of [[6,15,COL6],[7,16,COL7]]){
      const h = hands[d];
      if (fresh && L[i].v > .5){
        h.trail.push({ x:L[i].x, y:L[i].y, t:now });
      }
      h.trail = h.trail.filter(p => now - p.t < 220);
      if (h.trail.length > 1){
        ctx.strokeStyle = col; ctx.lineCap = 'round';
        for (let k = 1; k < h.trail.length; k++){
          const p0 = h.trail[k-1], p1 = h.trail[k];
          ctx.globalAlpha = k / h.trail.length * .8; ctx.lineWidth = 4 + 10 * k / h.trail.length;
          ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      if (L[i].v > .5){
        const fill = state === 'calib' ? Math.min(1, calibHold / 1100) : 1;
        wristBadge(L[i].x, L[i].y, d, col, fill);
      }
    }
  }
  // pops
  const life = p => p.hero ? 1800 : 900;
  pops = pops.filter(p => now - p.t < life(p));
  for (const p of pops){
    const k = (now - p.t) / life(p);
    if (p.kind === 'ring'){
      const col = p.d == 6 ? COL6 : COL7;
      ctx.strokeStyle = col; ctx.globalAlpha = 1 - k; ctx.lineWidth = 6 * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(p.x, p.y, S * .12 + k * S * .45, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (p.kind === 'num'){
      const col = p.d == 6 ? COL6 : COL7;
      const sc = k < .15 ? .5 + k / .15 * .7 : 1.2 - (k - .15) * .3;
      const size = Math.min(80, Math.max(24, S * (p.big ? .38 : .28))) * sc;
      ctx.save();
      ctx.translate(p.x + p.vx * k * .6, p.y - k * S * .8);
      ctx.rotate(p.rot);
      ctx.globalAlpha = k < .6 ? 1 : 1 - (k - .6) / .4;
      ctx.font = `${Math.round(size)}px Bungee, Impact, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(4, size * .09); ctx.strokeStyle = '#0E0B1F';
      ctx.strokeText(String(p.d), 0, 0);
      ctx.fillStyle = col; ctx.fillText(String(p.d), 0, 0);
      ctx.restore();
    } else if (p.kind === 'text'){
      ctx.save();
      ctx.globalAlpha = 1 - k;
      const size = p.small ? 22 : p.hero ? Math.min(44, W * .045) : Math.min(48, W * .06);
      ctx.font = `${size}px Bungee, Impact, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 6; ctx.strokeStyle = '#0E0B1F';
      ctx.strokeText(p.text, p.x, p.y - k * 40);
      ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y - k * 40);
      ctx.restore();
    }
  }
}

return {
  update:loop,
  getState:()=>state,
  restart:toCalib,
  onPause(now){api.timers.pause();if(g&&state==='play'&&!g.pausedAt)g.pausedAt=now;},
  onResume(now){api.timers.resume();if(g?.pausedAt){g.start+=now-g.pausedAt;g.pausedAt=0;}hands={6:makeHand(),7:makeHand()};lastPose=null;lastObserved=-Infinity;},
  destroy(){api.timers.clearAll();g=null;lastPose=null;}
};

}
