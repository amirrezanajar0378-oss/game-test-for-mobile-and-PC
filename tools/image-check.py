from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
required = [
    ROOT / "index.html",
    ROOT / "style.css",
    ROOT / "src" / "app.ts",
    ROOT / "src" / "utils.ts",
    ROOT / "src" / "types.ts",
]

missing = [str(path.relative_to(ROOT)) for path in required if not path.is_file()]
if missing:
    raise SystemExit("Missing required files: " + ", ".join(missing))

print(f"TinyPix project check passed: {len(required)} required files found.")
