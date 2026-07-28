#!/usr/bin/env python3
"""Download cartoon/illustration images from Pixabay matching a search query.

Unlike download_unsplash.py (real photography), this targets Pixabay's
illustration/vector content -- cartoon-style art suitable for a kids' app --
via image_type=illustration and safesearch=true.

Usage:
    python utils/download_unsplash/download_pixabay.py kangaroo
    python utils/download_unsplash/download_pixabay.py brown bear
    python utils/download_unsplash/download_pixabay.py queries.csv
    python utils/download_unsplash/download_pixabay.py

When the argument is a single .csv file, each data row (from row 2
onward) is treated as a query pattern in column 1. Images are fetched
per row, and the file is updated in place with a date/timestamp in
column 2 once that row is done. Rows that already have a timestamp are
skipped on subsequent runs, so reprocessing only touches unfinished
rows. If the given .csv filename has no directory component, it is
looked up in this script's csv/ subfolder; a path with a directory
component is resolved relative to the current folder instead.

With no arguments at all, every .csv file in this script's csv/
subfolder is processed in turn (alphabetically).

Set your Pixabay API key via the PIXABAY_API_KEY environment variable.
Override the number of images per query with PIXABAY_MAX_IMAGES (default 3).
Override the destination root with PIXABAY_IMAGES_DIR (default
public/images_downloaded, matching download_unsplash.py's convention).
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

PIXABAY_API_KEY = os.environ.get("PIXABAY_API_KEY")

API_URL = "https://pixabay.com/api/"
MAX_IMAGES = int(os.environ.get("PIXABAY_MAX_IMAGES", "3"))
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
IMAGES_DIR = os.environ.get("PIXABAY_IMAGES_DIR", os.path.join(ROOT_DIR, "public", "images_downloaded"))
CSV_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "csv")

# Some macOS Python installs (notably python.org's installer) ship without
# their cert bundle wired up, causing CERTIFICATE_VERIFY_FAILED regardless of
# this script's own logic. Prefer certifi's CA bundle when available so the
# script works even if the interpreter's own store is broken.
try:
    import certifi
    SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CONTEXT = None


def search_images(query, api_key, page=1, per_page=20):
    params = urllib.parse.urlencode({
        "key": api_key,
        "q": query,
        "image_type": "illustration",
        "safesearch": "true",
        "page": page,
        "per_page": per_page,
    })
    url = f"{API_URL}?{params}"
    request = urllib.request.Request(url, headers={"User-Agent": "download_pixabay.py"})
    with urllib.request.urlopen(request, context=SSL_CONTEXT) as response:
        return json.loads(response.read().decode("utf-8"))


def download_image(url, dest_path):
    request = urllib.request.Request(url, headers={"User-Agent": "download_pixabay.py"})
    with urllib.request.urlopen(request, context=SSL_CONTEXT) as response, open(dest_path, "wb") as f:
        f.write(response.read())


def slugify(text):
    slug = "".join(c if c.isalnum() else "_" for c in text.lower())
    while "__" in slug:
        slug = slug.replace("__", "_")
    return slug.strip("_")


def report_fetch_error(e):
    """Print a message for a search_images/download_image failure.

    Returns True if the error is a systemic SSL cert issue (in which case
    the caller should stop entirely instead of retrying other rows).
    """
    if isinstance(e, urllib.error.HTTPError):
        print(f"Pixabay API request failed: {e.code} {e.reason}")
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
        print(f"Could not reach Pixabay API: {e.reason}")
        return False

    print(f"Unexpected error: {e}")
    return False


def image_extension(url):
    path = urllib.parse.urlparse(url).path
    ext = os.path.splitext(path)[1]
    return ext if ext else ".jpg"


def process_query(query, api_key, images_dir=IMAGES_DIR):
    """Search Pixabay for `query` and download up to MAX_IMAGES illustrations.

    Returns the number of images successfully downloaded. Raises
    urllib.error.HTTPError/URLError if the search request itself fails.
    """
    data = search_images(query, api_key)

    hits = data.get("hits", [])
    if not hits:
        print(f"No results found for query: {query!r}")
        return 0

    os.makedirs(images_dir, exist_ok=True)

    slug = slugify(query)
    count = min(MAX_IMAGES, len(hits))

    downloaded = 0
    for i, hit in enumerate(hits[:count], start=1):
        image_url = hit.get("largeImageURL") or hit["webformatURL"]
        image_id = hit["id"]
        filename = f"{slug}_{i}_{image_id}{image_extension(image_url)}"
        dest_path = os.path.join(images_dir, filename)
        try:
            download_image(image_url, dest_path)
            print(f"Downloaded {filename} (tags: {hit.get('tags', '')})")
            downloaded += 1
        except (urllib.error.HTTPError, urllib.error.URLError) as e:
            print(f"Failed to download image {i} ({image_id}): {e}")

    return downloaded


def is_csv_arg(args):
    return len(args) == 1 and args[0].lower().endswith(".csv")


def resolve_csv_path(path):
    if os.path.dirname(path):
        return os.path.abspath(path)
    return os.path.join(CSV_DIR, path)


def process_csv(csv_path, api_key):
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
            process_query(pattern, api_key, images_dir=images_dir)
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


def process_all_csvs(api_key):
    if not os.path.isdir(CSV_DIR):
        print(f"CSV directory not found: {CSV_DIR}")
        sys.exit(1)

    csv_names = sorted(name for name in os.listdir(CSV_DIR) if name.lower().endswith(".csv"))
    if not csv_names:
        print(f"No CSV files found in {CSV_DIR}")
        return

    for csv_name in csv_names:
        print(f"=== Processing {csv_name} ===")
        process_csv(os.path.join(CSV_DIR, csv_name), api_key)


def main():
    if not PIXABAY_API_KEY:
        print("Error: no Pixabay API key configured.")
        print("Set it via: export PIXABAY_API_KEY=<your api key>")
        sys.exit(1)

    args = sys.argv[1:]

    if not args:
        process_all_csvs(PIXABAY_API_KEY)
        return

    if is_csv_arg(args):
        csv_path = resolve_csv_path(args[0])
        if not os.path.isfile(csv_path):
            print(f"CSV file not found: {csv_path}")
            sys.exit(1)
        process_csv(csv_path, PIXABAY_API_KEY)
        return

    query = " ".join(args)
    try:
        downloaded = process_query(query, PIXABAY_API_KEY)
    except (urllib.error.HTTPError, urllib.error.URLError) as e:
        report_fetch_error(e)
        sys.exit(1)

    print(f"Done. Saved {downloaded} image(s) to {IMAGES_DIR}")


if __name__ == "__main__":
    main()
