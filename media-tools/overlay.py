"""Рисует подсветку мышц по точкам позы и маске силуэта.

Запуск: python overlay.py <видео> <pose.npz> <profile> <out.mp4>
Коды выхода: 0 — успех, 3 — поза найдена менее чем на 90% кадров (файл не пишем).
"""
import json
import subprocess
import sys

import cv2
import numpy as np

import profiles as P

MIN_DETECTED = 0.9
FPS_FALLBACK = 30.0


def ensure_detected(points: np.ndarray) -> None:
    """Проверяет, что поза найдена почти на всех кадрах."""
    valid = ~np.isnan(points[:, 0, 0])
    share = float(valid.mean()) if len(points) else 0.0
    if share < MIN_DETECTED:
        print(json.dumps({"error": "поза найдена не на всех кадрах", "detected": round(share, 3)}))
        raise SystemExit(3)


def compose_frame(
    frame: np.ndarray,
    mask: np.ndarray,
    points: np.ndarray,
    xx: np.ndarray,
    yy: np.ndarray,
    intensity: float,
    profile: str,
) -> np.ndarray:
    axes = P.body_axes(points)
    lat = P.lat_band(points, mask, xx, yy, axes, profile)

    # Волокна вдоль хода мышцы.
    direction = axes.v + axes.nrm * 0.55
    direction = direction / (np.linalg.norm(direction) or 1.0)
    along = np.array([-direction[1], direction[0]])
    rx = xx - axes.shoulder[0]
    ry = yy - axes.shoulder[1]
    fibers = 0.9 + 0.1 * np.sin((rx * along[0] + ry * along[1]) / 2.6)

    # Капсула плеча: под ней не светим, бицепс — её передняя часть.
    arm = P.visible_arm(np.expand_dims(points, 0))
    shoulder_idx, elbow_idx = (P.L_SHOULDER, P.L_ELBOW) if arm == "left" else (P.R_SHOULDER, P.R_ELBOW)
    shoulder = points[shoulder_idx]
    elbow = points[elbow_idx]
    arm_length = float(np.linalg.norm(elbow - shoulder)) or 1.0
    arm_cap, tt = P.capsule(xx, yy, shoulder, elbow, arm_length * 0.17)
    lat = lat * ~arm_cap

    ab = elbow - shoulder
    side = (xx - shoulder[0]) * (-ab[1]) + (yy - shoulder[1]) * ab[0]
    front = points[P.NOSE][:2] - axes.shoulder
    front_sign = np.sign(front[0] * (-ab[1]) + front[1] * ab[0])
    biceps = (arm_cap & (tt > 0.18) & (tt < 0.9) & (side * front_sign > -arm_length * 0.03)).astype(
        np.float32
    ) * np.clip(mask, 0, 1)

    core = cv2.GaussianBlur(lat, (0, 0), 4) * fibers
    dilated = cv2.dilate((mask > 0.4).astype(np.uint8), np.ones((25, 25), np.uint8)).astype(np.float32)
    halo = cv2.GaussianBlur(lat, (0, 0), 18) * cv2.GaussianBlur(dilated, (0, 0), 8)
    secondary = cv2.GaussianBlur(biceps, (0, 0), 5)

    out = frame.astype(np.float32) * (0.62 + 0.38 * mask)[..., None]
    luminance = out.mean(-1, keepdims=True)

    alpha = (core * (0.30 + 0.55 * intensity))[..., None]
    out = out * (1 - alpha) + (np.maximum(luminance, 40) * 0.35 + P.RED * 0.85) * alpha

    alpha_secondary = (secondary * (0.30 + 0.45 * intensity))[..., None]
    out = out * (1 - alpha_secondary) + (
        np.maximum(luminance, 40) * 0.3 + P.SOFT * 0.8
    ) * alpha_secondary

    out = out + (halo * (0.25 + 0.55 * intensity))[..., None] * P.RED * 0.55
    return np.clip(out, 0, 255).astype(np.uint8)


def main() -> None:
    if len(sys.argv) < 5:
        print(json.dumps({"error": "нужно: overlay.py <видео> <pose.npz> <profile> <out.mp4>"}))
        raise SystemExit(2)

    video, pose_path, profile, out_path = sys.argv[1:5]

    data = np.load(pose_path)
    points_all = data["P"].astype(np.float32)
    masks = data["M"]
    fps = float(data["fps"]) if "fps" in data else FPS_FALLBACK

    ensure_detected(points_all)

    cap = cv2.VideoCapture(video)
    frames = []
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        frames.append(frame)
    cap.release()

    if not frames:
        print(json.dumps({"error": "видео пустое"}))
        raise SystemExit(1)

    height, width = frames[0].shape[:2]
    xy = points_all[:, :, :2] * np.array([width, height], np.float32)
    xy = P.smooth_points(xy)

    angles = P.elbow_angles(xy, P.visible_arm(points_all))
    intensity = P.intensity_from_angles(angles)

    yy, xx = np.mgrid[0:height, 0:width].astype(np.float32)

    writer = subprocess.Popen(
        [
            "ffmpeg",
            "-v",
            "error",
            "-y",
            "-f",
            "rawvideo",
            "-pix_fmt",
            "bgr24",
            "-s",
            f"{width}x{height}",
            "-r",
            str(fps),
            "-i",
            "-",
            "-c:v",
            "libx264",
            "-preset",
            "slow",
            "-crf",
            "24",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            out_path,
        ],
        stdin=subprocess.PIPE,
    )

    count = min(len(frames), len(points_all))
    for index in range(count):
        mask = masks[index].astype(np.float32)
        if mask.ndim == 3:
            mask = mask[..., 0]
        mask = cv2.GaussianBlur(mask, (0, 0), 1.5)

        composed = compose_frame(
            frames[index], mask, points_all[index], xx, yy, float(intensity[index]), profile
        )
        writer.stdin.write(composed.tobytes())

    writer.stdin.close()
    writer.wait()

    print(json.dumps({"ok": True, "frames": count, "profile": profile}))


if __name__ == "__main__":
    main()
