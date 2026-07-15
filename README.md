# Quiz App

A single-page quiz app (`index.html`) that loads quizzes from JSON files in `quizzes/`.

## Run it

Because the app loads JSON files with `fetch`, most browsers block this if you
just double-click `index.html` (the `file://` protocol restricts local file
loading for security). Run a tiny local server instead — one command, no
install needed if you have Python:

```
cd quiz-app
python3 -m http.server 8000
```

Then open **http://localhost:8000** in your browser.

(If you don't have Python, any static server works: `npx serve .`, VS Code's
"Live Server" extension, etc.)

## Included quizzes

- `quizzes/child_quiz_1.json` — the "Child Quiz 1" example you specified (cheetah / fastest animal). `showCorrectAnswer: "Y"` — wrong answers get "Incorrect. Please choose again." and must be corrected before moving on.
- `quizzes/child_quiz_2.json` — a demo quiz with `showCorrectAnswer: "N"` — submitting silently records the answer and advances immediately, no feedback message, no forced retry.

## Adding a new quiz

1. Create a new JSON file in `quizzes/` following this schema:

```json
{
  "quizTitle": "My Quiz",
  "showCorrectAnswer": "Y",
  "questions": [
    {
      "questionText": "Question text here",
      "centralImage": "https://example.com/image.jpg",
      "choiceType": "text",
      "choices": ["Choice A", "Choice B", "Choice C", "Choice D"],
      "correctAnswer": "b"
    },
    {
      "questionText": "Another question",
      "centralImage": "https://example.com/image2.jpg",
      "choiceType": "image",
      "choices": [
        "https://example.com/choice-a.jpg",
        "https://example.com/choice-b.jpg",
        "https://example.com/choice-c.jpg",
        "https://example.com/choice-d.jpg"
      ],
      "correctAnswer": "c"
    }
  ]
}
```

Notes:
- `choiceType` is `"text"` or `"image"`. `choices` must always have exactly 4 entries.
- `correctAnswer` is the letter (`a`–`d`) matching the index of the correct choice.
- `centralImage` is required on every question regardless of `choiceType`.
- `showCorrectAnswer` is `"Y"` or `"N"` (case-insensitive), set per quiz.

2. Add an entry to `quizzes/manifest.json`:

```json
{ "title": "Quiz 3: My Quiz", "file": "quizzes/my_quiz.json" }
```

It will then show up automatically on the main menu.

## Behavior notes

- Scoring: 1 point per question where the final stored answer matches `correctAnswer`. Score is computed fresh on the results page, so editing an answer via Back navigation changes the final score.
- Back navigation is always allowed and answers remain editable; Forward (Submit/Next) requires resolving the current question first when `showCorrectAnswer` is `"Y"`.
- Image URLs in the sample quizzes point to a placeholder keyword-image service (loremflickr.com) so the app works out of the box — swap in your own image URLs for production use.
