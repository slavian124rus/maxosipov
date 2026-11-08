"""Тесты геометрии профилей подсветки (без MediaPipe)."""
import numpy as np
import pytest

import profiles as P
from overlay import ensure_detected


def make_points(nose_x: float = 200.0, left_vis: float = 0.9, right_vis: float = 0.9):
    points = np.zeros((33, 3), dtype=np.float32)
    points[:, 2] = 0.9
    points[P.NOSE] = [nose_x, 20, 0.9]
    points[P.L_SHOULDER] = [90, 60, 0.9]
    points[P.R_SHOULDER] = [110, 60, 0.9]
    points[P.L_ELBOW] = [70, 110, left_vis]
    points[P.R_ELBOW] = [130, 110, right_vis]
    points[P.L_WRIST] = [60, 160, left_vis]
    points[P.R_WRIST] = [140, 160, right_vis]
    points[P.L_HIP] = [95, 200, 0.9]
    points[P.R_HIP] = [105, 200, 0.9]
    return points


def body_mask(width: int = 200, height: int = 240) -> np.ndarray:
    yy, xx = np.mgrid[0:height, 0:width].astype(np.float32)
    inside = ((xx - 100) / 35) ** 2 + ((yy - 130) / 80) ** 2 <= 1
    return inside.astype(np.float32)


def test_back_normal_points_away_from_nose():
    points = make_points(nose_x=200)
    axes = P.body_axes(points)
    # Нос справа → нормаль «к спине» смотрит влево (в сторону -x).
    assert axes.nrm[0] < 0


def test_lats_area_is_behind_the_axis():
    points = make_points(nose_x=200)
    mask = body_mask()
    yy, xx = np.mgrid[0 : mask.shape[0], 0 : mask.shape[1]].astype(np.float32)
    axes = P.body_axes(points)

    band = P.lat_band(points, mask, xx, yy, axes, "pull_vertical")
    assert band.sum() > 0

    weights = band * mask
    centroid_x = float((xx * weights).sum() / weights.sum())
    assert centroid_x < axes.shoulder[0]


def test_visible_arm_prefers_higher_visibility():
    points = np.stack([make_points(left_vis=0.2, right_vis=0.95)] * 3)
    assert P.visible_arm(points) == "right"

    points = np.stack([make_points(left_vis=0.95, right_vis=0.2)] * 3)
    assert P.visible_arm(points) == "left"


def test_ensure_detected_rejects_partial_pose():
    good = make_points()
    frames = np.stack([good] * 10)
    ensure_detected(frames)  # не бросает

    broken = np.stack([good] * 5 + [np.full((33, 3), np.nan)] * 5)
    with pytest.raises(SystemExit) as error:
        ensure_detected(broken)
    assert error.value.code == 3


def test_intensity_stays_in_range():
    angles = np.array([60, 90, 120, 150, 120, 90], dtype=np.float32)
    intensity = P.intensity_from_angles(angles)
    assert intensity.min() >= 0.22 - 1e-6
    assert intensity.max() <= 1.0 + 1e-6
