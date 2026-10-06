from pathlib import Path
import imghdr

ROOT = Path(__file__).resolve().parents[1]
SUPPORTED = {"jpeg", "png", "webp", "avif"}

files = list((ROOT / "src").glob("**/*.ts"))
print(f"TinyPix source check: {len(files)} TypeScript file(s)")

for path in files:
    if path.stat().st_size == 0:
        raise SystemExit(f"Empty source file: {path}")

print("Python check passed.")
