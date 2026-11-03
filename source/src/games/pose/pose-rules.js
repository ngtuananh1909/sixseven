/* ---------- Pose library ----------
   Angles in degrees, screen space as the players see themselves (mirror view):
   0 = pointing to screen right, 90 = down, 180 = screen left, -90 = up.
   l* = limb on the screen-left side of that person, r* = screen-right side.
   u = upper arm, f = forearm, t = thigh, s = shin, lean = torso tilt (+ = top leans right). */
const LEGS = { lt:95, ls:95, rt:85, rs:85 };
const mirror = p => {
  const m = a => a == null ? a : ((180 - a + 540) % 360) - 180;
  return { lu:m(p.ru), lf:m(p.rf), ru:m(p.lu), rf:m(p.lf), lt:m(p.rt ?? LEGS.rt), ls:m(p.rs ?? LEGS.rs), rt:m(p.lt ?? LEGS.lt), rs:m(p.ls ?? LEGS.ls), lean:-(p.lean || 0), legs:p.legs };
};
const P = (o) => ({ ...LEGS, lean:0, ...o });
const POSES = [
  { name:'CHỮ Y', a:P({ lu:-130, lf:-130, ru:-50, rf:-50 }) },
  { name:'TRÁI TIM ĐÔI', a:P({ lu:120, lf:40, ru:-80, rf:-10 }) },
  { name:'SIÊU NHÂN', a:P({ lu:-95, lf:-95, ru:60, rf:140 }) },
  { name:'DISCO', a:P({ lu:135, lf:135, ru:-45, rf:-45 }) },
  { name:'KHOE CƠ BẮP', a:P({ lu:180, lf:-90, ru:0, rf:-90 }), b:P({ lu:180, lf:-90, ru:0, rf:-90 }) },
  { name:'CHỮ T VÀ CHỮ I', a:P({ lu:180, lf:180, ru:0, rf:0 }), b:P({ lu:-95, lf:-95, ru:-85, rf:-85 }) },
  { name:'CHỈ MẶT NHAU', a:P({ lu:95, lf:95, ru:0, rf:0 }) },
  { name:'A LÔ A LÔ', a:P({ lu:110, lf:-70, ru:80, rf:80 }) },
  { name:'CẦU VỒNG', a:P({ lu:-60, lf:-10, ru:100, rf:100, lean:14 }) },
  { name:'ROBOT', a:P({ lu:180, lf:90, ru:0, rf:-90 }), b:P({ lu:180, lf:-90, ru:0, rf:90 }) },
].map(p => ({ name:p.name, t:[p.a, p.b || mirror(p.a)] }));

/* ---------- Skeleton geometry ---------- */
const BONES = [[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28]];
const SEGS = [
  { k:'lu', a:11, b:13, w:1.2 }, { k:'lf', a:13, b:15, w:1 },
  { k:'ru', a:12, b:14, w:1.2 }, { k:'rf', a:14, b:16, w:1 },
  { k:'lt', a:23, b:25, w:.6, opt:true }, { k:'ls', a:25, b:27, w:.5, opt:true },
  { k:'rt', a:24, b:26, w:.6, opt:true }, { k:'rs', a:26, b:28, w:.5, opt:true },
];
const rad = d => d * Math.PI / 180;
const dir = d => ({ x:Math.cos(rad(d)), y:Math.sin(rad(d)) });
function buildSkeleton(p, ax, ay, s){
  const lean = p.lean || 0;
  const down = dir(90 + lean), across = dir(lean);
  const pt = {};
  pt[11] = { x:ax - across.x * s / 2, y:ay - across.y * s / 2 };
  pt[12] = { x:ax + across.x * s / 2, y:ay + across.y * s / 2 };
  const hx = ax + down.x * 1.3 * s, hy = ay + down.y * 1.3 * s;
  pt[23] = { x:hx - across.x * .32 * s, y:hy - across.y * .32 * s };
  pt[24] = { x:hx + across.x * .32 * s, y:hy + across.y * .32 * s };
  const add = (from, ang, len) => { const d = dir(ang); return { x:from.x + d.x * len * s, y:from.y + d.y * len * s }; };
  pt[13] = add(pt[11], p.lu, .72); pt[15] = add(pt[13], p.lf, .68);
  pt[14] = add(pt[12], p.ru, .72); pt[16] = add(pt[14], p.rf, .68);
  pt[25] = add(pt[23], p.lt, .95); pt[27] = add(pt[25], p.ls, .9);
  pt[26] = add(pt[24], p.rt, .95); pt[28] = add(pt[26], p.rs, .9);
  pt.head = { x:ax - down.x * .55 * s, y:ay - down.y * .55 * s, r:.27 * s };
  return pt;
}
const angDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
// within 15° counts as a perfect match, then credit falls to zero at 90° off
const segSim = d => d <= 15 ? 1 : Math.max(0, 1 - (d - 15) / 75);
function scorePerson(L, target){
  let sum = 0, wsum = 0; const segs = {};
  for (const sg of SEGS){
    const A = L[sg.a], B = L[sg.b];
    const vis = A.v > .5 && B.v > .5;
    if (sg.opt && !vis) continue;
    let sim = 0;
    if (vis){
      const m = Math.atan2(B.y - A.y, B.x - A.x) * 180 / Math.PI;
      sim = segSim(angDiff(m, target[sg.k]));
    }
    segs[sg.k] = sim; sum += sim * sg.w; wsum += sg.w;
  }
  // torso lean, only when hips are in view
  if (L[23].v > .5 && L[24].v > .5){
    const mx = (L[11].x + L[12].x) / 2, my = (L[11].y + L[12].y) / 2;
    const hx = (L[23].x + L[24].x) / 2, hy = (L[23].y + L[24].y) / 2;
    const m = Math.atan2(hy - my, hx - mx) * 180 / Math.PI;
    const sim = segSim(angDiff(m, 90 + (target.lean || 0)));
    segs.torso = sim; sum += sim * .8; wsum += .8;
  }
  return { score: wsum ? sum / wsum : 0, segs };
}
export {POSES, BONES, SEGS, buildSkeleton, scorePerson};
