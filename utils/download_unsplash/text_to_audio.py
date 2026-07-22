#!/usr/bin/env python3
"""Generate an MP3 narration for every description in csv/*.csv.

Some csv files have picked up a "description" column (currently
animals.csv and fishes.csv; others will follow the same shape over time).
For every row with a non-empty description and no audio_generated_ts yet,
this script synthesizes speech with macOS's built-in `say` command,
converts it to MP3 with ffmpeg, and stamps the row so re-runs only touch
new/changed rows. CSVs with no "description" column are skipped entirely.

Fully offline: no new Python dependency, no API key, no network call --
just the `say` and `ffmpeg` binaries, which are already on this machine.
(macOS-only, since `say` doesn't exist on Windows/Linux.)

Output: utils/download_unsplash/audio/<category>/<slug>.mp3, one per item,
category/slug matching the images_downloaded/<category>/<slug>_N.jpg
convention already used elsewhere in this pipeline.

Usage:
    python utils/download_unsplash/text_to_audio.py                 # first 20 due rows, every csv
    python utils/download_unsplash/text_to_audio.py --file animals  # only animals.csv
    python utils/download_unsplash/text_to_audio.py --limit 50
    python utils/download_unsplash/text_to_audio.py --all           # no limit
    python utils/download_unsplash/text_to_audio.py --dry-run       # preview, no synthesis/writes
    python utils/download_unsplash/text_to_audio.py --voice Daniel --rate 165
"""

import argparse
import csv
import os
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime

from download_unsplash import slugify

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_DIR = os.path.join(SCRIPT_DIR, "csv")
AUDIO_DIR = os.path.join(SCRIPT_DIR, "audio")

DEFAULT_LIMIT = 20
DEFAULT_VOICE = "Samantha"
DEFAULT_RATE = 175  # words per minute; `say`'s own default


def require_tools():
    missing = [tool for tool in ("say", "ffmpeg") if shutil.which(tool) is None]
    if missing:
        print(f"Error: required tool(s) not found on PATH: {', '.join(missing)}")
        if "say" in missing:
            print("`say` ships with macOS -- this script only runs there.")
        if "ffmpeg" in missing:
            print("Install ffmpeg, e.g. `brew install ffmpeg`.")
        sys.exit(1)


def synthesize(text, mp3_path, voice, rate):
    os.makedirs(os.path.dirname(mp3_path), exist_ok=True)
    fd, aiff_path = tempfile.mkstemp(suffix=".aiff")
    os.close(fd)
    try:
        subprocess.run(
            ["say", "-v", voice, "-r", str(rate), "-o", aiff_path, text],
            check=True, capture_output=True, text=True,
        )
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", aiff_path,
             "-codec:a", "libmp3lame", "-qscale:a", "2", mp3_path],
            check=True, capture_output=True, text=True,
        )
        return True
    except subprocess.CalledProcessError as e:
        stderr = (e.stderr or "").strip().splitlines()
        detail = stderr[-1] if stderr else str(e)
        print(f"    synthesis failed: {detail}")
        return False
    finally:
        if os.path.exists(aiff_path):
            os.remove(aiff_path)


def due_rows(csv_path):
    with open(csv_path, "r", newline="", encoding="utf-8") as f:
        rows = list(csv.reader(f))
    if not rows:
        return None

    header, data_rows = rows[0], rows[1:]
    if "description" not in header:
        return None
    desc_idx = header.index("description")

    if "audio_generated_ts" in header:
        audio_idx = header.index("audio_generated_ts")
    else:
        audio_idx = len(header)
        header.append("audio_generated_ts")

    due = []
    for row_num, row in enumerate(data_rows, start=2):
        while len(row) <= audio_idx:
            row.append("")
        name = row[0].strip()
        description = row[desc_idx].strip()
        audio_ts = row[audio_idx].strip()
        if not name or not description:
            continue
        if audio_ts:
            continue
        due.append((row_num, row, name, description))

    return header, data_rows, desc_idx, audio_idx, due


def write_csv(csv_path, header, data_rows):
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(data_rows)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--file", help="Only process this csv (e.g. animals or animals.csv)")
    parser.add_argument("--limit", type=int, default=DEFAULT_LIMIT, help=f"Max rows to process this run (default {DEFAULT_LIMIT})")
    parser.add_argument("--all", action="store_true", help="No limit -- process every due row")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be processed; no synthesis or writes")
    parser.add_argument("--voice", default=DEFAULT_VOICE, help=f"macOS `say` voice (default {DEFAULT_VOICE}; see `say -v ?`)")
    parser.add_argument("--rate", type=int, default=DEFAULT_RATE, help=f"Speech rate in words per minute (default {DEFAULT_RATE})")
    args = parser.parse_args()

    if not args.dry_run:
        require_tools()

    if not os.path.isdir(CSV_DIR):
        print(f"CSV directory not found: {CSV_DIR}")
        sys.exit(1)

    csv_names = sorted(n for n in os.listdir(CSV_DIR) if n.lower().endswith(".csv"))
    if args.file:
        wanted = args.file if args.file.endswith(".csv") else args.file + ".csv"
        csv_names = [n for n in csv_names if n == wanted]
        if not csv_names:
            print(f"No such csv: {wanted}")
            sys.exit(1)

    limit = None if args.all else args.limit
    processed_count = 0
    skipped_count = 0

    for csv_name in csv_names:
        if limit is not None and processed_count >= limit:
            break

        csv_path = os.path.join(CSV_DIR, csv_name)
        result = due_rows(csv_path)
        if result is None:
            continue
        header, data_rows, desc_idx, audio_idx, due = result
        if not due:
            continue

        category = os.path.splitext(csv_name)[0]
        print(f"=== {csv_name}: {len(due)} row(s) due ===")
        if args.dry_run:
            for _, _, name, _ in due:
                print(f"  would synthesize: {name}")
            continue

        changed = False
        for row_num, row, name, description in due:
            if limit is not None and processed_count >= limit:
                break
            mp3_path = os.path.join(AUDIO_DIR, category, f"{slugify(name)}.mp3")
            print(f"  {name}")
            ok = synthesize(description, mp3_path, args.voice, args.rate)
            if ok:
                row[audio_idx] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                changed = True
                processed_count += 1
            else:
                skipped_count += 1

        if changed:
            write_csv(csv_path, header, data_rows)
            print(f"  updated {csv_name}")

    if args.dry_run:
        return
    print(f"Done. Synthesized {processed_count} row(s), skipped {skipped_count}.")
    if limit is not None and processed_count >= limit:
        print(f"Hit --limit {limit}. Re-run (or pass --all) to continue with the rest.")


if __name__ == "__main__":
    main()
