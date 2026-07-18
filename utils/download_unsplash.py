#!/usr/bin/env python3
"""Download up to 5 Unsplash photos matching a search query.

Usage:
    python utils/download_unsplash.py peacock
    python utils/download_unsplash.py blue peacock
    python utils/download_unsplash.py queries.csv

When the argument is a single .csv file, each data row (from row 2
onward) is treated as a query pattern in column 1. Images are fetched
per row, and the file is updated in place with a date/timestamp in
column 2 once that row is done. Rows that already have a timestamp are
skipped on subsequent runs, so reprocessing only touches unfinished
rows. If the given .csv filename has no directory component, it is
looked up next to this script.

Set your Unsplash Access Key via the UNSPLASH_ACCESS_KEY environment
variable.
"""

import csv
import json
import os
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime

UNSPLASH_ACCESS_KEY = os.environ.get("UNSPLASH_ACCESS_KEY")

API_URL = "https://api.unsplash.com/search/photos"
MAX_IMAGES = int(os.environ.get("UNSPLASH_MAX_IMAGES", "5"))
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMAGES_DIR = os.path.join(ROOT_DIR, "images_downloaded")

# Some macOS Python installs (notably python.org's installer) ship without
# their cert bundle wired up, causing CERTIFICATE_VERIFY_FAILED regardless of
# this script's own logic. Prefer certifi's CA bundle when available so the
# script works even if the interpreter's own store is broken.
try:
    import certifi
    SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CONTEXT = None


def search_photos(query, access_key, page=1, per_page=20):
    params = urllib.parse.urlencode({"query": query, "page": page, "per_page": per_page})
    url = f"{API_URL}?{params}"
    request = urllib.request.Request(url, headers={"Authorization": f"Client-ID {access_key}"})
    with urllib.request.urlopen(request, context=SSL_CONTEXT) as response:
        return json.loads(response.read().decode("utf-8"))


def download_image(url, dest_path):
    request = urllib.request.Request(url, headers={"User-Agent": "download_unsplash.py"})
    with urllib.request.urlopen(request, context=SSL_CONTEXT) as response, open(dest_path, "wb") as f:
        f.write(response.read())


def slugify(text):
    slug = "".join(c if c.isalnum() else "_" for c in text.lower())
    while "__" in slug:
        slug = slug.replace("__", "_")
    return slug.strip("_")


def report_fetch_error(e):
    """Print a message for a search_photos/download_image failure.

    Returns True if the error is a systemic SSL cert issue (in which case
    the caller should stop entirely instead of retrying other rows).
    """
    if isinstance(e, urllib.error.HTTPError):
        print(f"Unsplash API request failed: {e.code} {e.reason}")
        print(e.read().decode("utf-8", errors="ignore"))
        return False

    if isinstance(e, urllib.error.URLError):
        if isinstance(e.reason, ssl.SSLCertVerificationError):
            print(f"SSL certificate verification failed: {e.reason}")
            print("This is a local Python/macOS certificate-store issue, not a problem with your API key.")
            print("Try one of the following:")
            print("  1. pip install certifi   (then re-run this script)")
            print("  2. If you installed Python from python.org, run its included")
            print('     "Install Certificates.command" (in /Applications/Python 3.x/).')
            return True
        print(f"Could not reach Unsplash API: {e.reason}")
        return False

    print(f"Unexpected error: {e}")
    return False


def process_query(query, access_key, images_dir=IMAGES_DIR):
    """Search Unsplash for `query` and download up to MAX_IMAGES images.

    Returns the number of images successfully downloaded. Raises
    urllib.error.HTTPError/URLError if the search request itself fails.
    """
    data = search_photos(query, access_key)

    results = data.get("results", [])
    if not results:
        print(f"No results found for query: {query!r}")
        return 0

    os.makedirs(images_dir, exist_ok=True)

    slug = slugify(query)
    count = min(MAX_IMAGES, len(results))

    downloaded = 0
    for i, photo in enumerate(results[:count], start=1):
        image_url = photo["urls"]["regular"]
        photo_id = photo["id"]
        filename = f"{slug}_{i}_{photo_id}.jpg"
        dest_path = os.path.join(images_dir, filename)
        try:
            download_image(image_url, dest_path)
            print(f"Downloaded {filename}")
            downloaded += 1
        except (urllib.error.HTTPError, urllib.error.URLError) as e:
            print(f"Failed to download image {i} ({photo_id}): {e}")

    return downloaded


def is_csv_arg(args):
    return len(args) == 1 and args[0].lower().endswith(".csv")


def resolve_csv_path(path):
    if os.path.dirname(path):
        return os.path.abspath(path)
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), path)


def process_csv(csv_path, access_key):
    csv_name = os.path.splitext(os.path.basename(csv_path))[0]
    images_dir = os.path.join(IMAGES_DIR, csv_name)

    with open(csv_path, "r", newline="", encoding="utf-8") as f:
        rows = list(csv.reader(f))

    if not rows:
        print(f"CSV file is empty: {csv_path}")
        return

    header, data_rows = rows[0], rows[1:]
    changed = False

    for row_num, row in enumerate(data_rows, start=2):
        while len(row) < 2:
            row.append("")

        pattern = row[0].strip()
        timestamp = row[1].strip()

        if not pattern:
            continue
        if timestamp:
            print(f"Row {row_num}: skipping {pattern!r} (already processed at {timestamp})")
            continue

        print(f"Row {row_num}: processing pattern {pattern!r}")
        try:
            process_query(pattern, access_key, images_dir=images_dir)
            row[1] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            changed = True
        except (urllib.error.HTTPError, urllib.error.URLError) as e:
            abort = report_fetch_error(e)
            if changed:
                write_csv(csv_path, header, data_rows)
            if abort:
                print("Stopping: fix the certificate issue above, then re-run to pick up remaining rows.")
                sys.exit(1)
            print(f"Row {row_num}: left unprocessed for retry.")

    if changed:
        write_csv(csv_path, header, data_rows)
        print(f"Updated timestamps written to {csv_path}")
    else:
        print("No rows needed processing.")


def write_csv(csv_path, header, data_rows):
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(data_rows)


def main():
    if len(sys.argv) < 2:
        print("Usage: python utils/download_unsplash.py <query terms...>")
        print("       python utils/download_unsplash.py <file.csv>")
        sys.exit(1)

    if not UNSPLASH_ACCESS_KEY:
        print("Error: no Unsplash Access Key configured.")
        print("Set it via: export UNSPLASH_ACCESS_KEY=<your access key>")
        sys.exit(1)

    args = sys.argv[1:]

    if is_csv_arg(args):
        csv_path = resolve_csv_path(args[0])
        if not os.path.isfile(csv_path):
            print(f"CSV file not found: {csv_path}")
            sys.exit(1)
        process_csv(csv_path, UNSPLASH_ACCESS_KEY)
        return

    query = " ".join(args)
    try:
        downloaded = process_query(query, UNSPLASH_ACCESS_KEY)
    except (urllib.error.HTTPError, urllib.error.URLError) as e:
        report_fetch_error(e)
        sys.exit(1)

    print(f"Done. Saved {downloaded} image(s) to {IMAGES_DIR}")


if __name__ == "__main__":
    main()
