# Converting to a Mobile App — Notes

Captured Q&A from planning discussions about turning this Vite/React quiz app
into an iOS + Android app. Kept here for reference before the actual
Capacitor work starts.

---

## Q: What will be the effort to convert this to a mobile app that runs on both iPhone and Android, that runs completely offline?

**A:**

Recommendation: wrap it with **Capacitor** (not a rewrite) — it packages this
Vite/React app as-is into native iOS and Android shells sharing one codebase,
since everything already runs on relative `fetch()` calls against bundled
files. That part is genuinely low effort (days, not weeks): add Capacitor,
point it at `dist/`, add icons/splash screens, and the existing
reducer/state logic, tests, and drag-and-drop just work in the WebView.

The real effort is "completely offline," not "mobile app" — right now the
**videos aren't local at all**, they're streamed from Pexels/Pixabay CDN
URLs (and Mixkit ones are just links to view on their site, not files).
Images are already downloaded and bundled, but going offline means either
downloading and shipping every video file too (likely several hundred
MB–GB across ~600 items, and Mixkit's free tier has a personal-use-only
license that may not permit redistributing files inside a distributed app —
Pexels/Pixabay's licenses are fine for this), or dropping video playback as
an offline feature. That data/licensing decision is the bulk of the real
work here, not the mobile packaging.

---

## Q: OK. I will assume that videos will not work offline. How will the app be distributed to my iPhone and Google Pixel phone? I may want to go through the Apple App Store and Google Play Store later, but for now, I want to test it on my phones.

**A:**

**Google Pixel (Android)** is simple and free: build the Capacitor Android
project in Android Studio, plug the phone in via USB with Developer Mode +
USB debugging turned on, and install directly (`npx cap run android` or a
plain APK install). No account, no cost, no time limit — the app just sits
on the phone like anything else you sideload.

**iPhone** is more restrictive — Apple requires every app on a physical
device to be code-signed, even just for your own testing, and
building/signing has to be done through Xcode (which needs a Mac). Two
options:

- **Free Apple ID**: Xcode can install straight to your phone at no cost,
  but the signature expires after **7 days**, so you'd reconnect and
  reinstall weekly during testing.
- **Paid Apple Developer account ($99/year)**: signatures last up to a
  year, and you can additionally use **TestFlight** for wireless installs
  without a cable. This is also the same account you'd need anyway for an
  eventual App Store release, so if you're fairly confident you'll publish
  later, paying now avoids buying it twice.

Given you said you might go to the stores later, leaning toward just paying
the $99 up front removes the 7-day reset annoyance and doubles as your
eventual publishing account. Staying free for now (7-day Xcode reinstall)
is a fine way to kick the tires first.

---

## Q: I am using Claude Code inside VS Code as of now. Can I use Claude Code from Xcode? Can I also set this quiz-app project on Xcode and set up Capacitor using Xcode?

**A:**

**Claude Code in Xcode**: Yes — as of Xcode 26 (early 2026), Apple added
native Claude integration under Preferences → Intelligence (needs a
Pro/Max or Team/Enterprise plan, authenticated with your Claude account).
It gives inline suggestions, chat, doc generation, and SwiftUI preview help
directly in the editor.

Worth knowing it's a different tool than what's used in VS Code, though:
that's Apple's own in-editor assistant with Claude as the backend, not the
full Claude Code agent — it won't have the same file-editing-across-the-repo,
running shell commands, multi-step autonomous work you get from Claude Code
proper. For the kind of heavier multi-file/build/test work, you'd still
want actual Claude Code — which can run in Terminal.app (or iTerm) pointed
at the project directory, open alongside Xcode. Xcode has no built-in
terminal panel, but that's fine: Claude Code edits files on disk, and Xcode
picks up changes automatically since it watches the filesystem, so the two
work side by side without conflict.

**Setting up quiz-app + Capacitor in Xcode**: Yes, that's the normal
workflow. Roughly:

1. `npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android`,
   then `npx cap init`.
2. `npm run build` (existing Vite build) to produce `dist/`.
3. `npx cap add ios` — generates a real native Xcode project/workspace
   under `ios/`.
4. `npx cap sync` — copies the latest web build into the native project.
   Run this after every web-side change you want reflected on the phone.
5. `npx cap open ios` — opens the generated `.xcworkspace` in Xcode.

From there, Xcode is only used for the native shell: code
signing/provisioning (Apple ID or dev account), app icons/splash screen,
running on a physical iPhone or the simulator, and eventually archiving for
App Store submission. React/JS code is never hand-edited inside Xcode —
that stays in VS Code with Claude Code; Xcode just needs a `cap sync` after
each change to pick it up.

---

## Q: Is there a way to review the code for me to know that it's ready for the Google Play Store and Apple App Store?

**A:**

Not really as a single step — "ready for the app stores" spans two
different kinds of readiness, and code review only covers one of them.

**What a code review *can* tell you**: whether the app itself is solid —
bugs, security issues (e.g. exposed API keys, XSS-type risks), code
quality. `/code-review` and `/security-review` exist for that, but they
review the *pending diff/changes on the current branch*, not a
"is this store-ready" audit — and at the time of this discussion there was
no Capacitor project yet, so there's no native code to review either.

**What determines actual store readiness is mostly not code** — it's a
checklist of things that don't exist in the project yet:

- Native scaffolding itself (`ios/`/`android/` folders — none exist until
  `cap add ios`/`cap add android` is run)
- App icons (multiple sizes), splash screen, bundle identifier / package
  name
- Code signing (Apple Developer cert, Android keystore)
- A **privacy policy URL** — both stores require one even for a fully
  offline app with no data collection
- Content/age rating questionnaires (relevant here since it's a kids' quiz
  app — COPPA-adjacent questions on both stores)
- Screenshots and store listing metadata (description, category, etc.)
- The **Mixkit video licensing question** (see the offline-effort Q&A
  above) needs resolving before anything ships, since that's a
  rejection/legal risk, not a code bug

So the realistic sequence is: finish the Capacitor setup → run
`/security-review` or `/code-review` on the native + web code as a quality
gate → separately work through the non-code checklist above.
