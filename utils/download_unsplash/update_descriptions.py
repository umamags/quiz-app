#!/usr/bin/env python3
"""Fill in blank descriptions in json/*.json using Wikipedia.

For every entry across json/*.json whose "description" is empty, this
script looks the item up on Wikipedia and fills in a one-sentence
description, then writes the file back. Entries that already have a
description (the hand-written ones) are left untouched.

Lookup strategy, per entry:
  1. Search Wikipedia for "<name> <category hint>" (e.g. "bass fish",
     "orange color", "star shape") rather than the bare name -- plain
     names are often ambiguous (bass is a disambiguation page; navy,
     salmon, coral, orange, star, Phoenix etc. all collide with an
     unrelated, more prominent Wikipedia topic).
  2. For each candidate title returned by that search, fetch its REST
     summary. Reject it if Wikipedia flags it as a disambiguation page,
     or if neither the resolved title nor its extract literally contains
     the original name -- both are signs of a wrong-topic match, not a
     fuzzy right one.
  3. From the first candidate that survives, take the extract's first
     sentence (stripped of pronunciation-guide parentheticals) as the
     description.
  4. If nothing survives, the entry is skipped and logged -- never
     written with a guessed/wrong-topic description.

Usage:
    python utils/download_unsplash/update_descriptions.py                 # first 20 due entries, every file
    python utils/download_unsplash/update_descriptions.py --file animals  # only animals.json
    python utils/download_unsplash/update_descriptions.py --limit 50
    python utils/download_unsplash/update_descriptions.py --all           # no limit
    python utils/download_unsplash/update_descriptions.py --dry-run       # preview, no API calls/writes
"""

import argparse
import json
import os
import re
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_DIR = os.path.join(SCRIPT_DIR, "json")

DEFAULT_LIMIT = 20
REQUEST_DELAY_SECONDS = 0.8
SEARCH_CANDIDATES = 3

WIKI_API = "https://en.wikipedia.org/w/api.php"
WIKI_SUMMARY = "https://en.wikipedia.org/api/rest_v1/page/summary/{}"

# A short natural-language hint appended to the search query to steer
# Wikipedia away from an unrelated, more prominent same-name topic (the
# fish "bass" vs. the disambiguation page, the color "navy" vs. the naval
# force, "star" the shape vs. an astronomical star, etc). Categories not
# listed here (or new ones added later) fall back to no hint.
CATEGORY_HINTS = {
    "animals": "animal",
    "butterflies": "butterfly",
    "colors": "color",
    "dinosaurs": "dinosaur",
    "fishes": "fish",
    "flowers": "flower",
    "fruits": "fruit",
    "harrypotter": "mythology",
    "reptiles": "reptile",
    "shapes": "shape",
    "vegetables": "vegetable",
}

USER_AGENT = "quiz-app-description-updater/1.0 (local dev tool for a children's quiz app; low volume)"

try:
    import certifi
    SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CONTEXT = None


def http_get_json(url, retries=5):
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(request, context=SSL_CONTEXT, timeout=20) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code in (429, 503) and attempt < retries - 1:
                time.sleep(2 ** (attempt + 1))
                continue
            if e.code == 404:
                return None
            # A single failed lookup shouldn't crash the whole batch, but a
            # silent "no result" here is indistinguishable in the log from
            # a genuine no-match -- print so it's clear this item is worth
            # re-running later, not actually missing from Wikipedia.
            print(f"    (request failed after retries: HTTP {e.code} on {url})")
            return None
        except urllib.error.URLError as e:
            if attempt < retries - 1:
                time.sleep(1)
                continue
            print(f"    (request failed after retries: {e} on {url})")
            return None
    return None


def search_titles(query, limit=SEARCH_CANDIDATES):
    params = urllib.parse.urlencode({
        "action": "query",
        "list": "search",
        "format": "json",
        "srlimit": limit,
        "srsearch": query,
    })
    data = http_get_json(f"{WIKI_API}?{params}")
    if not data:
        return []
    return [hit["title"] for hit in data.get("query", {}).get("search", [])]


def fetch_summary(title):
    url = WIKI_SUMMARY.format(urllib.parse.quote(title.replace(" ", "_")))
    return http_get_json(url)


def words_in(text):
    return set(re.findall(r"[a-z0-9']+", text.lower()))


# Some names that mean something generic/fictional in this app (e.g.
# "Hogwarts Express") are *also* the name of a real-world theme-park ride,
# and that ride can be the only standalone Wikipedia article with the
# exact name -- title-matching alone can't tell the two apart. Reject on
# these regardless of an otherwise-passing title match; a wrong "it's a
# real Orlando attraction" description is worse than leaving it blank.
REAL_WORLD_ATTRACTION_MARKERS = {
    "theme park", "amusement park", "water park", "roller coaster",
    "resort", "attraction at", "universal orlando", "universal studios",
    "disneyland", "disney world",
}


def is_relevant(name, title, extract):
    """A resolved page counts as relevant only if the query name shows up
    in its title, or in the first sentence of its extract. Checking the
    *whole* extract is too loose -- a long, topically-adjacent article
    (e.g. Circe, for a "wand" search) can mention the query word in
    passing without actually being about it, which produced exactly that
    false match during testing."""
    name_words = words_in(name)
    if not name_words:
        return True
    lowered_extract = extract.lower()
    if any(marker in lowered_extract for marker in REAL_WORLD_ATTRACTION_MARKERS):
        return False
    first_sentence = first_sentence_of(extract) if extract else ""
    haystack = words_in(title) | words_in(first_sentence)
    return name_words.issubset(haystack)


PRONUNCIATION_PAREN = re.compile(
    r"\s*\([^)]*(?:/|listen|help|pronounced|pronunciation)[^)]*\)", re.IGNORECASE
)
SENTENCE_END = re.compile(r"[.!?](?=\s+|$)")
INITIAL_BEFORE = re.compile(r"(?:^|\s)[A-Z]$")


def first_sentence_of(text):
    """Split off the first sentence, without breaking on a single-letter
    initial (e.g. Wikipedia's "J. K. Rowling") as if it ended the
    sentence -- a plain split on ". " truncated exactly that case during
    testing ("...by J.")."""
    start = 0
    for m in SENTENCE_END.finditer(text):
        if INITIAL_BEFORE.search(text[:m.start()]):
            continue
        return text[start:m.end()].strip()
    return text.strip()


def clean_description(extract):
    text = PRONUNCIATION_PAREN.sub("", extract)
    text = re.sub(r"\s+", " ", text).strip()
    first = first_sentence_of(text)
    if first and first[-1] not in ".!?":
        first += "."
    return first


def query_variants(name, category_hint):
    """Query strings to try, in order: hinted first (to steer away from an
    unrelated same-name topic), then the bare name as a fallback for items
    the hint doesn't actually help with (e.g. "wand mythology" finds
    nothing useful, but plain "wand" resolves fine on its own)."""
    variants = []
    if category_hint:
        variants.append(f"{name} {category_hint}")
    if name not in variants:
        variants.append(name)
    return variants


def find_description(name, category_hint):
    for query in query_variants(name, category_hint):
        titles = search_titles(query)
        time.sleep(REQUEST_DELAY_SECONDS)
        for title in titles:
            summary = fetch_summary(title)
            time.sleep(REQUEST_DELAY_SECONDS)
            if not summary:
                continue
            if summary.get("type") == "disambiguation":
                continue
            extract = summary.get("extract", "")
            if not extract:
                continue
            if not is_relevant(name, summary.get("title", title), extract):
                continue
            return clean_description(extract)
    return None


def load_json_list(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def write_json_list(path, items):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(items, f, indent=2)
        f.write("\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--file", help="Only process this json file (e.g. animals or animals.json)")
    parser.add_argument("--limit", type=int, default=DEFAULT_LIMIT, help=f"Max entries to process this run (default {DEFAULT_LIMIT})")
    parser.add_argument("--all", action="store_true", help="No limit -- process every blank-description entry")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be processed; no API calls or writes")
    args = parser.parse_args()

    if not os.path.isdir(JSON_DIR):
        print(f"JSON directory not found: {JSON_DIR}")
        sys.exit(1)

    json_names = sorted(n for n in os.listdir(JSON_DIR) if n.lower().endswith(".json"))
    if args.file:
        wanted = args.file if args.file.endswith(".json") else args.file + ".json"
        json_names = [n for n in json_names if n == wanted]
        if not json_names:
            print(f"No such json file: {wanted}")
            sys.exit(1)

    limit = None if args.all else args.limit
    updated_count = 0
    skipped_count = 0

    for json_name in json_names:
        if limit is not None and updated_count >= limit:
            break

        category = os.path.splitext(json_name)[0]
        json_path = os.path.join(JSON_DIR, json_name)
        items = load_json_list(json_path)
        due = [item for item in items if not item.get("description")]
        if not due:
            continue

        print(f"=== {json_name}: {len(due)} blank description(s) ===")
        if args.dry_run:
            for item in due:
                print(f"  would look up: {item['name']}")
            continue

        hint = CATEGORY_HINTS.get(category, "")
        changed = False

        for item in due:
            if limit is not None and updated_count >= limit:
                break
            name = item["name"]
            description = find_description(name, hint)
            if description:
                item["description"] = description
                changed = True
                updated_count += 1
                print(f"  {name}: {description}")
            else:
                skipped_count += 1
                print(f"  {name}: no confident Wikipedia match, left blank")

        if changed:
            write_json_list(json_path, items)
            print(f"  wrote {json_path}")

    if args.dry_run:
        return
    print(f"Done. Updated {updated_count} entr{'y' if updated_count == 1 else 'ies'}, skipped {skipped_count}.")
    if limit is not None and updated_count >= limit:
        print(f"Hit --limit {limit}. Re-run (or pass --all) to continue with the rest.")


if __name__ == "__main__":
    main()
