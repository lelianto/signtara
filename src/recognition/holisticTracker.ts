import { FaceLandmarker, FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { headAngles, pickBlendshapes, type HolisticRaw } from './holistic';

/**
 * Body pose + face (blendshapes, head rotation) for word recognition. Runs next to the hand
 * tracker on the same video frame and timestamp; hands come from TwoHandTracker.
 * Model files are local (public/models), Apache-2.0, see public/models/manifest.json.
 */
export class HolisticTracker {
  private closed = false;
  private constructor(private pose: PoseLandmarker, private face: FaceLandmarker | null) {}

  static async create() {
    const files = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
    const pose = await PoseLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: '/models/pose_landmarker_lite.task', delegate: 'CPU' },
      runningMode: 'VIDEO', numPoses: 1,
    });
    let face: FaceLandmarker | null = null;
    try {
      face = await FaceLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate: 'CPU' },
        runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true,
      });
    } catch { /* Face cues are optional; the model treats a missing face as facePresent = 0. */ }
    return new HolisticTracker(pose, face);
  }

  get hasFace() { return this.face !== null; }

  detect(source: HTMLVideoElement, now: number): Pick<HolisticRaw, 'pose' | 'blend' | 'head'> {
    if (this.closed) throw Error('Holistic tracker closed');
    const p = this.pose.detectForVideo(source, now).landmarks[0];
    const f = this.face?.detectForVideo(source, now);
    const categories = f?.faceBlendshapes?.[0]?.categories;
    const matrix = f?.facialTransformationMatrixes?.[0]?.data;
    return {
      pose: p ? p.map((q) => ({ x: q.x, y: q.y, z: q.z, visibility: q.visibility })) : null,
      blend: categories ? pickBlendshapes(categories) : null,
      head: matrix ? headAngles(matrix) : null,
    };
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.pose.close();
    this.face?.close();
  }
}
