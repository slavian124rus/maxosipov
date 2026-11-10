"""Поиск людей на неподвижных кадрах — для подготовки фото тренажёров каталога.

Запуск: python media-tools/people.py <каталог с фото> <out.json>
Модели: MODEL_PATH (поза; по умолчанию /opt/mt/models/pose_landmarker_heavy.task)
        FACE_MODEL_PATH (лица; не задан — этот сигнал пропускаем)
        MIN_CONFIDENCE (порог детекции, по умолчанию 0.3)

Для каждого файла отдаёт габариты кадра и рамки людей в пикселях
(`{"left": x, "top": y, "width": w, "height": h}`) — по позе (`people`)
и по лицам (`faces`, с запасом на тело). Рамка позы строится по видимым точкам
(visibility >= MIN_VISIBILITY) с запасом PADDING, чтобы в неё попали одежда и
снаряд в руках. Люди в зеркалах моделью тоже находятся: отражение выглядит как поза.

Инструмент не гарантирует, что найдёт всех (человек далеко, закрыт тренажёром,
в кадре только часть тела), поэтому его вывод — подсказка для кропа, а не
окончательное решение: итоговые кадры смотрит человек.
"""

import json
import os
import sys

import cv2
import numpy as np

MODEL_PATH = os.environ.get("MODEL_PATH", "/opt/mt/models/pose_landmarker_heavy.task")
FACE_MODEL_PATH = os.environ.get("FACE_MODEL_PATH")
MIN_CONFIDENCE = float(os.environ.get("MIN_CONFIDENCE", "0.3"))

MIN_VISIBILITY = 0.3
MAX_PEOPLE = 8
PADDING = 0.06  # доля размера рамки позы во все стороны
FACE_PADDING = 0.9  # лицо → габариты человека: запас примерно в рост тела

IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp")


def _clamp_box(left: float, top: float, right: float, bottom: float, w: int, h: int) -> dict:
    left = max(0.0, min(left, float(w)))
    top = max(0.0, min(top, float(h)))
    right = max(left, min(right, float(w)))
    bottom = max(top, min(bottom, float(h)))

    return {
        "left": int(left),
        "top": int(top),
        "width": int(right - left),
        "height": int(bottom - top),
    }


def pose_boxes(image: "np.ndarray", landmarker) -> list[dict]:
    """Рамки людей по позе, в пикселях."""
    import mediapipe as mp

    height, width = image.shape[:2]
    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    result = landmarker.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb))

    boxes: list[dict] = []
    for landmarks in result.pose_landmarks:
        points = [(p.x, p.y) for p in landmarks if p.visibility >= MIN_VISIBILITY]
        if not points:
            continue

        xs = [p[0] for p in points]
        ys = [p[1] for p in points]
        pad_x = (max(xs) - min(xs)) * PADDING
        pad_y = (max(ys) - min(ys)) * PADDING

        boxes.append(
            _clamp_box(
                (min(xs) - pad_x) * width,
                (min(ys) - pad_y) * height,
                (max(xs) + pad_x) * width,
                (max(ys) + pad_y) * height,
                width,
                height,
            )
        )

    return boxes


def face_boxes(image: "np.ndarray", detector) -> list[dict]:
    """Рамки людей, найденных по лицу (лицо + запас на тело)."""
    import mediapipe as mp

    height, width = image.shape[:2]
    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    result = detector.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb))

    boxes: list[dict] = []
    for detection in result.detections:
        box = detection.bounding_box
        pad = max(box.width, box.height) * FACE_PADDING

        boxes.append(
            _clamp_box(
                box.origin_x - pad,
                box.origin_y - pad,
                box.origin_x + box.width + pad,
                box.origin_y + box.height + pad * 2.5,
                width,
                height,
            )
        )

    return boxes



def main() -> None:
    if len(sys.argv) < 3:
        print(json.dumps({"error": "нужно: people.py <каталог> <out.json>"}))
        raise SystemExit(2)

    from mediapipe.tasks import python as mp_python
    from mediapipe.tasks.python import vision

    source_dir, out_path = sys.argv[1], sys.argv[2]

    landmarker = vision.PoseLandmarker.create_from_options(
        vision.PoseLandmarkerOptions(
            base_options=mp_python.BaseOptions(model_asset_path=MODEL_PATH),
            running_mode=vision.RunningMode.IMAGE,
            num_poses=MAX_PEOPLE,
            min_pose_detection_confidence=MIN_CONFIDENCE,
        )
    )

    detector = None
    if FACE_MODEL_PATH and os.path.exists(FACE_MODEL_PATH):
        detector = vision.FaceDetector.create_from_options(
            vision.FaceDetectorOptions(
                base_options=mp_python.BaseOptions(model_asset_path=FACE_MODEL_PATH),
                running_mode=vision.RunningMode.IMAGE,
                min_detection_confidence=MIN_CONFIDENCE,
            )
        )

    report: dict = {}
    names = sorted(n for n in os.listdir(source_dir) if n.lower().endswith(IMAGE_EXTENSIONS))

    for name in names:
        image = cv2.imread(os.path.join(source_dir, name))
        if image is None:
            report[name] = {"error": "не прочиталось"}
            continue

        height, width = image.shape[:2]
        poses = pose_boxes(image, landmarker)
        faces = face_boxes(image, detector) if detector else []
        report[name] = {"width": width, "height": height, "people": poses, "faces": faces}
        print(f"{name}: поза {len(poses)}, лица {len(faces)}", file=sys.stderr)

    landmarker.close()
    if detector:
        detector.close()

    with open(out_path, "w", encoding="utf-8") as handle:
        json.dump(report, handle, ensure_ascii=False, indent=2)

    print(json.dumps({"ok": True, "files": len(report), "out": out_path}))


if __name__ == "__main__":
    main()
