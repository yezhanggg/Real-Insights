from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PUBLIC_DATA = ROOT / "public" / "data"
LAYERS = ROOT / "content" / "layers"
EXAMPLE_LAYERS = ROOT / "content" / "examples" / "layers"
WORK = ROOT / "pipeline" / "work"  # git-ignored scratch space for downloads
