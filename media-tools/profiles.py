"""Профили подсветки мышц на видео (DESIGN.md §6.5, ARCHITECTURE.md §13).

Точки MediaPipe (33): 0 — нос, 11/12 — плечи, 13/14 — локти, 15/16 — запястья,
23/24 — таз. Всё считается в пикселях кадра; маска силуэта — 0..1.
"""
from dataclasses import dataclass

import numpy as np
from scipy.ndimage import gaussian_filter1d

NOSE, L_SHOULDER, R_SHOULDER = 0, 11, 12
L_ELBOW, R_ELBOW, L_WRIST, R_WRIST = 13, 14, 15, 16
L_HIP, R_HIP = 23, 24

RED = np.array([48, 59, 255], dtype=np.float32)  # BGR
SOFT = np.array([128, 138, 255], dtype=np.float32)


@dataclass
class Axes:
    """Оси тела: S — центр плеч, v — вниз к тазу, nrm — к спине, L — длина туловища."""

    shoulder: np.ndarray
    v: np.ndarray
    nrm: np.ndarray
    length: float


def visible_arm(points: np.ndarray) -> str:
    """Съёмка сбоку путает лево/право — берём руку с большей видимостью."""
    left = float(np.nanmean(points[:, [L_ELBOW, L_WRIST], 2]))
    right = float(np.nanmean(points[:, [R_ELBOW, R_WRIST], 2]))
    return "left" if left >= right else "right"


def smooth_points(points: np.ndarray) -> np.ndarray:
    return gaussian_filter1d(points, 1.6, axis=0, mode="wrap")


def elbow_angles(xy: np.ndarray, arm: str) -> np.ndarray:
    shoulder, elbow, wrist = (
        (L_SHOULDER, L_ELBOW, L_WRIST) if arm == "left" else (R_SHOULDER, R_ELBOW, R_WRIST)
    )
    v1 = xy[:, shoulder] - xy[:, elbow]
    v2 = xy[:, wrist] - xy[:, elbow]
    cos = (v1 * v2).sum(-1) / (np.linalg.norm(v1, axis=-1) * np.linalg.norm(v2, axis=-1))
    return np.degrees(np.arccos(np.clip(cos, -1, 1)))


def intensity_from_angles(angles: np.ndarray) -> np.ndarray:
    """Свечение: 0.22 в покое, 1.0 в момент максимального сгибания (smoothstep)."""
    smooth = gaussian_filter1d(angles, 2, mode="wrap")
    span = float(smooth.max() - smooth.min())
    f = np.zeros_like(smooth) if span == 0 else (smooth.max() - smooth) / span
    return 0.22 + 0.78 * (f * f * (3 - 2 * f))


def body_axes(points: np.ndarray) -> Axes:
    shoulder = ((points[L_SHOULDER] + points[R_SHOULDER]) / 2)[:2]
    hip = ((points[L_HIP] + points[R_HIP]) / 2)[:2]
    v = hip - shoulder
    length = float(np.linalg.norm(v)) or 1.0
    v = v / length
    nrm = np.array([-v[1], v[0]])

    # Нормаль должна смотреть от носа — то есть на спину.
    if float(np.dot(nrm, points[NOSE][:2] - shoulder)) > 0:
        nrm = -nrm

    return Axes(shoulder=shoulder, v=v, nrm=nrm, length=length)


def capsule(xx: np.ndarray, yy: np.ndarray, a: np.ndarray, b: np.ndarray, radius: float):
    """Маска капсулы (рука) и параметр tt вдоль неё."""
    ab = b - a
    denominator = float(ab @ ab) or 1.0
    tt = np.clip(((xx - a[0]) * ab[0] + (yy - a[1]) * ab[1]) / denominator, 0, 1)
    dx = xx - (a[0] + tt * ab[0])
    dy = yy - (a[1] + tt * ab[1])
    return np.sqrt(dx * dx + dy * dy) < radius, tt


def lat_band(
    points: np.ndarray,
    mask: np.ndarray,
    xx: np.ndarray,
    yy: np.ndarray,
    axes: Axes,
    profile: str,
) -> np.ndarray:
    """Область широчайших: полоса от спины, шире у подмышки, уже к талии."""
    height, width = mask.shape
    rx = xx - axes.shoulder[0]
    ry = yy - axes.shoulder[1]
    t = (rx * axes.v[0] + ry * axes.v[1]) / axes.length
    u = (rx * axes.nrm[0] + ry * axes.nrm[1]) / axes.length

    body = mask > 0.5
    bands = 25
    tb = np.clip(((t - 0.10) / 0.78 * bands).astype(int), -1, bands - 1)

    umax = np.full(bands, np.nan)
    umin = np.full(bands, np.nan)
    for band in range(bands):
        selector = body & (tb == band)
        if selector.any():
            umax[band] = float(u[selector].max())
            umin[band] = max(float(u[selector].min()), -0.32)

    ok = ~np.isnan(umax)
    idx = np.arange(bands)
    if not ok.any():
        return np.zeros_like(mask, dtype=np.float32)

    umax = np.interp(idx, idx[ok], umax[ok])
    umin = np.interp(idx, idx[ok], umin[ok])
    umax = np.convolve(np.pad(umax, 2, mode="edge"), np.ones(5) / 5, "valid")
    umin = np.convolve(np.pad(umin, 2, mode="edge"), np.ones(5) / 5, "valid")

    band = np.clip(tb, 0, bands - 1)
    upper = umax[band]
    lower = umin[band]
    tn = np.clip((t - 0.10) / 0.78, 0, 1)
    width_factor = 0.78 - 0.36 * tn

    band_mask = ((t > 0.10) & (t < 0.88) & (u > upper - width_factor * (upper - lower))).astype(
        np.float32
    )

    top = np.clip((t - 0.10) / 0.12, 0, 1)
    bottom = np.clip((0.88 - t) / 0.22, 0, 1)
    edge = np.clip((u - (upper - width_factor * (upper - lower))) / 0.05, 0, 1)
    band_mask *= top * bottom * edge * np.clip(mask, 0, 1)

    if profile == "pull_horizontal":
        # Верхняя треть полосы ближе к спине — средняя часть трапеций.
        traps = band_mask * (t < 0.35) * (t > 0.05)
        band_mask = np.maximum(band_mask, traps)

    return band_mask
