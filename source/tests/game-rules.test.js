import test from 'node:test';
import assert from 'node:assert/strict';
import {POSES,buildSkeleton,scorePerson} from '../src/games/pose/pose-rules.js';
import {makeHand,updateHand,OFFSET_K} from '../src/games/pump/hand-tracker.js';
import {TimerBag} from '../src/core/timers.js';

test('all 10 original Pose pairs score perfectly for their target skeletons',()=>{
  assert.equal(POSES.length,10);
  for(const pose of POSES)for(const target of pose.t){
    const sk=buildSkeleton(target,250,100,75);
    const L=Array.from({length:33},(_,i)=>({...sk[i],v:1}));
    const {score}=scorePerson(L,target);
    assert.ok(score>=.9999,`${pose.name}: ${score}`);
  }
});

test('Pose scores penalize missing arm segments, while optional hidden legs are ignored',()=>{
  const target=POSES[0].t[0],sk=buildSkeleton(target,250,100,75);
  const L=Array.from({length:33},(_,i)=>({...sk[i],v:1}));
  for(const k of [25,26,27,28])L[k].v=0;
  assert.ok(scorePerson(L,target).score>.99);
  L[15].v=0;
  assert.ok(scorePerson(L,target).score<.9);
});

test('Pump hand tracker counts full, opposite-height strokes only',()=>{
  const strokes=[],levels=[],small=[];
  const cb={stroke:n=>strokes.push(n),level:()=>levels.push(true),small:()=>small.push(true)};
  const h=makeHand(),S=100;
  for(const y of [200,185,165,135,105,95,115,150,185,205,165,125,90,120])updateHand(h,60,y,280,S,cb);
  assert.ok(strokes.length>=1,'one or more valid pumps');
  assert.ok(strokes.every(n=>n>=S*.38));
  assert.equal(OFFSET_K,.4);
});

test('Pump hand tracker rejects strokes if opposite hand is at same height',()=>{
  const strokes=[],levels=[];const h=makeHand();
  for(const y of [200,180,150,110,80,100,140,175,210,180,135,85,105]){
    updateHand(h,60,y,y,100,{stroke:n=>strokes.push(n),level:()=>levels.push(true),small:()=>{}});
  }
  assert.equal(strokes.length,0);
});

test('TimerBag can clear pending timers when changing game mode',async()=>{
  const bag=new TimerBag();let fired=false;
  bag.setTimeout(()=>fired=true,20);bag.clearAll();
  await new Promise(resolve=>setTimeout(resolve,35));
  assert.equal(fired,false);
});

test('Pose game rule requires 7 correct poses to win',async()=>{
  const {createPoseGame}=await import('../src/games/pose/pose-game.js');
  const {template}=await import('../src/games/pose/template.js');
  assert.match(createPoseGame.toString(),/NEED_WINS\s*=\s*7/);
  assert.ok(template.includes('7 dáng chuẩn để thắng'));
  assert.ok(template.includes('Đủ 7 dáng là thắng'));
});

test('Pump game rule requires 250 points and meter selector is direct',async()=>{
  const {createPumpGame}=await import('../src/games/pump/pump-game.js');
  const {template}=await import('../src/games/pump/template.js');
  const code=createPumpGame.toString();
  assert.match(code,/GOAL\s*=\s*250/);
  assert.ok(!code.includes("$('meter').querySelector('i')"), 'must not query selector i inside #meter');
  assert.ok(template.includes('MỤC TIÊU <b>250</b>'));
  assert.ok(template.includes('Chạm 250 điểm'));
  assert.ok(template.includes('250 điểm trong 20 giây'));
});

