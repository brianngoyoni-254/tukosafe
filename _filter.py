from pathlib import Path
lines = Path(r"C:/Users/User/Desktop/tukosafe/_compile_results.txt").read_text(encoding="utf-8").splitlines()
mine = [l for l in lines if ("app\\" in l or "scripts\\" in l or "tests\\" in l or l.endswith("run.py") or l.endswith("wsgi.py")) and ".venv" not in l]
Path(r"C:/Users/User/Desktop/tukosafe/_mine_results.txt").write_text("\n".join(mine), encoding="utf-8")
print(len(mine))
