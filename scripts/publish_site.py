#!/usr/bin/env python3
"""Publish low-level-ops-cost site to personal-website."""

from __future__ import annotations

import argparse
import shutil
import subprocess
from pathlib import Path

SITE_ITEMS = ["index.html", "style.css", "app.js", "data"]


def _run(cmd: list[str], dry_run: bool = False) -> None:
    printable = " ".join(cmd)
    if dry_run:
        print(f"DRY RUN: {printable}")
        return
    subprocess.run(cmd, check=True)


def _copy_item(src: Path, dest: Path) -> None:
    if src.is_dir():
        shutil.copytree(src, dest)
    else:
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)


def build_dist(root: Path, dist: Path) -> None:
    if dist.exists():
        shutil.rmtree(dist)
    dist.mkdir(parents=True, exist_ok=True)

    for item in SITE_ITEMS:
        src = root / item
        if not src.exists():
            print(f"WARN: missing {src}")
            continue
        _copy_item(src, dist / item)


def main() -> int:
    parser = argparse.ArgumentParser(description="Publish low-level-ops-cost site.")
    parser.add_argument(
        "--site-root",
        default="~/work/personal-website/low-level-ops-cost",
        help="Destination folder in personal-website repo.",
    )
    parser.add_argument(
        "--skip-site-sync",
        action="store_true",
        help="Skip syncing HTML into personal-website.",
    )
    parser.add_argument(
        "--preview",
        action="store_true",
        help="Serve dist/site with a local HTTP server (port 8000).",
    )
    parser.add_argument("--dry-run", action="store_true", help="Print actions only.")
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    dist = root / "dist" / "site"

    build_dist(root, dist)

    if not args.skip_site_sync:
        site_root = Path(args.site_root).expanduser()
        site_root.parent.mkdir(parents=True, exist_ok=True)
        cmd = ["rsync", "-av", "--delete", f"{dist}/", f"{site_root}/"]
        _run(cmd, dry_run=args.dry_run)

    if args.preview:
        if args.dry_run:
            print("DRY RUN: preview server would start at http://localhost:8000")
        else:
            print("Preview: http://localhost:8000")
            subprocess.run(["python3", "-m", "http.server", "8000"], check=True, cwd=dist)

    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
