export class CameraView {
  constructor(video, canvas, camera) {
    this.video=video; this.canvas=canvas; this.camera=camera;
    this.ctx=canvas.getContext('2d'); this.W=0; this.H=0; this.DPR=1;
    this.resize();
    window.addEventListener('resize', ()=>this.resize());
    window.visualViewport?.addEventListener('resize', ()=>this.resize());
  }
  resize() {
    this.DPR = Math.min(window.devicePixelRatio || 1, 2);
    this.W = this.canvas.clientWidth; this.H = this.canvas.clientHeight;
    this.canvas.width = Math.round(this.W * this.DPR);
    this.canvas.height = Math.round(this.H * this.DPR);
    this.ctx.setTransform(this.DPR,0,0,this.DPR,0,0);
  }
  toScreen(p) {
    const vw=this.video.videoWidth||960, vh=this.video.videoHeight||720;
    const s=Math.max(this.W/vw,this.H/vh),dw=vw*s,dh=vh*s,ox=(this.W-dw)/2,oy=(this.H-dh)/2;
    let x=p.x*dw+ox;
    if(this.camera.mirrored) x=this.W-x;
    return {x,y:p.y*dh+oy,v:p.visibility??1};
  }
  drawSnapshot(canvas) {
    const vw=this.video.videoWidth,vh=this.video.videoHeight;
    if(!vw||!vh)return;
    const c=canvas.getContext('2d'),tw=canvas.width,th=canvas.height;
    const s=Math.max(tw/vw,th/vh),dw=vw*s,dh=vh*s;
    c.save();
    if(this.camera.mirrored){c.translate(tw,0);c.scale(-1,1);}
    c.drawImage(this.video,(tw-dw)/2,(th-dh)/2,dw,dh);
    c.restore();
  }
}
