from pathlib import Path

root = Path(r"C:\Users\User\Desktop\tukosafe\backend\tukosafe")


def read_text(path: Path) -> str:
    data = path.read_bytes()
    # UTF-16 LE/BOM files contain null bytes
    if b"\x00" in data[:4096]:
        return data.decode("utf-16")
    # Not UTF-8 -> assume cp1252 (PowerShell 5.1 default)
    return data.decode("cp1252")


fixed = skipped = 0
for py in root.rglob("*.py"):
    try:
        py.read_text(encoding="utf-8")
        skipped += 1
        continue
    except UnicodeDecodeError:
        pass
    text = read_text(py)
    py.write_text(text, encoding="utf-8")
    fixed += 1
    print(f"RECOVERED: {py}")

print(f"\nDone. Recovered={fixed}, Already-UTF8={skipped}")
