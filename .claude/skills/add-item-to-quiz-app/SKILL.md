---
description: Create or top up a category CSV (e.g. "insects", "trees") with 50 entries and descriptions, then run the full pipeline to populate images, videos, and audio for the quiz app's Learn section.
argument-hint: [category]
---

The category name for this run is: $ARGUMENTS

Treat it as a lowercase, filename-safe category (e.g. "insects", "trees", "sea creatures" -> "sea_creatures" only if it needs a valid csv filename; otherwise keep it as typed for the CSV's own header/row values, matching the convention already used by animals.csv, birds.csv, fishes.csv etc.).

## 1. Create or top up utils/download_unsplash/csv/<category>.csv

Check whether `utils/download_unsplash/csv/<category>.csv` already exists.

- **If it doesn't exist**: create it with the header
  `<category>,downloaded_ts,json_generated_ts,description,audio_generated_ts`
  (matching animals.csv/birds.csv), then add 50 distinct, well-known items in
  that category, each with a hand-written two-sentence description in the
  established house style: sentence 1 identifies the item with a notable
  physical or behavioral trait; sentence 2 gives a specific, surprising fact.
  Avoid generic filler ("A cool insect that flies.") -- match the tone of
  existing entries in animals.csv or birds.csv. Leave downloaded_ts,
  json_generated_ts, and audio_generated_ts blank for every new row.

- **If it already exists**: read the current row count. If it's already >= 50,
  stop here and report the count -- don't add more or duplicate. If it's
  under 50, add `(50 - current_count)` *new* items not already present in the
  file (case-insensitive name check), with the same description style, to
  bring the total to exactly 50. Don't touch existing rows.

Before finalizing the list, sanity-check for near-duplicate/ambiguous names
within the same category (the birds.csv precedent had this problem: avoid
picking both "eagle" and "bald eagle", or names that are substrings of each
other like "bear" and "polar bear", since that confuses the video-matching
step in the next section -- see download_video_links.py's guard_words_for
for why).

## 2. Run the pipeline, in this order

```
python3 utils/download_unsplash/download_unsplash.py <category>.csv
python3 utils/download_unsplash/download_video_links.py --file <category> --all
python3 utils/download_unsplash/text_to_audio.py --file <category> --all
python3 utils/download_unsplash/update_descriptions.py --file <category>
python3 utils/download_unsplash/sync_learn.py
```

Notes from doing this for birds.csv:

- `download_video_links.py` can take several minutes for 40-50 items (each
  does a Pexels + Pixabay search with rate-limit-friendly delays) -- run it
  in the background rather than blocking, and don't poll; wait for
  completion.
- It will legitimately fail to find a video for a handful of items (no
  matching content on either source, e.g. "albatross" had zero real videos
  anywhere). When that happens, it skips the item and leaves its
  json_generated_ts blank rather than writing a wrong-species/wrong-topic
  video -- do not treat this as a bug. For each skipped item, decide: either
  manually add its json entry with images + description and an empty
  videos array (so it still shows up in the app), or leave it for a future
  run. Prefer the former so nothing silently vanishes from the category.
- Skim the `download_video_links.py` output for anything that looks like a
  wrong match (e.g. a video whose page title clearly isn't the queried
  item). The guard-word/positive-match logic in that script catches most of
  this automatically, but spot-check a few entries in the resulting
  json/<category>.json against their pageUrl before trusting the whole
  batch.

## 3. Validate

- Confirm `json/<category>.json` has one entry per csv row with a
  non-blank description (or a due-for-manual-fill note for genuine gaps),
  5 images each, and that every image/audio path referenced actually
  resolves under `public/`.
- Run `npm test` and confirm it's still green (this pipeline shouldn't
  touch React code, so a failure here means something upstream broke a
  path or file).
- Report a short summary: how many items were newly added vs. already
  present, how many got real videos vs. were skipped, and call out any
  item you had to manually patch.
