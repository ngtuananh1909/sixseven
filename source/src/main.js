import {CameraManager, explainCameraError} from './core/camera.js';
import {PoseEngine} from './core/pose-engine.js';
import {GameLoop} from './core/game-loop.js';
import {CameraView} from './core/coordinates.js';
import {TimerBag} from './core/timers.js';
import {createAudioManager} from './shared/audio.js';
import {saveCanvas} from './shared/snapshot.js';
import {createCameraControls} from './components/camera-controls.js';

const $=id=>document.getElementById(id);
const video=document.createElement('video');video.id='cam';video.autoplay=true;video.muted=true;video.playsInline=true;video.setAttribute('playsinline','');
const canvas=document.createElement('canvas');canvas.id='fx';
$('mediaParking').append(video,canvas);
const camera=new CameraManager(video,{onLost:onCameraLost});
const view=new CameraView(video,canvas,camera);
const engine=new PoseEngine();
const runner=new GameLoop(engine,video);
const audio=createAudioManager();
const assets={
  pose:{name:'POSE BATTLE', css:'./src/games/pose/pose.css', template:()=>import('./games/pose/template.js'), game:()=>import('./games/pose/pose-game.js')},
  pump:{name:'PUMP CHALLENGE', css:'./src/games/pump/pump.css', template:()=>import('./games/pump/template.js'), game:()=>import('./games/pump/pump-game.js')},
};
let mode=null,game=null,style=null,opening=false,operation=0;

function openMessage(message) {$('deviceLostText').textContent=message;$('deviceLost').hidden=false;runner.setPause(true);}
function onCameraLost(){if(mode)openMessage('Camera vừa bị hệ thống ngắt. Kiểm tra quyền truy cập hoặc thử mở lại camera.');}
const controls=createCameraControls({camera,onSwitch:changeCamera});
function updateURL(newMode){
  const u=new URL(location.href);
  if(newMode)u.searchParams.set('game',newMode);else u.searchParams.delete('game');
  history.replaceState(null,'',u.pathname+u.search+u.hash);
}

function deactivate(){
  operation++;
  runner.unmount();
  runner.setPause(document.hidden);
  game?.destroy?.();game=null;
  camera.stop();
  controls.close();
  $('deviceLost').hidden=true;
  if(style){style.remove();style=null;}
  $('gameMount').replaceChildren();
  $('mediaParking').append(video,canvas);
  view.resize();
  mode=null;
}
function goHome(){deactivate();$('home').hidden=false;$('gameMount').hidden=true;$('gameNav').hidden=true;document.title='Six Seven — Camera Game Hub';updateURL(null);}

async function openGame(which){
  if(!assets[which]||opening)return;
  opening=true;
  deactivate();
  const ticket=operation;
  mode=which;
  $('home').hidden=true;$('gameMount').hidden=false;$('gameNav').hidden=false;
  document.title=assets[which].name+' — Six Seven';
  updateURL(which);
  try{
    const [markup,engineModule]=await Promise.all([assets[which].template(),assets[which].game()]);
    if(ticket!==operation)return;
    style=document.createElement('link');style.rel='stylesheet';style.href=assets[which].css;document.head.appendChild(style);
    await new Promise((res,rej)=>{style.onload=res;style.onerror=()=>rej(new Error('Không tải được CSS'));});
    if(ticket!==operation)return;
    const root=document.createElement('div');root.className='game';root.dataset.mode=which;root.innerHTML=markup.template;
    $('gameMount').replaceChildren(root);
    const stage=root.querySelector('#stage');
    stage.insertBefore(video,stage.firstChild);
    stage.insertBefore(canvas,video.nextSibling);
    view.resize();
    const timers=new TimerBag();
    const listeners=[];
    const api={
      root,camera,view,engine,audio,timers,
      explainError:explainCameraError,
      listen(target,event,listener){target.addEventListener(event,listener);listeners.push(()=>target.removeEventListener(event,listener));},
      async prepare(people,status){
        // Opening camera is initiated from a user click on the game's start button.
        status('Đang mở camera…');
        await camera.open();
        if(!mode || !root.isConnected){camera.stop();throw new Error('Trò chơi đã được đóng.');}
        await controls.refresh();
        status('Đang tải bộ nhận diện cơ thể…');
        await engine.prepare(people,status);
        if(!mode || !root.isConnected) {camera.stop();throw new Error('Trò chơi đã được đóng.');}
        view.resize();
      },
      activate(update){if(mode && root.isConnected && game?.update===update)runner.mount(game);},
      save:async (cv,name)=>{try{await saveCanvas(cv,name);}catch(e){openMessage('Không lưu được ảnh: '+e.message);}},
    };
    game=which==='pose'?engineModule.createPoseGame(api):engineModule.createPumpGame(api);
    const originalDestroy=game.destroy;
    game.destroy=()=>{originalDestroy?.();listeners.forEach(off=>off());timers.clearAll();};
  }catch(e){if(ticket===operation){console.error(e);goHome();alert('Không mở được trò chơi: '+e.message);}}
  finally{opening=false;}
}

async function changeCamera(opts){
  if(!mode||!game||!runner.game)throw new Error('Hãy bật camera trong trò chơi trước khi đổi thiết bị.');
  const previousHidden=$('deviceLost').hidden;
  if(!opts.mirrorOnly){
    runner.setPause(true);
    try {await camera.open(opts);await controls.refresh();view.resize();engine.reset();}
    catch(e){openMessage(explainCameraError(e));throw e;}
  }
  game.restart();
  $('deviceLost').hidden=true;
  runner.setPause(document.hidden);
  if(previousHidden===false)controls.close();
}

$('backHome').addEventListener('click',goHome);
for(const button of document.querySelectorAll('[data-game]'))button.addEventListener('click',()=>openGame(button.dataset.game));
$('cameraRetry').addEventListener('click',async()=>{
  try{
    await changeCamera({deviceId:'',facing:camera.facing});
  }catch(e){$('deviceLostText').textContent=explainCameraError(e);}
});
$('cameraGoHome').addEventListener('click',goHome);
window.addEventListener('pagehide',()=>camera.stop());
window.addEventListener('pageshow',e=>{if(e.persisted&&mode)openMessage('Trang đã được khôi phục. Hãy mở lại camera để chơi tiếp.');});
window.addEventListener('popstate',()=>{const m=new URL(location.href).searchParams.get('game');if(m&&assets[m])openGame(m);else goHome();});
const direct=new URL(location.href).searchParams.get('game');
if(direct&&assets[direct])openGame(direct);
