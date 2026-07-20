#!/usr/bin/env python3
"""Sync generated Learn content into public/learn/.

The React app only serves files under public/, so the per-category json
files produced under utils/download_unsplash/json/ (see
prompts/populate_json_prompt.txt) aren't directly reachable by the browser.
This script copies each of those files into public/learn/ and (re)writes
public/learn/manifest.json to list them all, in the same shape as
public/quizzes/manifest.json.

Usage:
    python utils/download_unsplash/sync_learn.py
"""

import json
import os
import shutil

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SOURCE_DIR = os.path.join(SCRIPT_DIR, "json")
ROOT_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
DEST_DIR = os.path.join(ROOT_DIR, "public", "learn")


def title_case(name):
    return " ".join(word.capitalize() for word in name.replace("_", " ").split())


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


if __name__ == "__main__":
    main()
