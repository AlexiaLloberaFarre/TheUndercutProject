# Backups

Every change to the website leaves a complete copy of the site here, in a folder named by date, time (Europe/Madrid) and a short label, for example `2026-10-17_1240_signature/`.

Each folder contains everything the site needs: `index.html`, `assets/` (styles, scripts, images), `data/` (availability and booking links), `admin/` (availability editor) and the `README.md`, plus a `MANIFEST.txt` saying when it was taken and which commit it followed.

**To restore a version**: open the folder you want, copy its contents over the repository root (replacing the current files), and commit. Nothing else is needed.

Snapshots are created by `scripts/backup.sh`, which runs automatically before each commit that touches the site. Running it by hand also works:

```bash
scripts/backup.sh "what changed"
```

Identical snapshots are skipped, so the folder only grows when something actually changed.
