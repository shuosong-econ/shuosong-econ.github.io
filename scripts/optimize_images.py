"""Generate lightweight website copies; never overwrite the originals.

Run with Python + Pillow: python3 scripts/optimize_images.py
"""
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
DESTINATION = ROOT / "assets" / "photos"
DESTINATION.mkdir(parents=True, exist_ok=True)

for source in (ROOT / "figures").iterdir():
    if source.suffix.lower() not in (".jpg", ".jpeg", ".png"):
        continue
    if source.stem == "essai_thumbnail":
        continue  # The original journal placeholder is not a published essay.
    with Image.open(source) as original:
        normalized = ImageOps.exif_transpose(original).convert("RGB")
        for maximum, suffix in ((800, ""), (1920, "-large")):
            copy = normalized.copy()
            copy.thumbnail((maximum, maximum))
            copy.save(
                DESTINATION / f"{source.stem.lower()}{suffix}.webp",
                "WEBP",
                quality=84,
                method=6,
            )
print("Optimized copies saved to assets/photos; originals unchanged.")
