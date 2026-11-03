/* ---------- Hand stroke tracking ---------- */
const OFFSET_K = .4;       // hands must be at least 0.4 shoulder-widths apart in height during a stroke
function makeHand(){ return { y:null, x:0, dir:0, anchor:0, ext:0, maxOff:0, trail:[] }; }

function updateHand(h, x, y, otherY, S, cb){
  if (h.y === null){ h.y = y; h.anchor = y; h.ext = y; h.dir = 0; }
  h.y = h.y * .35 + y * .65; h.x = x;
  const Y = h.y, hy = S * .1, thr = S * .38;
  if (otherY != null) h.maxOff = Math.max(h.maxOff, Math.abs(Y - otherY));
  const finish = len => {
    if (len >= thr) (h.maxOff >= S * OFFSET_K ? cb.stroke(len) : cb.level());
    else if (len > hy * 1.6) cb.small();
    h.maxOff = 0;
  };
  if (h.dir === 0){
    if (Y < h.anchor - hy){ h.dir = -1; h.ext = Y; h.maxOff = 0; }
    else if (Y > h.anchor + hy){ h.dir = 1; h.ext = Y; h.maxOff = 0; }
    return;
  }
  if (h.dir === -1){
    if (Y < h.ext) h.ext = Y;
    else if (Y > h.ext + hy){ finish(h.anchor - h.ext); h.anchor = h.ext; h.dir = 1; h.ext = Y; }
  } else {
    if (Y > h.ext) h.ext = Y;
    else if (Y < h.ext - hy){ finish(h.ext - h.anchor); h.anchor = h.ext; h.dir = -1; h.ext = Y; }
  }
}
export {OFFSET_K, makeHand, updateHand};
