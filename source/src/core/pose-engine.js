const VERSION = '0.10.14';
const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}`;
const MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

/** Single inference owner; caches 1- and 2-person detectors. */
export class PoseEngine {
  constructor() { this.models = new Map(); this.files = null; this.loader = null; this.active = null; this.lastVideoTime = -1; this.lastDetectAt = -Infinity; this.minInterval = 55; }
  async prepare(numPoses, status = () => {}) {
    if (!this.loader) {
      this.loader = (async () => {
        status('Đang tải MediaPipe…');
        const lib = await import(`${CDN}/vision_bundle.mjs`);
        const files = await lib.FilesetResolver.forVisionTasks(`${CDN}/wasm`);
        return {PoseLandmarker:lib.PoseLandmarker, files};
      })().catch(e => { this.loader = null; throw e; });
    }
    const {PoseLandmarker, files} = await this.loader;
    if (!this.models.has(numPoses)) {
      status(`Đang khởi tạo nhận diện ${numPoses} người…`);
      const create = delegate => PoseLandmarker.createFromOptions(files, {
        baseOptions: {modelAssetPath: MODEL, delegate}, runningMode:'VIDEO', numPoses,
        minPoseDetectionConfidence:.5, minPosePresenceConfidence:.5, minTrackingConfidence:.5,
      });
      const promise = create('GPU').catch(() => create('CPU'));
      this.models.set(numPoses, promise);
      try { await promise; } catch (e) { this.models.delete(numPoses); throw e; }
    }
    this.active = await this.models.get(numPoses);
    this.lastVideoTime = -1;
    this.lastDetectAt = -Infinity;
  }
  detect(video, now) {
    if (!this.active || video.readyState < 2 || !video.videoWidth) return {updated:false, landmarks:[]};
    // No repeated inference on the same camera frame and no need for 60+ FPS on phones.
    if (video.currentTime === this.lastVideoTime || now - this.lastDetectAt < this.minInterval) return {updated:false, landmarks:[]};
    this.lastVideoTime = video.currentTime;
    this.lastDetectAt = now;
    try {
      const out = this.active.detectForVideo(video, now);
      return {updated:true, landmarks:out.landmarks || []};
    } catch (e) { console.warn('Pose inference failed', e); return {updated:true, landmarks:[]}; }
  }
  reset() { this.lastVideoTime = -1; this.lastDetectAt = -Infinity; }
  deactivate() { this.active = null; this.reset(); }
}
