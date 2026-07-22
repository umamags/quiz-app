#!/usr/bin/env python3
"""Sync json/*.json descriptions and audio_desc from csv/ and audio/.

Two independent syncs, run per category (json/<category>.json):

1. Description: some csv files have picked up a 4th "description" column
   (currently animals.csv, dinosaurs.csv, fishes.csv, and others). That
   text is copied into the matching entry's "description" field, matched
   by name -- e.g. csv/animals.csv's description column feeds
   json/animals.json. csv files with no "description" column are skipped.

2. Audio: for every entry that has a description, if a matching mp3 exists
   at audio/<category>/<slug>.mp3 (the file text_to_audio.py produces,
   slug matching the images_downloaded/<category>/<slug>_N.jpg
   convention), its "audio_desc" field is set to "audio/<category>/<slug>.mp3".
   For example, "bear" in animals.json gets
   "audio_desc": "audio/animals/bear.mp3" once that file exists.

A csv row (for sync 1) whose json entry doesn't exist yet -- i.e.
download_video_links.py hasn't created it there yet -- is skipped and
logged, not created from scratch. Likewise sync 2 just leaves audio_desc
alone for entries with no matching mp3 yet.

Usage:
    python utils/download_unsplash/update_descriptions.py                 # every json category
    python utils/download_unsplash/update_descriptions.py --file animals  # only animals
    python utils/download_unsplash/update_descriptions.py --dry-run       # preview, no writes
"""

import argparse
import csv
import json
import os
import sys

from download_unsplash import slugify

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_DIR = os.path.join(SCRIPT_DIR, "csv")
JSON_DIR = os.path.join(SCRIPT_DIR, "json")
AUDIO_DIR = os.path.join(SCRIPT_DIR, "audio")


def read_csv_descriptions(csv_path):
    """Return {name: description} for rows with a non-empty description,
    or None if this csv has no "description" column at all (or doesn't
    exist)."""
    if not os.path.isfile(csv_path):
        return None
    with open(csv_path, "r", newline="", encoding="utf-8") as f:
        rows = list(csv.reader(f))
    if not rows:
        return None

    header, data_rows = rows[0], rows[1:]
    if "description" not in header:
        return None
    desc_idx = header.index("description")

    descriptions = {}
    for row in data_rows:
        if len(row) <= desc_idx:
            continue
        name = row[0].strip()
        description = row[desc_idx].strip()
        if name and description:
            descriptions[name] = description
    return descriptions


def load_json_list(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def write_json_list(path, items):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(items, f, indent=2)
        f.write("\n")


def sync_descriptions(category, items_by_name, dry_run):
    descriptions = read_csv_descriptions(os.path.join(CSV_DIR, f"{category}.csv"))
    if not descriptions:
        return 0, 0

    updated = 0
    skipped = 0
    for name, description in descriptions.items():
        item = items_by_name.get(name)
        if item is None:
            print(f"  {name}: no matching entry in {category}.json yet, skipping")
            skipped += 1
            continue
        if item.get("description") == description:
            continue
        print(f"  {'would update description' if dry_run else 'updating description'}: {name}")
        if not dry_run:
            item["description"] = description
        updated += 1
    return updated, skipped


def sync_audio(category, items, dry_run):
    audio_dir = os.path.join(AUDIO_DIR, category)
    if not os.path.isdir(audio_dir):
        return 0

    updated = 0
    for item in items:
        if not item.get("description"):
            continue
        slug = slugify(item["name"])
        mp3_path = os.path.join(audio_dir, f"{slug}.mp3")
        if not os.path.isfile(mp3_path):
            continue
        audio_desc = f"audio/{category}/{slug}.mp3"
        if item.get("audio_desc") == audio_desc:
            continue
        print(f"  {'would set' if dry_run else 'setting'} audio_desc: {item['name']} -> {audio_desc}")
        if not dry_run:
            item["audio_desc"] = audio_desc
        updated += 1
    return updated


def sync_category(category, dry_run):
    json_path = os.path.join(JSON_DIR, f"{category}.json")
    if not os.path.isfile(json_path):
        return None

    items = load_json_list(json_path)
    items_by_name = {item["name"]: item for item in items}

    print(f"=== {category}.json ===")
    desc_updated, desc_skipped = sync_descriptions(category, items_by_name, dry_run)
    audio_updated = sync_audio(category, items, dry_run)

    changed = (desc_updated > 0 or audio_updated > 0)
    if changed and not dry_run:
        write_json_list(json_path, items)
        print(f"  wrote {json_path}")
    if not changed:
        print("  nothing to update")

    return desc_updated, desc_skipped, audio_updated


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--file", help="Only process this category (e.g. animals or animals.json)")
    parser.add_argument("--dry-run", action="store_true", help="Show what would change; no writes")
    args = parser.parse_args()

    if not os.path.isdir(JSON_DIR):
        print(f"JSON directory not found: {JSON_DIR}")
        sys.exit(1)

    categories = sorted(os.path.splitext(n)[0] for n in os.listdir(JSON_DIR) if n.lower().endswith(".json"))
    if args.file:
        wanted = os.path.splitext(args.file)[0]
        categories = [c for c in categories if c == wanted]
        if not categories:
            print(f"No such json category: {args.file}")
            sys.exit(1)

    desc_total = 0
    skipped_total = 0
    audio_total = 0

    for category in categories:
        result = sync_category(category, args.dry_run)
        if result is None:
            continue
        desc_updated, desc_skipped, audio_updated = result
        desc_total += desc_updated
        skipped_total += desc_skipped
        audio_total += audio_updated

    verb = "would update" if args.dry_run else "updated"
    print(
        f"Done. {desc_total} description(s) {verb}, {audio_total} audio_desc {verb}, "
        f"{skipped_total} skipped (no matching json entry)."
    )


if __name__ == "__main__":
    main()
