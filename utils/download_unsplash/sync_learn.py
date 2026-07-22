#!/usr/bin/env python3
"""Sync generated Learn content into public/.

The React app only serves files under public/, so the per-category json
files produced under utils/download_unsplash/json/ (see
prompts/populate_json_prompt.txt), and the mp3 narrations produced under
utils/download_unsplash/audio/ (see text_to_audio.py), aren't directly
reachable by the browser until they're copied there. This script:

  - copies each json/<category>.json into public/learn/, and (re)writes
    public/learn/manifest.json to list them all, in the same shape as
    public/quizzes/manifest.json.
  - copies every audio/<category>/*.mp3 into public/audio/<category>/.

No path rewriting is needed inside the json files: each entry's
"audio_desc" (set by update_descriptions.py) is already stored as
"audio/<category>/<slug>.mp3", relative to the public/ root -- the same
convention already used for "images" -- so it resolves correctly as soon
as the file exists at public/audio/<category>/<slug>.mp3.

Usage:
    python utils/download_unsplash/sync_learn.py
"""

import json
import os
import shutil

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SOURCE_DIR = os.path.join(SCRIPT_DIR, "json")
AUDIO_SOURCE_DIR = os.path.join(SCRIPT_DIR, "audio")
ROOT_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
DEST_DIR = os.path.join(ROOT_DIR, "public", "learn")
AUDIO_DEST_DIR = os.path.join(ROOT_DIR, "public", "audio")


def title_case(name):
    return " ".join(word.capitalize() for word in name.replace("_", " ").split())


def sync_audio():
    if not os.path.isdir(AUDIO_SOURCE_DIR):
        return 0

    copied = 0
    category_names = sorted(
        name for name in os.listdir(AUDIO_SOURCE_DIR)
        if os.path.isdir(os.path.join(AUDIO_SOURCE_DIR, name))
    )
    for category in category_names:
        src_dir = os.path.join(AUDIO_SOURCE_DIR, category)
        dest_dir = os.path.join(AUDIO_DEST_DIR, category)
        os.makedirs(dest_dir, exist_ok=True)
        for filename in sorted(os.listdir(src_dir)):
            if not filename.lower().endswith(".mp3"):
                continue
            shutil.copyfile(os.path.join(src_dir, filename), os.path.join(dest_dir, filename))
            copied += 1
    print(f"Copied {copied} audio file(s) -> public/audio/")
    return copied


def main():
    if not os.path.isdir(SOURCE_DIR):
        print(f"Source directory not found: {SOURCE_DIR}")
        return

    os.makedirs(DEST_DIR, exist_ok=True)

    json_names = sorted(name for name in os.listdir(SOURCE_DIR) if name.lower().endswith(".json"))
    if not json_names:
        print(f"No json files found in {SOURCE_DIR}")
        return

    categories = []
    for name in json_names:
        shutil.copyfile(os.path.join(SOURCE_DIR, name), os.path.join(DEST_DIR, name))
        key = os.path.splitext(name)[0]
        categories.append({"title": title_case(key), "file": f"learn/{name}"})
        print(f"Copied {name} -> public/learn/{name}")

    manifest_path = os.path.join(DEST_DIR, "manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump({"categories": categories}, f, indent=2)
        f.write("\n")
    print(f"Wrote {manifest_path}")

    sync_audio()


if __name__ == "__main__":
    main()
