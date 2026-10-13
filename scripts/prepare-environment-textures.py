"""Convert the four user-supplied 4K sets to shared browser-ready 2K maps.
Requires Python, numpy, Pillow with WebP, and OpenCV with OpenEXR enabled.
Run from any working directory. Original source files are read-only inputs.
"""
from pathlib import Path
import os, hashlib, json
os.environ["OPENCV_IO_ENABLE_OPENEXR"] = "1"
import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "client/public/textures/environment"
SIZE = 2048
SETS = ["medieval_wall_02", "roof_slates_02", "weathered_planks", "cobblestone_01"]

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def read_data(path):
    if path.suffix == ".exr":
        data = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
        if data is None:
            raise RuntimeError(f"Cannot decode EXR: {path}")
        # OpenCV returns BGRA; EXR maps are linear numeric data, never sRGB.
        return data[:, :, :3][:, :, ::-1] if data.ndim == 3 else data
    return np.asarray(Image.open(path).convert("RGB"), dtype=np.float32) / 255

manifest = {"size": SIZE, "source": "User-provided local texture sets", "sets": []}
for name in SETS:
    folder = ROOT / "models" / (name + "_4k.blend") / "textures"
    target = OUTPUT / name
    target.mkdir(parents=True, exist_ok=True)
    diffuse = folder / (name + "_diff_4k.jpg")
    normal = folder / (name + "_nor_gl_4k.exr")
    roughness = next(folder.glob(name + "_rough_4k.*"))
    sources = [diffuse, normal, roughness]
    hashes = {str(p.relative_to(ROOT)).replace("\\", "/"): digest(p) for p in sources}

    Image.open(diffuse).convert("RGB").resize((SIZE, SIZE), Image.Resampling.LANCZOS).save(
        target / "albedo.webp", quality=92, method=6)
    # Average and renormalize vectors, rather than filtering encoded normals as colors.
    vectors = cv2.resize(read_data(normal) * 2 - 1, (SIZE, SIZE), interpolation=cv2.INTER_AREA)
    vectors /= np.maximum(np.linalg.norm(vectors, axis=2, keepdims=True), 1e-6)
    pixels = np.rint(np.clip(vectors * .5 + .5, 0, 1) * 255).astype(np.uint8)
    Image.fromarray(pixels).save(target / "normal.webp", lossless=True, method=6)
    rough = read_data(roughness)
    if rough.ndim == 3:
        rough = rough[:, :, 0]
    rough = cv2.resize(rough, (SIZE, SIZE), interpolation=cv2.INTER_AREA)
    pixels = np.rint(np.clip(rough, 0, 1) * 255).astype(np.uint8)
    # Grayscale expands equally into RGB; the PBR shader reads the green channel.
    Image.fromarray(pixels).save(target / "roughness.webp", lossless=True, method=6)
    assert hashes == {str(p.relative_to(ROOT)).replace("\\", "/"): digest(p) for p in sources}
    maps = {p.name: {"bytes": p.stat().st_size, "sha256": digest(p)} for p in sorted(target.glob("*.webp"))}
    manifest["sets"].append({"id": name, "sourceSha256": hashes, "maps": maps,
        "roughnessRange": [float(rough.min()), float(rough.max())]})
    print(name, sum(m["bytes"] for m in maps.values()), "bytes", flush=True)
OUTPUT.mkdir(parents=True, exist_ok=True)
(OUTPUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
print("Total:", sum(m["bytes"] for s in manifest["sets"] for m in s["maps"].values()), "bytes")
