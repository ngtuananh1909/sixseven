import {POSES, BONES, SEGS, buildSkeleton, scorePerson} from './pose-rules.js';
import {saveCanvas} from '../../shared/snapshot.js';
export function createPoseGame(api){
/* ---------- Rules ---------- */
const ROUND_MS = 10000;
const NEED_WINS = 7, MAX_FAILS = 3;
const PASS = .90;          // each player must reach 90%
const HOLD_MS = 400;       // and both hold it this long
const $ = id => api.root.querySelector('#' + id);
const COL = ['#FF5A36', '#FFD23F'], OK = '#3DFFB0', BAD = '#FF3D6E';

const audioInit = api.audio.init;
const sfx = api.audio.pose;

/* ---------- Shared canvas / mapping ---------- */
const video = api.camera.video, fx = api.view.canvas, ctx = api.view.ctx;
let W = 0, H = 0, DPR = 1;
function resize(){ api.view.resize(); W=api.view.W; H=api.view.H; DPR=api.view.DPR; }
api.listen(window, 'resize', resize); resize();
const toScreen = p => api.view.toScreen(p);

/* ---------- Orientation: allow intro in portrait; guide Pose players to landscape ---------- */
const portraitMQ = matchMedia('(orientation: portrait) and (pointer: coarse)');
let locked = false;
function checkOrient(){
  locked = portraitMQ.matches;
  $('rotate').hidden = !(locked && (state === 'lobby' || state === 'countdown' || state === 'game'));
}
api.listen(portraitMQ, 'change', checkOrient);
api.listen(window, 'resize', checkOrient);
function tryLandscape(){
  // Optional API: Safari/iOS does not generally support orientation locking.
  try { if (screen.orientation?.lock && !portraitMQ.matches) screen.orientation.lock('landscape').catch(()=>{}); } catch {}
}

/* ---------- State ---------- */
let state = 'intro';       // intro | loading | lobby | countdown | game | result
let people = [];           // [{L, S, cx}] sorted left→right on screen
let lobbyHold = 0;
let G = null;              // game
let R = null;              // current round
const timeouts = [];
const later = (fn, ms) => timeouts.push(api.timers.setTimeout(fn, ms));
const clearLater = () => { while (timeouts.length) api.timers.clearTimeout(timeouts.pop()); };

function setState(s){
  state = s;
  $('intro').hidden = s !== 'intro'; $('loading').hidden = s !== 'loading';
  $('lobby').hidden = s !== 'lobby'; $('hud').hidden = s !== 'game';
  $('result').hidden = s !== 'result';
  if (s !== 'countdown' && s !== 'game') $('banner').hidden = true;
  checkOrient();
}
function banner(big, small, cls){
  const b = $('banner'), bb = $('bannerBig'), bs = $('bannerSmall');
  b.hidden = false; b.className = cls || 'info';
  bb.textContent = big; bb.classList.remove('anim'); void bb.offsetWidth; bb.classList.add('anim');
  bs.hidden = !small; bs.textContent = small || '';
}
const hideBanner = () => { $('banner').hidden = true; };

function shuffle(a){ a = a.slice(); for (let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/* ---------- Flow ---------- */
let starting = false;
$('startBtn').onclick = async () => {
  if (starting) return;
  starting = true;
  audioInit(); sfx.ready(); tryLandscape();
  $('introErr').hidden = true; setState('loading');
  try {
    await api.prepare(2, t => $('loadTxt').textContent = t);
    await document.fonts.load('40px Bungee').catch(()=>{});
    resize(); toLobby();
    api.activate(loop);
  } catch(e) {
    setState('intro');
    const err=$('introErr');err.hidden=false;err.textContent=api.explainError(e);
  } finally { starting=false; }
};
$('againBtn').onclick = () => { audioInit(); sfx.ready(); toLobby(); };
$('saveBtn').onclick = () => api.save($('collage'), 'six-seven-pose.png');

function toLobby(){ clearLater(); trackedCenters=[null,null]; people=[]; lobbyHold = 0; G = null; R = null; setState('lobby'); }

function startGame(){
  setState('countdown');
  ['3','2','1'].forEach((t, i) => later(() => { banner(t, null, 'info'); sfx.beep(); }, i * 850));
  later(() => {
    G = { deck: shuffle(POSES), wins:0, fails:0, rounds:[], idx:0 };
    sfx.go(); setState('game'); renderPips(); nextRound();
  }, 3 * 850);
}

function nextRound(){
  const pose = G.deck[G.idx++ % G.deck.length];
  R = { pose, phase:'intro', start:0, pausedAt:0, sm:[0,0], hold:0, best:0, lastTick:-1,
        snap: document.createElement('canvas'), snapScore:-1, lastSnap:0 };
  R.snap.width = 480; R.snap.height = 300;
  $('roundTxt').textContent = 'DÁNG ' + (G.rounds.length + 1);
  $('poseName').textContent = pose.name;
  drawRef(pose);
  $('timeTxt').textContent = '10'; $('timeTxt').classList.remove('hurry');
  banner(pose.name, 'Chuẩn bị tạo dáng!', 'info'); sfx.pose();
  later(() => { hideBanner(); R.phase = 'pose'; R.start = performance.now(); }, 1500);
}

function endRound(ok){
  R.phase = 'done';
  G.rounds.push({ name:R.pose.name, ok, best:Math.round(R.best * 100), snap:R.snap });
  ok ? G.wins++ : G.fails++;
  renderPips();
  if (ok){ sfx.clear(); banner('CHUẨN!', 'Khớp dáng ' + R.pose.name, 'ok'); const f = $('flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); }
  else { sfx.fail(); banner('HẾT GIỜ', 'Cao nhất ' + Math.round(R.best * 100) + '%', 'fail'); }
  later(() => {
    hideBanner();
    if (G.wins >= NEED_WINS || G.fails >= MAX_FAILS) showResult();
    else nextRound();
  }, 1800);
}

function renderPips(){
  const box = $('pips'); box.textContent = '';
  const total = NEED_WINS + MAX_FAILS - 1;
  for (let i = 0; i < total; i++){
    const r = G && G.rounds[i], d = document.createElement('div');
    d.className = 'pip' + (r ? (r.ok ? ' win' : ' lose') : '');
    d.textContent = r ? (r.ok ? '✓' : '✗') : '';
    box.appendChild(d);
  }
}

function showResult(){
  const win = G.wins >= NEED_WINS;
  const v = $('verdict'); v.className = 'verdict ' + (win ? 'win' : 'lose');
  $('vTitle').textContent = win ? 'THẮNG RỒI! 7 DÁNG CHUẨN' : 'THUA SÁT NÚT';
  $('vSub').textContent = win ? `Qua ${G.wins} dáng sau ${G.rounds.length} lượt. Hai bạn ăn ý thật.` : `Mới qua ${G.wins}/7 dáng. Làm lại ván nữa?`;
  drawCollage(win);
  setState('result');
  if (win){ sfx.win(); confetti(); } else sfx.lose();
}

/* ---------- Snapshot helpers ---------- */
function snapInto(cv){ api.view.drawSnapshot(cv); }
function drawCollage(win){
  const cv = $('collage'), c = cv.getContext('2d');
  const n = G.rounds.length, cols = Math.min(3, n), rows = Math.ceil(n / 3);
  const tw = 360, th = 225, gap = 24, top = 120, lab = 52;
  cv.width = Math.max(cols * tw + (cols + 1) * gap, 900);
  cv.height = top + rows * (th + lab + gap) + gap;
  c.fillStyle = '#0E0B1F'; c.fillRect(0, 0, cv.width, cv.height);
  c.font = '44px Bungee, Impact, sans-serif'; c.textBaseline = 'alphabetic'; c.textAlign = 'left';
  c.fillStyle = COL[0]; c.fillText('SIX', gap, 72);
  c.fillStyle = COL[1]; c.fillText('SEVEN', gap + c.measureText('SIX ').width, 72);
  c.fillStyle = '#F6F1FF'; c.fillText('POSE', gap + c.measureText('SIX SEVEN ').width, 72);
  c.textAlign = 'right'; c.font = '30px Bungee, Impact, sans-serif';
  c.fillStyle = win ? OK : BAD; c.fillText(win ? 'THẮNG ' + G.wins + '/7' : 'THUA ' + G.wins + '/7', cv.width - gap, 70);
  const rowW = cols * tw + (cols - 1) * gap, x0 = (cv.width - rowW) / 2;
  G.rounds.forEach((r, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = x0 + col * (tw + gap), y = top + row * (th + lab + gap);
    c.drawImage(r.snap, x, y, tw, th);
    c.lineWidth = 6; c.strokeStyle = r.ok ? OK : BAD; c.strokeRect(x + 3, y + 3, tw - 6, th - 6);
    c.textAlign = 'left'; c.font = '22px Bungee, Impact, sans-serif'; c.fillStyle = '#F6F1FF';
    c.fillText(r.name, x, y + th + 32);
    c.textAlign = 'right'; c.fillStyle = r.ok ? OK : BAD;
    c.fillText((r.ok ? '✓ ' : '✗ ') + r.best + '%', x + tw, y + th + 32);
  });
}

/* ---------- Confetti ---------- */
function confetti(ms = 5500){
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = $('confetti'), x = c.getContext('2d'); c.hidden = false;
  const w = c.width = innerWidth * DPR, h = c.height = innerHeight * DPR, cols = [COL[0], COL[1], OK, '#F6F1FF'];
  const parts = Array.from({ length:200 }, (_, i) => ({ x:Math.random()*w, y:-Math.random()*h*.8, vx:(Math.random()-.5)*3*DPR, vy:(2+Math.random()*4)*DPR, r:Math.random()*6.28, vr:(Math.random()-.5)*.3, s:(6+Math.random()*8)*DPR, c:cols[i%4], d:Math.random()<.3 ? (i%2?'6':'7') : null }));
  const t0 = performance.now();
  (function step(t){
    x.clearRect(0, 0, w, h);
    for (const p of parts){
      p.x += p.vx + Math.sin((t + p.s * 50) / 300) * DPR; p.y += p.vy; p.r += p.vr;
      x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c;
      if (p.d){ x.font = `${p.s*2.4}px Bungee, Impact, sans-serif`; x.textAlign = 'center'; x.fillText(p.d, 0, 0); } else x.fillRect(-p.s/2, -p.s/4, p.s, p.s/2);
      x.restore();
    }
    if (t - t0 < ms) requestAnimationFrame(step); else { x.clearRect(0, 0, w, h); c.hidden = true; }
  })(t0);
}

/* ---------- Drawing ---------- */
function drawGhost(c, pt, s, color, alpha = 1){
  c.save(); c.globalAlpha = alpha; c.lineCap = 'round'; c.lineJoin = 'round';
  for (const pass of [0, 1]){
    c.strokeStyle = pass ? 'rgba(246,241,255,.85)' : color;
    c.lineWidth = pass ? Math.max(3, s * .07) : Math.max(7, s * .16);
    for (const [a, b] of BONES){ c.beginPath(); c.moveTo(pt[a].x, pt[a].y); c.lineTo(pt[b].x, pt[b].y); c.stroke(); }
    c.beginPath(); c.arc(pt.head.x, pt.head.y, pt.head.r, 0, Math.PI * 2); c.stroke();
  }
  c.restore();
}
function drawRef(p){
  const cv = $('refCv'), c = cv.getContext('2d');
  c.clearRect(0, 0, cv.width, cv.height);
  const s = 34;
  [0, 1].forEach(i => {
    const sk = buildSkeleton(p.t[i], cv.width * (i ? .7 : .3), 52, s);
    drawGhost(c, sk, s, COL[i]);
  });
}
function drawLogo(){
  const cv = $('logoCv'), c = cv.getContext('2d'), s = 70;
  drawGhost(c, buildSkeleton(POSES[0].t[0], 170, 110, s), s, COL[0]);
  drawGhost(c, buildSkeleton(POSES[3].t[1], 390, 110, s), s, COL[1]);
}
document.fonts.ready.then(drawLogo); drawLogo();

function drawLive(L, segs){
  ctx.save(); ctx.lineCap = 'round';
  for (const [a, b] of BONES){
    if (L[a].v < .5 || L[b].v < .5) continue;
    const sg = SEGS.find(s => (s.a === a && s.b === b));
    let col = 'rgba(246,241,255,.7)';
    if (sg && segs && segs[sg.k] != null) col = segs[sg.k] >= .9 ? OK : segs[sg.k] >= .75 ? '#FFD23F' : BAD;
    ctx.strokeStyle = col; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(L[a].x, L[a].y); ctx.lineTo(L[b].x, L[b].y); ctx.stroke();
  }
  for (const i of [11,12,13,14,15,16,23,24,25,26,27,28]){
    if (L[i].v < .5) continue;
    ctx.fillStyle = '#0E0B1F'; ctx.beginPath(); ctx.arc(L[i].x, L[i].y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#F6F1FF'; ctx.beginPath(); ctx.arc(L[i].x, L[i].y, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
function badge(x, y, txt, color){
  ctx.save(); ctx.font = '22px Bungee, Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(txt).width + 22;
  ctx.fillStyle = 'rgba(14,11,31,.8)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - w/2, y - 17, w, 34, 10) : ctx.rect(x - w/2, y - 17, w, 34); ctx.fill();
  ctx.fillStyle = color; ctx.fillText(txt, x, y + 1); ctx.restore();
}

/* ---------- Main loop ---------- */
let lastObserved = -Infinity;
let trackedCenters=[null,null];
function matchPlayers(found){
  found.sort((a,b)=>a.cx-b.cx);
  if (state !== 'game') return found;
  if (found.length===0) return [];
  if (trackedCenters.every(c=>c===null)) {
    found.slice(0,2).forEach((p,i)=>trackedCenters[i]=p.cx);
    return found;
  }
  const out=[null,null];
  if (found.length>=2) {
    let [a,b]=found;
    if (trackedCenters[0]!==null && trackedCenters[1]!==null &&
        Math.abs(a.cx-trackedCenters[0])+Math.abs(b.cx-trackedCenters[1]) >
        Math.abs(b.cx-trackedCenters[0])+Math.abs(a.cx-trackedCenters[1])) [a,b]=[b,a];
    out[0]=a;out[1]=b;
  } else {
    const [p]=found;
    const i=trackedCenters[0]===null?0:trackedCenters[1]===null?1:
      (Math.abs(p.cx-trackedCenters[0])<=Math.abs(p.cx-trackedCenters[1])?0:1);
    out[i]=p;
  }
  out.forEach((p,i)=>{if(p)trackedCenters[i]=p.cx;});
  return out;
}
const countPeople = () => people.filter(Boolean).length;
function loop(now, dt, detection){
  if (detection.updated){
    lastObserved=now;
    const found=detection.landmarks.map(lm => {
      const L=lm.map(toScreen), S=Math.hypot(L[11].x-L[12].x,L[11].y-L[12].y);
      return {L,S,cx:(L[11].x+L[12].x)/2,cy:(L[11].y+L[12].y)/2};
    }).filter(p=>p.L[11].v>.5&&p.L[12].v>.5&&p.S>15);
    people=matchPlayers(found);
  } else if(now-lastObserved>240){people=[];}


  ctx.clearRect(0, 0, W, H);

  if (state === 'lobby'){
    const two = countPeople() >= 2 && !locked;
    $('chip1').className = 'chip' + (countPeople() >= 1 ? ' on1' : '');
    $('chip2').className = 'chip' + (countPeople() >= 2 ? ' on2' : '');
    if (two){ lobbyHold += dt; $('lobbyTitle').textContent = 'ĐỦ 2 NGƯỜI, GIỮ YÊN…'; $('lobbySub').textContent = 'Chuẩn bị nhìn khung xương mẫu và tạo dáng theo.'; }
    else {
      lobbyHold = Math.max(0, lobbyHold - dt * 2);
      $('lobbyTitle').textContent = countPeople() === 1 ? 'MỚI THẤY 1 NGƯỜI' : 'CẦN 2 NGƯỜI';
      $('lobbySub').textContent = 'Hai người đứng cạnh nhau, lùi lại cho camera thấy từ đầu tới ít nhất thắt lưng.';
    }
    people.slice(0, 2).forEach((p, i) => { drawLive(p.L, null); badge(p.cx, p.cy - p.S * 1.1, 'NGƯỜI ' + (i + 1), COL[i]); });
    if (lobbyHold > 1200) startGame();
    return;
  }

  if (state === 'countdown'){ people.filter(Boolean).slice(0, 2).forEach(p => drawLive(p.L, null)); return; }
  if (state !== 'game' || !R) return;

  // pause the clock while the phone is held upright
  if (locked){ if (R.phase === 'pose' && !R.pausedAt) R.pausedAt = now; return; }
  if (R.pausedAt){ R.start += now - R.pausedAt; R.pausedAt = 0; }

  // ghosts: anchored on each player when visible, otherwise at a default spot
  const ghostFor = i => {
    const p = people[i];
    const s = p ? p.S : Math.min(W, H) * .16;
    const ax = p ? p.cx : W * (i ? .68 : .32), ay = p ? p.cy : H * .42;
    return { pt: buildSkeleton(R.pose.t[i], ax, ay, s), s };
  };
  [0, 1].forEach(i => { const g = ghostFor(i); drawGhost(ctx, g.pt, g.s, COL[i], R.phase === 'intro' ? .9 : .45); });

  const res = [0, 1].map(i => people[i] ? scorePerson(people[i].L, R.pose.t[i]) : null);
  res.forEach((r, i) => {
    const raw = r ? r.score : 0;
    R.sm[i] = R.sm[i] * .7 + raw * .3;
    if (people[i]){
      drawLive(people[i].L, R.phase === 'pose' ? r.segs : null);
      const pct = Math.round(R.sm[i] * 100);
      badge(people[i].cx, people[i].cy - people[i].S * 1.15, pct + '%', R.sm[i] >= PASS ? OK : COL[i]);
    }
    $('s' + (i + 1)).textContent = Math.round(R.sm[i] * 100) + '%';
    $('b' + (i + 1)).style.width = Math.round(R.sm[i] * 100) + '%';
  });

  if (R.phase !== 'pose') return;

  const el = now - R.start, left = Math.max(0, ROUND_MS - el), sec = Math.ceil(left / 1000);
  $('timeTxt').textContent = sec; $('timeTxt').classList.toggle('hurry', left <= 3000);
  if (sec !== R.lastTick && sec > 0){ R.lastTick = sec; sec <= 3 ? sfx.tickHot() : sfx.tick(); }

  const both = Math.min(R.sm[0], R.sm[1]);
  if (both > R.best) R.best = both;
  if (both >= R.snapScore && now - R.lastSnap > 200){ R.snapScore = both; R.lastSnap = now; snapInto(R.snap); }

  const holdTxt = $('holdTxt');
  if (countPeople() < 2){ holdTxt.textContent = 'CẦN ĐỦ 2 NGƯỜI'; holdTxt.style.color = BAD; }
  else if (both >= PASS){ holdTxt.textContent = 'GIỮ YÊN!'; holdTxt.style.color = OK; }
  else { holdTxt.textContent = R.sm[0] < R.sm[1] ? 'NGƯỜI 1 CHỈNH LẠI' : 'NGƯỜI 2 CHỈNH LẠI'; holdTxt.style.color = ''; }

  if (both >= PASS && countPeople() >= 2 && now-lastObserved <= 240){ if (R.hold === 0) sfx.near(); R.hold += dt; }
  else R.hold = Math.max(0, R.hold - dt * 1.5);
  $('holdBar').style.width = Math.min(100, R.hold / HOLD_MS * 100) + '%';

  if (R.hold >= HOLD_MS){ snapInto(R.snap); R.best = Math.max(R.best, both); endRound(true); }
  else if (left <= 0) endRound(false);
}

return {
  update:loop,
  getState:()=>state,
  restart:toLobby,
  onPause(now){ api.timers.pause(); if(R?.phase==='pose'&&!R.pausedAt) R.pausedAt=now; },
  onResume(now){api.timers.resume(); if(R?.pausedAt){R.start+=now-R.pausedAt;R.pausedAt=0;} people=[];lastObserved=-Infinity;},
  destroy(){clearLater();api.timers.clearAll();people=[];R=null;G=null;}
};

}
