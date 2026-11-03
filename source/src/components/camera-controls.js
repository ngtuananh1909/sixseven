import {explainCameraError} from '../core/camera.js';

export function createCameraControls({camera, onSwitch}) {
  const panel=document.getElementById('cameraPanel');
  const choose=document.getElementById('cameraSelect');
  const info=document.getElementById('cameraInfo');
  const menu=document.getElementById('cameraMenu');
  const flip=document.getElementById('flipCamera');
  const reverse=document.getElementById('mirrorCamera');
  let changing=false;
  menu.addEventListener('click',async()=>{
    panel.hidden=!panel.hidden;
    if (!panel.hidden) await refresh();
  });
  document.getElementById('closeCameraPanel').addEventListener('click',()=>panel.hidden=true);
  async function refresh() {
    const devices=await camera.list();
    choose.replaceChildren(new Option('Tự động / camera mặc định',''));
    devices.forEach((d,i)=>choose.add(new Option(d.label||`Camera ${i+1}`,d.deviceId)));
    choose.value=camera.deviceId||'';
    if(choose.selectedIndex<0)choose.value='';
    info.textContent=devices.length?'Bạn có thể chọn camera khác. Đổi camera sẽ khởi động lại lượt chơi.':'Hãy bật camera trong trò chơi trước để xem danh sách thiết bị.';
    reverse.textContent=camera.mirrored?'Tắt lật gương':'Bật lật gương';
  }
  async function apply(opts) {
    if(changing)return;
    changing=true;choose.disabled=true;flip.disabled=true;
    info.textContent='Đang đổi camera…';
    try {await onSwitch(opts);await refresh();info.textContent='Camera đã sẵn sàng. Lượt chơi được khởi động lại.';}
    catch(e){info.textContent=explainCameraError(e);}
    finally{changing=false;choose.disabled=false;flip.disabled=false;}
  }
  choose.addEventListener('change',()=>apply({deviceId:choose.value,facing:camera.facing}));
  flip.addEventListener('click',()=>apply({deviceId:'',facing:camera.facing==='user'?'environment':'user'}));
  reverse.addEventListener('click',()=>{
    if(!camera.stream){info.textContent='Hãy bật camera trước khi đổi hiển thị gương.';return;}
    camera.mirrored=!camera.mirrored;
    camera.video.style.transform=camera.mirrored?'scaleX(-1)':'none';
    reverse.textContent=camera.mirrored?'Tắt lật gương':'Bật lật gương';
    info.textContent='Đã đổi hiển thị gương. Lượt chơi sẽ được hiệu chỉnh lại.';
    onSwitch({mirrorOnly:true}).catch(e=>info.textContent=explainCameraError(e));
  });
  return {refresh,close(){panel.hidden=true;}};
}
