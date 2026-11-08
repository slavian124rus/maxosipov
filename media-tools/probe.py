"""Проба видео: размер, поворот, длительность, fps.

Печатает JSON в stdout. Берём -show_streams целиком: имена секций side_data различаются
между версиями ffprobe. Поворот берём из side_data_list (displaymatrix) или tags.rotate —
iPhone пишет его именно там, и без поворота вертикальный ролик станет горизонтальным.
"""
import json
import subprocess
import sys


def probe(path: str) -> dict:
    out = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_streams",
            "-of",
            "json",
            path,
        ],
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    data = json.loads(out)
    stream = (data.get("streams") or [{}])[0]

    rotation = 0
    for side in stream.get("side_data_list") or []:
        if "rotation" in side:
            rotation = int(float(side["rotation"]))
            break
    if rotation == 0:
        tag = (stream.get("tags") or {}).get("rotate")
        if tag is not None:
            rotation = int(float(tag))

    rotation = ((rotation % 360) + 360) % 360

    rate = stream.get("r_frame_rate") or "30/1"
    num, _, den = rate.partition("/")
    fps = float(num) / float(den or 1)

    duration = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=nw=1:nk=1",
            path,
        ],
        capture_output=True,
        text=True,
        check=True,
    ).stdout.strip()

    return {
        "width": int(stream.get("width") or 0),
        "height": int(stream.get("height") or 0),
        "rotation": rotation,
        "duration": float(duration or 0),
        "fps": round(fps, 3),
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "нужен путь к видео"}))
        sys.exit(2)
    try:
        print(json.dumps(probe(sys.argv[1])))
    except Exception as error:  # noqa: BLE001 — отдаём текст наверх
        print(json.dumps({"error": str(error)}))
        sys.exit(1)
