# Quiz App

A quiz app (React + Vite) that loads quizzes from JSON files in `public/quizzes/`.

## Run it

Requires [Node.js](https://nodejs.org/) (npm comes with it).

```
cd quiz-app
npm install
npm run dev
```

Then open the local URL Vite prints (typically **http://localhost:5173**).

To build a static production bundle:

```
npm run build     # outputs to dist/
npm run preview   # serve the built bundle locally to sanity-check it
```

## Included quizzes

- `public/quizzes/child_quiz_1.json` — "Animals" — text-choice questions with 3 photos per question.
- `public/quizzes/child_quiz_3.json` — "Fruits & Vegetables" — text-choice questions with 3 photos per question.
- `public/quizzes/child_quiz_4.json` — "Mix & Match" — 2 multiple-choice questions plus 2 drag-and-drop "match the following" questions.

`showCorrectAnswer` is set per quiz: `"Y"` means wrong answers show "Incorrect. Please choose again." and must be corrected before moving on; `"N"` means submitting silently records the answer and advances immediately, no feedback message, no forced retry.

## Adding a new quiz

Create a new JSON file in `public/quizzes/` and add an entry to `public/quizzes/manifest.json`:

```json
{ "title": "Quiz 4: My Quiz", "file": "quizzes/my_quiz.json" }
```

It will then show up automatically on the main menu. Three question shapes are supported:

**Multiple choice (text or image):**

```json
{
  "questionText": "Which fruit is this?",
  "centralImage": [
    "images_downloaded/fruits/apple_1_....jpg",
    "images_downloaded/fruits/apple_2_....jpg",
    "images_downloaded/fruits/apple_3_....jpg"
  ],
  "choiceType": "text",
  "choices": ["Apple", "Pear", "Peach", "Guava"],
  "correctAnswer": "a"
}
```

- `choiceType` is `"text"` or `"image"`. `choices` must always have exactly 4 entries (image choices use image paths instead of labels).
- `correctAnswer` is the letter (`a`–`d`) matching the index of the correct choice.
- `centralImage` is optional. When present it can be a single path or an array of paths — an array renders that many photos side by side (use distinct photos to avoid repeats).

**Match the following (drag and drop):**

```json
{
  "questionText": "Match each big cat to its picture",
  "choiceType": "match",
  "leftType": "text",
  "rightType": "image",
  "pairs": [
    { "left": "Lion", "right": "images/lion_1.jpg" },
    { "left": "Tiger", "right": "images/tiger_300_300.jpg" },
    { "left": "Leopard", "right": "images/leopard_300_300.jpg" },
    { "left": "Panther", "right": "images/panther_300_300.jpg" }
  ]
}
```

- `leftType`/`rightType` are each `"text"` or `"image"`.
- The right column is shown in a shuffled order; the left column is authored order. Dragging a left item onto its matching right item marks both green; a wrong drop flashes red and resets. The question is complete once all pairs are matched.
- No `correctAnswer`/`choices`/`centralImage` needed for this type.

Image paths are relative to `public/` (e.g. `images/...`, `images_downloaded/<category>/...`) — see `utils/download_unsplash.py` for fetching new photo sets.

## Behavior notes

- Scoring: 1 point per question. For text/image questions, the final stored answer must match `correctAnswer`. For match questions, all pairs must be correctly matched. Score is computed fresh on the results page.
- Back navigation is always allowed. A question with an unresolved (wrong or incomplete) answer stays editable; once a question is answered correctly (or fully matched), revisiting it via Back shows it already resolved rather than reopening it for editing.
- Drag-and-drop uses [`@dnd-kit`](https://dndkit.com/), which works with mouse, touch, and keyboard — this replaced an earlier native HTML5 drag-and-drop implementation that didn't work on touchscreens (e.g. iOS Safari).

## Tests

```
npm test
```

Runs the Vitest suite (`src/**/*.test.js(x)`): reducer/scoring unit tests plus React Testing Library integration tests covering the menu, retry/silent-scoring quiz flows, and the match-question rendering contract. The interactive drag gesture itself needs real browser layout (jsdom doesn't support it), so that path is verified with a headless-browser check instead of a unit test.
