#!/usr/bin/env python3
"""
Build upload-ready extension packages.

Generates in dist/:
  - rachtaz-stream-enhancer-chrome-edge-v<version>.zip   (Chrome + Edge + Opera)
  - rachtaz-stream-enhancer-firefox-v<version>.zip       (Firefox AMO)

The Chromium package (manifest.json as-is) works on Chrome, Edge AND Opera —
all three accept the same MV3 zip.
The Firefox package injects `browser_specific_settings.gecko`
(id + minimum version), required by addons.mozilla.org.

Usage:  python build.py
"""

import json
import os
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"

# Files bundled into the extension (everything else — README, build.py, dist… — is excluded).
# Icons are taken from the manifest itself, so only declared sizes ship.
INCLUDE = [
    "manifest.json",
    "content.js",
    "styles.css",
    "popup.html",
    "popup.js",
]

# Firefox-specific settings (ignored by Chrome/Edge, hence a separate package).
# `data_collection_permissions` is required by AMO for new submissions; this
# extension collects nothing, so we declare "none".
GECKO = {
    "browser_specific_settings": {
        "gecko": {
            "id": "rachtaz-stream-enhancer@kamille92",
            "strict_min_version": "115.0",
            "data_collection_permissions": {
                "required": ["none"]
            },
        }
    }
}


def load_manifest():
    return json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))


def collect_files(manifest):
    """List of (disk_path, path_in_zip) for the files to package."""
    files = []
    for name in INCLUDE:
        p = ROOT / name
        if not p.exists():
            raise SystemExit(f"Missing file: {name}")
        files.append((p, name))
    # Only the icons declared in the manifest (action + top-level icons).
    icon_rels = set(manifest.get("icons", {}).values())
    icon_rels |= set(manifest.get("action", {}).get("default_icon", {}).values())
    for rel in sorted(icon_rels):
        p = ROOT / rel
        if not p.exists():
            raise SystemExit(f"Missing icon declared in manifest: {rel}")
        files.append((p, rel.replace("\\", "/")))
    return files


def write_zip(zip_path, files, manifest_override=None):
    # Write to a temp file then atomically replace:
    # avoids Windows/OneDrive lock issues on the existing zip.
    tmp_path = zip_path.with_suffix(".zip.tmp")
    with zipfile.ZipFile(tmp_path, "w", zipfile.ZIP_DEFLATED) as z:
        for disk_path, arc_name in files:
            if arc_name == "manifest.json" and manifest_override is not None:
                z.writestr("manifest.json", manifest_override)
            else:
                z.write(disk_path, arc_name)
    os.replace(tmp_path, zip_path)


def main():
    manifest = load_manifest()
    version = manifest.get("version", "0.0.0")
    files = collect_files(manifest)

    DIST.mkdir(parents=True, exist_ok=True)

    # Chrome + Edge + Opera: manifest unchanged.
    chrome_zip = DIST / f"rachtaz-stream-enhancer-chrome-edge-v{version}.zip"
    write_zip(chrome_zip, files)

    # Firefox: manifest + browser_specific_settings.
    ff_manifest = dict(manifest)
    ff_manifest.update(GECKO)
    ff_zip = DIST / f"rachtaz-stream-enhancer-firefox-v{version}.zip"
    write_zip(ff_zip, files, manifest_override=json.dumps(ff_manifest, indent=2, ensure_ascii=False))

    print(f"Version {version}")
    print(f"  Chrome/Edge/Opera -> {chrome_zip.relative_to(ROOT)}")
    print(f"  Firefox           -> {ff_zip.relative_to(ROOT)}")
    print(f"  ({len(files)} files per package)")


if __name__ == "__main__":
    main()
