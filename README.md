# low-level-ops-cost

A static site tracking latency, throughput, and storage for low-level operations on accelerators and CPUs.

## Publish

This project publishes into the `personal-website` repo under `low-level-ops-cost/`.

```bash
cd ~/work/low-level-ops-cost
python3 scripts/publish_site.py
```

Options:

- `--dry-run`: print actions without copying
- `--skip-site-sync`: build the dist output only
- `--site-root <path>`: override the destination path

The publish script builds `dist/site` and uses `rsync --delete` to sync into the destination folder.
