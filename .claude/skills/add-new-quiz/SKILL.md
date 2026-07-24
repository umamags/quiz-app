---
description: Generate a new 20-question quiz (15 multiple-choice + 5 match) for a category like "birds" or "insects" from its public/learn/<category>.json data, and register it in public/quizzes/manifest.json.
argument-hint: [category]
---

The category name for this run is: $ARGUMENTS

Treat it as a lowercase category id matching a file already in `public/learn/`
(e.g. "birds" -> `public/learn/birds.json`, "insects" -> `public/learn/insects.json`).

## 0. Resolve the source data

Read `public/learn/<category>.json`. Each entry has `name`, `description`,
`images` (array of `images_downloaded/<category>/...` paths), and other fields
you don't need (`videos`, `audio_desc`).

- **If the file doesn't exist**: stop and tell the user to run
  `/add-item-to-quiz-app <category>` first to populate it, then re-run this
  skill.
- **If it exists but has fewer than ~20 entries**: proceed, but note in your
  final report that some items will be reused across questions since the
  category is small.

## 1. Pick the next quiz filename

List `public/quizzes/child_quiz_*.json`, take the highest existing N, and use
`child_quiz_{N+1}.json` as the new filename. Don't fill gaps in the numbering
(e.g. if only `child_quiz_1`, `child_quiz_3`, `child_quiz_4` exist, the new
file is `child_quiz_5.json`, not `child_quiz_2.json`).

Also compute:
- `categorySingular`: the singular noun for the category (e.g. "birds" ->
  "bird", "insects" -> "insect"). Use judgment for irregular plurals.
- `categoryTitle`: Title Case display name (e.g. "Birds").

## 2. Select items and build the question plan

Pick up to 35 distinct entries from the source data (fewer if the category
has fewer than 35 items):
- 15 entries for multiple-choice questions.
- 20 entries, split into 5 groups of 4, for match questions.

Avoid using the same entry in both a multiple-choice question and a match
pair unless the category doesn't have enough distinct entries.

### 15 multiple-choice questions

Make roughly two-thirds image-led and one-third description-led, so the quiz
mixes text and images rather than being all one or the other:

- **~10 image-led ("What bird is this?")**: `questionText` is
  `"What {categorySingular} is this?"` (vary the phrasing a little across
  questions so they aren't all identical — "Which bird is this?", "What kind
  of bird do you see?"). Set `centralImage` to 2-3 of that entry's image
  paths. `choiceType: "text"`, `choices` is the correct name plus 3 distractor
  names drawn from other entries in the same category (title-cased to match
  existing quiz conventions, e.g. "Blue Jay").
- **~5 description-led riddles, no image**: base the question on the entry's
  `description` field, rewritten as a short, concrete riddle a 3-5 year old
  can follow — one distinguishing trait, simple vocabulary, no `centralImage`.
  For example, from a penguin's description ("a flightless bird that swims...
  in Antarctica"), write something like "Which bird can't fly, waddles on
  ice, and loves to swim?" Still `choiceType: "text"` with 4 choices.

For every multiple-choice question, place the correct answer at a varied
position (don't put it at "b" every time — rotate through a/b/c/d) and set
`correctAnswer` to the matching letter (`"a"`-`"d"`).

### 5 match questions

Each covers one group of 4 entries:
- `questionText`: `"Match each {categorySingular} to its picture"`
- `choiceType: "match"`, `leftType: "text"`, `rightType: "image"`
- `pairs`: one `{ "left": "<Title-cased name>", "right": "<one image path>" }`
  per entry in the group (use the first image path for that entry).

## 3. Assemble the file

Interleave match questions among the multiple-choice ones rather than
clustering them (look at `public/quizzes/child_quiz_4.json` for the pattern:
match questions appear roughly every 3-4 questions, not all at the start or
end).

Write `public/quizzes/child_quiz_{N}.json`:

```json
{
  "quizTitle": "Child Quiz {N}: {categoryTitle}",
  "showCorrectAnswer": "Y",
  "questions": [ /* 20 questions as built above */ ]
}
```

## 4. Register in the manifest

Append to `public/quizzes/manifest.json` (don't touch existing entries):

```json
{ "title": "Quiz {existingCount + 1}: {categoryTitle}", "file": "quizzes/child_quiz_{N}.json" }
```

## 5. Validate

- The new file is valid JSON with exactly 20 questions: 15 with
  `choiceType: "text"` (4 choices, valid `correctAnswer` a-d) and 5 with
  `choiceType: "match"` (4 pairs each).
- Every image path referenced (`centralImage` entries and match `right`
  values) resolves under `public/`.
- `manifest.json` is still valid JSON with the new entry appended last.
- Report a short summary: filename created, how many distinct items were
  used vs. available, and the image/description split for the multiple-choice
  questions.
