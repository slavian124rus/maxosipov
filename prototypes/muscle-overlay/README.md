# Проба «мышцы на видео» (2026-11-07) — эталон, не продакшн-код

Рабочая проба на ролике тяги верхнего блока. Используется как образец для этапа 2 (задача «Мышцы на видео»).

- `pose.py` — MediaPipe Pose Landmarker (модель `pose_landmarker_heavy.task`, VIDEO-режим, `output_segmentation_masks=True`)
  → `lp_pose.npz` (`P`: кадры×33×[x,y,visibility] в долях кадра; `M`: маски силуэта 0..1).
- `render.py` — рисует широчайшие (профиль `pull_vertical`) и бицепс по точкам + маске, интенсивность по углу в локте,
  пишет H.264 через ffmpeg.

Запуск (Python 3.11+): `pip install mediapipe opencv-python-headless scipy numpy`,
модель: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task`
→ `models/pose_heavy.task`; `python pose.py <видео> lp_pose.npz && python render.py`.

Пути внутри скриптов — от пробы (`demo/assets/...`), при переносе в проект параметризовать.
Наблюдения: при съёмке сбоку MediaPipe путает «левое/правое» — видимую руку выбирать по `visibility`, а не по номеру точки.
