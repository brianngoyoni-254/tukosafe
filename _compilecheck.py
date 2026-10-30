import py_compile
from pathlib import Path

root = Path(r"C:\Users\User\Desktop\tukosafe\backend\tukosafe")
results = []
for py in sorted(root.rglob("*.py")):
    try:
        py_compile.compile(str(py), doraise=True)
        results.append(f"OK   {py.relative_to(root)}")
    except Exception as e:
        results.append(f"FAIL {py.relative_to(root)} :: {type(e).__name__}: {e}")
Path(r"C:/Users/User/Desktop/tukosafe/_compile_results.txt").write_text("\n".join(results), encoding="utf-8")
print("done", len(results))
