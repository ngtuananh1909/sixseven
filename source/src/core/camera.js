/** Shared camera ownership: never leave more than one active MediaStream. */
export class CameraManager {
  constructor(video, { onLost = () => {} } = {}) {
    this.video = video;
    this.onLost = onLost;
    this.stream = null;
    this.deviceId = '';
    this.facing = 'user';
    this.mirrored = true;
    this.stopping = false;
    this.starting = null;
    this.generation = 0;
  }

  async open({ deviceId = this.deviceId, facing = this.facing } = {}) {
    if (this.starting) return this.starting;
    this.starting = this._open({deviceId, facing}).finally(() => { this.starting = null; });
    return this.starting;
  }

  async _open({deviceId, facing}) {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      throw Object.assign(new Error('Camera yêu cầu HTTPS và trình duyệt hỗ trợ getUserMedia.'), {name:'InsecureContextError'});
    }
    this.stop();
    const generation = this.generation;
    const video = {
      width: {ideal: 960}, height: {ideal: 720}, frameRate: {ideal: 24, max: 30},
      ...(deviceId ? { deviceId: {exact: deviceId} } : { facingMode: {ideal: facing} }),
    };
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({audio:false, video});
    } catch (e) {
      if (e.name !== 'OverconstrainedError' && e.name !== 'NotFoundError') throw e;
      // Retry without optional resolution/facing constraints on older cameras.
      stream = await navigator.mediaDevices.getUserMedia({audio:false, video:deviceId ? {deviceId:{exact:deviceId}} : true});
    }
    if(generation !== this.generation){stream.getTracks().forEach(t=>t.stop());throw Object.assign(new Error('Camera đã bị hủy.'),{name:'AbortError'});}
    const track = stream.getVideoTracks()[0];
    if (!track) { stream.getTracks().forEach(t=>t.stop()); throw new Error('Không tìm thấy luồng video.'); }
    this.stream = stream;
    this.deviceId = track.getSettings?.().deviceId || deviceId || '';
    this.facing = track.getSettings?.().facingMode || facing || 'user';
    // Front cameras are mirrored in UI; back cameras display normal orientation.
    this.mirrored = this.facing !== 'environment';
    this.video.style.transform = this.mirrored ? 'scaleX(-1)' : 'none';
    track.addEventListener('ended', () => { if (!this.stopping && this.stream === stream) this.onLost(); }, {once:true});
    this.video.srcObject = stream;
    try {
      await this.video.play();
      if (this.video.readyState < 2) await new Promise((resolve, reject) => {
        const tid = setTimeout(() => { cleanup(); reject(new Error('Camera không gửi được hình ảnh.')); }, 10000);
        const cleanup = () => { clearTimeout(tid); this.video.removeEventListener('loadeddata', ready); this.video.removeEventListener('error', failed); };
        const ready = () => { cleanup(); resolve(); };
        const failed = () => { cleanup(); reject(new Error('Không đọc được video camera.')); };
        this.video.addEventListener('loadeddata', ready);
        this.video.addEventListener('error', failed);
      });
    } catch (e) { this.stop(); throw e; }
    if(generation !== this.generation){this.stop();throw Object.assign(new Error('Camera đã bị hủy.'),{name:'AbortError'});}
    return this.list();
  }

  async list() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(d => d.kind === 'videoinput');
    } catch { return []; }
  }

  stop() {
    this.generation++;
    this.stopping = true;
    const stream = this.stream;
    this.stream = null;
    if (stream) stream.getTracks().forEach(t => t.stop());
    this.video.pause();
    this.video.srcObject = null;
    this.stopping = false;
  }
}

export function explainCameraError(error) {
  switch (error?.name) {
    case 'NotAllowedError': case 'PermissionDeniedError': case 'SecurityError':
      return 'Camera bị chặn. Hãy cấp quyền camera trong cài đặt trang web rồi thử lại.';
    case 'NotFoundError': case 'DevicesNotFoundError':
      return 'Không tìm thấy camera phù hợp. Hãy kiểm tra kết nối camera hoặc chọn camera khác.';
    case 'NotReadableError': case 'TrackStartError': case 'AbortError':
      return 'Camera đang bận hoặc bị hệ thống ngắt. Đóng ứng dụng khác đang dùng camera rồi thử lại.';
    case 'OverconstrainedError':
      return 'Camera không hỗ trợ cấu hình đã chọn. Hãy thử camera khác.';
    case 'InsecureContextError':
      return 'Trang cần chạy qua HTTPS (hoặc localhost) để dùng camera.';
    default:
      return error?.message ? `Không thể khởi động: ${error.message}` : 'Không mở được camera hoặc bộ nhận diện. Kiểm tra kết nối mạng rồi thử lại.';
  }
}
