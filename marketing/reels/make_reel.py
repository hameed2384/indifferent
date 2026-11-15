"""Turn a saved round (from fetch_round.py) into a vertical Reel.

    uv run --no-project --with imageio-ffmpeg==0.5.1 python marketing/reels/make_reel.py <round.json> <name> "<hook>" ["<hook sub-line>"]

Renders each moment (hook, every message, typing dots, score bars, end
card) as a 1080x1920 frame with headless Chrome, then stitches them into an
H.264 MP4 with a silent audio track. Writes <name>.mp4 and <name>-cover.jpg
to frontend/public/social/ so the Admin publisher can post it.
"""
import json
import os
import re
import subprocess
import sys
import tempfile

import imageio_ffmpeg

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, "frontend", "public", "social")
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
MAX_AI_CHARS = 200


def trim(text, limit):
    """Keep whole sentences up to the limit, so long AI replies stay readable on screen."""
    if len(text) <= limit:
        return text
    sentences = re.split(r"(?<=[.!?])\s+", text)
    out = ""
    for s in sentences:
        if len(out) + len(s) + 1 > limit:
            break
        out = f"{out} {s}".strip()
    return out or text[:limit].rsplit(" ", 1)[0] + "…"


def hold(text):
    """Seconds to keep a message on screen: about 26 characters a second, 1.4s to 3.6s."""
    return max(1.4, min(3.6, len(text) / 26))


def build_states(round_):
    states = [({"kind": "hook"}, 2.0)]
    for i, m in enumerate(round_["messages"], start=1):
        if m["role"] == "ai":
            for dot in (1, 2, 3):
                states.append(({"kind": "chat", "upto": i - 1, "typing": dot}, 0.25))
        states.append(({"kind": "chat", "upto": i, "typing": 0}, hold(m["text"])))
    for step in (0.0, 0.25, 0.5, 0.75):
        states.append(({"kind": "score", "bars": step}, 0.12))
    states.append(({"kind": "score", "bars": 1}, 3.0))
    states.append(({"kind": "end"}, 2.2))
    return states


def main():
    src, name, hook, *rest = sys.argv[1:]
    hook_sub = rest[0] if rest else "With an AI that always takes the other side."
    with open(src, encoding="utf-8") as f:
        round_ = json.load(f)
    for m in round_["messages"]:
        if m["role"] == "ai":
            m["text"] = trim(m["text"], MAX_AI_CHARS)

    states = build_states(round_)
    data_dir = os.path.join(HERE, "data")
    os.makedirs(data_dir, exist_ok=True)
    with open(os.path.join(data_dir, f"{name}.js"), "w", encoding="utf-8") as f:
        f.write("window.REEL = " + json.dumps({"round": round_, "hook": hook, "hookSub": hook_sub,
                                               "states": [s for s, _ in states]}, ensure_ascii=False) + ";")

    html = os.path.join(HERE, "reel.html").replace("\\", "/")
    profile = os.path.join(tempfile.gettempdir(), "indifferent-render-profile")
    frames = tempfile.mkdtemp(prefix="reel-")
    concat = []
    for i, (_, seconds) in enumerate(states):
        png = os.path.join(frames, f"{i:03d}.png")
        subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
                        f"--user-data-dir={profile}", "--window-size=1080,1920", "--virtual-time-budget=4000",
                        f"--screenshot={png}", f"file:///{html}#{name}|{i}"],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        concat.append(f"file '{png.replace(os.sep, '/')}'\nduration {seconds:.3f}")
    concat.append(f"file '{os.path.join(frames, f'{len(states) - 1:03d}.png').replace(os.sep, '/')}'")
    list_file = os.path.join(frames, "list.txt")
    with open(list_file, "w", encoding="utf-8") as f:
        f.write("\n".join(concat))

    os.makedirs(OUT, exist_ok=True)
    mp4 = os.path.join(OUT, f"{name}.mp4")
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    subprocess.run([ffmpeg, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list_file,
                    "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
                    "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-preset", "medium", "-crf", "20",
                    "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart", mp4], check=True)
    # Cover: the hook frame, cropped to the 4:5 grid view by Instagram.
    subprocess.run([ffmpeg, "-y", "-loglevel", "error", "-i", os.path.join(frames, "000.png"), "-q:v", "3",
                    os.path.join(OUT, f"{name}-cover.jpg")], check=True)
    total = sum(s for _, s in states)
    print(f"{mp4}  ({len(states)} frames, {total:.1f}s)")


if __name__ == "__main__":
    main()
