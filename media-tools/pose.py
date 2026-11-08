"""MediaPipe Pose Landmarker → точки позы и маска силуэта.

Запуск: python pose.py <видео> <out.npz>
Модель: MODEL_PATH или /opt/mt/models/pose_landmarker_heavy.task.
"""
import json
import os
import sys

import cv2
import numpy as np

MODEL_PATH = os.environ.get("MODEL_PATH", "/opt/mt/models/pose_landmarker_heavy.task")


def main() -> None:
    if len(sys.argv) < 3:
        print(json.dumps({"error": "нужно: pose.py <видео> <out.npz>"}))
        raise SystemExit(2)

    import mediapipe as mp
    from mediapipe.tasks import python as mp_python
    from mediapipe.tasks.python import vision

    src, out_path = sys.argv[1], sys.argv[2]

    options = vision.PoseLandmarkerOptions(
        base_options=mp_python.BaseOptions(model_asset_path=MODEL_PATH),
        running_mode=vision.RunningMode.VIDEO,
        output_segmentation_masks=True,
        num_poses=1,
        min_pose_detection_confidence=0.4,
        min_tracking_confidence=0.4,
    )
    landmarker = vision.PoseLandmarker.create_from_options(options)

    cap = cv2.VideoCapture(src)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0

    points = []
    masks = []
    index = 0

    while True:
        ok, frame = cap.read()
        if not ok:
            break

        image = mp.Image(
            image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        )
        result = landmarker.detect_for_video(image, int(index * 1000 / fps))

        if result.pose_landmarks:
            points.append([[p.x, p.y, p.visibility] for p in result.pose_landmarks[0]])
            mask = result.segmentation_masks[0].numpy_view()
            if mask.ndim == 3:
                mask = mask[..., 0]
            masks.append(mask.astype(np.float16))
        else:
            points.append(np.full((33, 3), np.nan).tolist())
            masks.append(np.zeros(frame.shape[:2], np.float16))

        index += 1

    cap.release()

    np.savez_compressed(out_path, P=np.array(points), M=np.array(masks), fps=fps)

    detected = int(np.sum(~np.isnan(np.array(points)[:, 0, 0]))) if points else 0
    print(json.dumps({"ok": True, "frames": index, "detected": detected}))


if __name__ == "__main__":
    main()
