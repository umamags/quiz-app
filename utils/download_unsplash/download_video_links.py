#!/usr/bin/env python3
"""Generate per-category Learn json files from the csv/ query lists.

For every csv in csv/ (animals.csv, colors.csv, ...), and for each row whose
3rd column (json_generated_ts) is empty, this script:

  1. Looks up the row's already-downloaded images under
     public/images_downloaded/<category>/ (see download_unsplash.py).
  2. Searches the Pexels and Pixabay video APIs for a short, on-topic clip
     and verifies the picked file URL actually resolves before using it.
  3. Writes/updates json/<category>.json with one element per row:
     { "name", "description", "images", "videos" }.
  4. Stamps the row's 3rd csv column with the current timestamp, so re-runs
     only touch rows that haven't been processed yet.

"description" is intentionally left as "" -- neither Pexels nor Pixabay
provide a real descriptive sentence (only tags/keywords), so that field is
filled in by hand afterward. Mixkit is not queried here (no public API);
add Mixkit entries by hand if wanted.

Usage:
    python utils/download_unsplash/download_video_links.py                 # first 10 due rows, every csv
    python utils/download_unsplash/download_video_links.py --file animals  # only animals.csv
    python utils/download_unsplash/download_video_links.py --limit 25
    python utils/download_unsplash/download_video_links.py --all           # no limit
    python utils/download_unsplash/download_video_links.py --dry-run       # preview, no API calls/writes

Requires PEXELS_API_KEY and PIXABAY_API_KEY, either as environment
variables or in utils/download_unsplash/.env (git-ignored):
    PEXELS_API_KEY=...
    PIXABAY_API_KEY=...
"""

import argparse
import csv
import json
import os
import re
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime

from download_unsplash import slugify

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(os.path.dirname(SCRIPT_DIR))
CSV_DIR = os.path.join(SCRIPT_DIR, "csv")
JSON_DIR = os.path.join(SCRIPT_DIR, "json")
IMAGES_DIR = os.path.join(ROOT_DIR, "public", "images_downloaded")
ENV_PATH = os.path.join(SCRIPT_DIR, ".env")

DEFAULT_LIMIT = 10
MAX_CLIP_SECONDS = 25
REQUEST_DELAY_SECONDS = 0.5

# Single words that, if present anywhere in a candidate's tags/title, mean
# skip it -- overwhelmingly cooking/food/AI-generated/cartoon clips, not
# real footage of the live animal/object the query is about. Checked as
# whole-word tokens (so "hawaii" doesn't false-positive on "ai", etc).
BLOCKLIST_WORDS = {
    "cooking", "cook", "recipe", "kitchen", "chef", "sushi", "sashimi",
    "butcher", "slicing", "knife", "restaurant", "grill", "grilling",
    "seafood", "meal", "dish", "food", "diet",
    "cartoon", "3d", "illustration", "animation", "animated", "anime",
    "watercolor", "cgi", "clipart", "vector", "ai", "generated",
}

# Fixed multi-word phrases only meaningful together (so we don't block on
# e.g. "green" alone, which is common in legitimate nature footage).
BLOCKLIST_PHRASES = {"green screen", "chroma key", "hand-drawn"}

# Articles/prepositions too generic to usefully (a) require a literal
# positive match against (require_positive_match) or (b) disambiguate a
# name collision with (guard_words_for).
COMMON_STOPWORDS = {"the", "a", "an", "of", "and", "in", "on"}

try:
    import certifi
    SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CONTEXT = None


def load_env_file(path):
    """Populate os.environ from a KEY=VALUE .env file, without overwriting
    any already-set variable (real env vars win over the file)."""
    if not os.path.isfile(path):
        return
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())


load_env_file(ENV_PATH)
PEXELS_API_KEY = os.environ.get("PEXELS_API_KEY")
PIXABAY_API_KEY = os.environ.get("PIXABAY_API_KEY")


USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)


def http_get_json(url, headers=None, retries=3):
    all_headers = {"User-Agent": USER_AGENT, **(headers or {})}
    request = urllib.request.Request(url, headers=all_headers)
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(request, context=SSL_CONTEXT, timeout=20) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < retries - 1:
                time.sleep(2 ** attempt)
                continue
            raise
    return None


def url_is_live(url, retries=2):
    """HEAD-check (falling back to a 1-byte ranged GET) that a video file
    URL actually resolves, so we never write a dead link into the json."""
    for attempt in range(retries):
        try:
            request = urllib.request.Request(url, method="HEAD", headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(request, context=SSL_CONTEXT, timeout=15) as response:
                return 200 <= response.status < 300
        except urllib.error.HTTPError as e:
            if e.code == 405:  # HEAD not allowed -- try a ranged GET instead
                try:
                    request = urllib.request.Request(
                        url, headers={"User-Agent": USER_AGENT, "Range": "bytes=0-0"}
                    )
                    with urllib.request.urlopen(request, context=SSL_CONTEXT, timeout=15) as response:
                        return response.status in (200, 206)
                except urllib.error.URLError:
                    return False
            if attempt < retries - 1:
                time.sleep(1)
                continue
            return False
        except urllib.error.URLError:
            if attempt < retries - 1:
                time.sleep(1)
                continue
            return False
    return False


def words_in(text):
    return set(re.findall(r"[a-z0-9']+", text.lower()))


def hits_blocklist(text, extra_terms=()):
    lowered = text.lower()
    if any(phrase in lowered for phrase in BLOCKLIST_PHRASES):
        return True
    tokens = words_in(text)
    if tokens & BLOCKLIST_WORDS:
        return True
    return bool(tokens & set(extra_terms))


def require_positive_match(query, *texts):
    """True if every significant word of `query` literally appears (as a
    whole word) somewhere across `texts` (tags, page-url slug, ...).

    Pexels/Pixabay search is loose enough that a query like "fox" or
    "raccoon" can return a same-vibe-but-wrong-animal clip (a husky tagged
    only "dog", a cat in some bushes) with no blocklist word to catch it.
    Requiring the query itself show up turns those into "no result" instead
    of silently wrong content -- worse recall, but that's the right
    trade-off for a kids' educational app with no per-item human review."""
    combined = set()
    for text in texts:
        combined |= words_in(text)
    query_words = set(query.lower().split()) - COMMON_STOPWORDS
    if not query_words:
        return True
    return query_words.issubset(combined)


def guard_words_for(name, all_names):
    """Words that disambiguate `name` from other, longer names in the same
    csv that contain it as a whole word (e.g. "panda" vs "red panda", "bear"
    vs "polar bear"). A search for "panda" that returns a clip tagged/titled
    with "red" is almost certainly the wrong animal, not a fuzzy match on
    "panda" -- so those words get blocked for this query specifically."""
    name_words = set(name.lower().split())
    guard = set()
    for other in all_names:
        if other == name:
            continue
        other_words = other.lower().split()
        if len(other_words) <= len(name_words):
            continue
        if not re.search(rf"\b{re.escape(name.lower())}\b", other.lower()):
            continue
        guard |= (set(other_words) - name_words) - COMMON_STOPWORDS
    return guard


def search_pexels(query, guard_words=()):
    params = urllib.parse.urlencode({"query": query, "per_page": 15})
    url = f"https://api.pexels.com/videos/search?{params}"
    data = http_get_json(url, headers={"Authorization": PEXELS_API_KEY})
    if not data:
        return None

    candidates = []
    for v in data.get("videos", []):
        if v["duration"] > MAX_CLIP_SECONDS:
            continue
        text = v.get("url", "") + " " + " ".join(v.get("tags", []) or [])
        if hits_blocklist(text, guard_words):
            continue
        if not require_positive_match(query, text):
            continue
        candidates.append(v)
    candidates.sort(key=lambda v: v["duration"])

    for v in candidates:
        file_ = next((f for f in v["video_files"] if f["quality"] == "hd"), v["video_files"][0] if v["video_files"] else None)
        if not file_:
            continue
        if not url_is_live(file_["link"]):
            continue
        return {
            "source": "pexels",
            "type": "file",
            "url": file_["link"],
            "pageUrl": v["url"],
            "durationSeconds": v["duration"],
        }
    return None


def search_pixabay(query, guard_words=()):
    params = urllib.parse.urlencode({"key": PIXABAY_API_KEY, "q": query, "per_page": 15})
    url = f"https://pixabay.com/api/videos/?{params}"
    data = http_get_json(url)
    if not data:
        return None

    candidates = []
    for h in data.get("hits", []):
        if h["duration"] > MAX_CLIP_SECONDS:
            continue
        tags = h.get("tags", "")
        if hits_blocklist(tags, guard_words):
            continue
        if not require_positive_match(query, tags):
            continue
        candidates.append(h)
    candidates.sort(key=lambda h: h["duration"])

    for h in candidates:
        file_url = h["videos"]["medium"]["url"]
        if not url_is_live(file_url):
            continue
        return {
            "source": "pixabay",
            "type": "file",
            "url": file_url,
            "pageUrl": h["pageURL"],
            "durationSeconds": h["duration"],
        }
    return None


def find_images(category, name):
    slug = slugify(name)
    folder = os.path.join(IMAGES_DIR, category)
    if not os.path.isdir(folder):
        return []
    pattern = re.compile(rf"^{re.escape(slug)}_(\d+)_.*\.jpe?g$", re.IGNORECASE)
    matches = []
    for filename in os.listdir(folder):
        m = pattern.match(filename)
        if m:
            matches.append((int(m.group(1)), filename))
    matches.sort(key=lambda pair: pair[0])
    return [f"images_downloaded/{category}/{filename}" for _, filename in matches]


def load_json_list(path):
    if not os.path.isfile(path):
        return []
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def write_json_list(path, items):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(items, f, indent=2)
        f.write("\n")


def upsert_item(items, entry):
    for i, existing in enumerate(items):
        if existing["name"] == entry["name"]:
            items[i] = entry
            return
    items.append(entry)


def write_csv(csv_path, header, data_rows):
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(data_rows)


def due_rows(csv_path):
    with open(csv_path, "r", newline="", encoding="utf-8") as f:
        rows = list(csv.reader(f))
    if not rows:
        return None, [], []

    header, data_rows = rows[0], rows[1:]
    while len(header) < 3:
        header.append("json_generated_ts" if len(header) == 2 else f"col{len(header) + 1}")

    due = []
    for row_num, row in enumerate(data_rows, start=2):
        while len(row) < 3:
            row.append("")
        name = row[0].strip()
        downloaded_ts = row[1].strip()
        json_generated_ts = row[2].strip()
        if not name or json_generated_ts:
            continue
        if not downloaded_ts:
            print(f"  skip {name!r}: no downloaded_ts yet (run download_unsplash.py first)")
            continue
        due.append((row_num, row))
    return header, data_rows, due


def process_row(category, name, all_names):
    images = find_images(category, name)
    if not images:
        print(f"  skip {name!r}: no downloaded images found under images_downloaded/{category}/")
        return None

    guard_words = guard_words_for(name, all_names)
    if guard_words:
        print(f"    guarding against: {sorted(guard_words)}")

    videos = []
    pexels_hit = search_pexels(name, guard_words)
    time.sleep(REQUEST_DELAY_SECONDS)
    if pexels_hit:
        videos.append(pexels_hit)
    else:
        print(f"    pexels: no usable clip found for {name!r}")

    pixabay_hit = search_pixabay(name, guard_words)
    time.sleep(REQUEST_DELAY_SECONDS)
    if pixabay_hit:
        videos.append(pixabay_hit)
    else:
        print(f"    pixabay: no usable clip found for {name!r}")

    if not videos:
        print(f"  skip {name!r}: no video found on either source")
        return None

    return {"name": name, "description": "", "images": images, "videos": videos}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--file", help="Only process this csv (e.g. animals or animals.csv)")
    parser.add_argument("--limit", type=int, default=DEFAULT_LIMIT, help=f"Max rows to process this run (default {DEFAULT_LIMIT})")
    parser.add_argument("--all", action="store_true", help="No limit -- process every due row")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be processed; no API calls or writes")
    args = parser.parse_args()

    if not args.dry_run and not (PEXELS_API_KEY and PIXABAY_API_KEY):
        print("Error: PEXELS_API_KEY and PIXABAY_API_KEY must be set (env or utils/download_unsplash/.env).")
        sys.exit(1)

    if not os.path.isdir(CSV_DIR):
        print(f"CSV directory not found: {CSV_DIR}")
        sys.exit(1)
    os.makedirs(JSON_DIR, exist_ok=True)

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

        category = os.path.splitext(csv_name)[0]
        csv_path = os.path.join(CSV_DIR, csv_name)
        header, data_rows, due = due_rows(csv_path)
        if not due:
            continue

        print(f"=== {csv_name}: {len(due)} row(s) due ===")
        if args.dry_run:
            for _, row in due:
                print(f"  would process: {row[0]}")
            continue

        json_path = os.path.join(JSON_DIR, f"{category}.json")
        items = load_json_list(json_path)
        changed = False
        all_names = [row[0].strip() for row in data_rows if row[0].strip()]

        for row_num, row in due:
            if limit is not None and processed_count >= limit:
                break
            name = row[0].strip()
            print(f"  {name}")
            entry = process_row(category, name, all_names)
            if entry is None:
                skipped_count += 1
                continue
            upsert_item(items, entry)
            row[2] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            changed = True
            processed_count += 1

        if changed:
            write_json_list(json_path, items)
            write_csv(csv_path, header, data_rows)
            print(f"  wrote {json_path} and updated {csv_name}")

    if args.dry_run:
        return
    print(f"Done. Processed {processed_count} row(s), skipped {skipped_count}.")
    if limit is not None and processed_count >= limit:
        print(f"Hit --limit {limit}. Re-run (or pass --all) to continue with the rest.")


if __name__ == "__main__":
    main()
