"""Поиск бесшовного цикла в стабилизированном ролике.

Кадры уменьшаются до 64×64 в градациях серого; первые 2 секунды пропускаются
(камера выставляет экспозицию). Среди пар (s, e) с длиной 5…12 секунд выбирается
пара с минимальной MSE между кадрами s и e — конец такого отрезка совпадает с началом.

Печатает JSON {"start", "end", "mse"}.
"""
import json
import sys

import cv2
import numpy as np

SIZE = 64
SKIP_SECONDS = 2.0
MIN_LEN = 5.0
MAX_LEN = 12.0


def find_loop(path: str) -> dict:
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frames = []

    while True:
        ok, frame = cap.read()
        if not ok:
            break
        small = cv2.resize(frame, (SIZE, SIZE))
        gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY).astype(np.float32)
        frames.append(gray)

    cap.release()

    if len(frames) < int((SKIP_SECONDS + MIN_LEN) * fps):
        raise SystemExit("ролик слишком короткий для цикла")

    skip = int(SKIP_SECONDS * fps)
    min_frames = int(MIN_LEN * fps)
    max_frames = min(int(MAX_LEN * fps), len(frames) - 1)

    best = None
    for start in range(skip, len(frames) - min_frames):
        base = frames[start]
        for end in range(start + min_frames, min(start + max_frames, len(frames))):
            mse = float(np.mean((base - frames[end]) ** 2))
            if best is None or mse < best["mse"]:
                best = {"start": start / fps, "end": end / fps, "mse": mse}

    if best is None:
        raise SystemExit("не удалось подобрать цикл")

    return {"start": round(best["start"], 3), "end": round(best["end"], 3), "mse": round(best["mse"], 2)}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "нужен путь к видео"}))
        sys.exit(2)
    try:
        print(json.dumps(find_loop(sys.argv[1])))
    except SystemExit as error:
        print(json.dumps({"error": str(error)}))
        sys.exit(1)
