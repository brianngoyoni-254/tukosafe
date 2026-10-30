import os
from pathlib import Path

root = Path(r"C:\Users\User\Desktop\tukosafe\backend\tukosafe")

def read_text(path: Path) -> str:
    data = path.read_bytes()
    # Try UTF-8 first
    for enc in ("utf-8-sig", "utf-8", "utf-16", "cp1252"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    # Last resort: replace errors
    return data.decode("utf-8", errors="replace")


fixed = 0
skipped = 0
for py in root.rglob("*.py"):
    try:
        text = py.read_text(encoding="utf-8")
        skipped += 1
        continue
    except UnicodeDecodeError:
        pass
    text = read_text(py)
    py.write_text(text, encoding="utf-8")
    fixed += 1
    print(f"CONVERTED: {py}")

print(f"\nDone. Fixed={fixed}, Already-UTF8={skipped}")
