const { JSDOM } = require('jsdom');
const path = require('path');
const fs = require('fs');

const APP_DIR = path.join(__dirname, '..');

async function run() {
  const dom = await JSDOM.fromFile(path.join(APP_DIR, 'index.html'), {
    resources: 'usable',
    runScripts: 'dangerously',
    beforeParse(window) {
      // Minimal fetch polyfill: serves local JSON files relative to the app dir.
      // jsdom has no native fetch implementation, and this app only fetches
      // its own relative quizzes/*.json files, so a filesystem-backed stub
      // is sufficient to exercise the real app logic end-to-end.
      window.fetch = function (url) {
        return new Promise((resolve) => {
          try {
            const filePath = path.join(APP_DIR, url);
            const text = fs.readFileSync(filePath, 'utf8');
            resolve({ ok: true, json: () => Promise.resolve(JSON.parse(text)), text: () => Promise.resolve(text) });
          } catch (e) {
            resolve({ ok: false, json: () => Promise.reject(e) });
          }
        });
      };
    }
  });
  const { window } = dom;
  const doc = window.document;

  // wait for initial manifest fetch + render
  await new Promise(r => setTimeout(r, 500));

  const log = (msg) => console.log(msg);
  let failures = 0;
  const assert = (cond, msg) => {
    if (cond) { log('PASS: ' + msg); } else { log('FAIL: ' + msg); failures++; }
  };

  // ---- MENU ----
  const menuItems = doc.querySelectorAll('#menu-list .menu-item');
  assert(menuItems.length === 2, 'menu shows 2 quizzes, found ' + menuItems.length);
  assert(menuItems[0].textContent.includes('Child Quiz 1'), 'first menu item is Child Quiz 1');

  // ---- START QUIZ 1 (Child Quiz 1, showCorrectAnswer=Y) ----
  menuItems[0].dispatchEvent(new window.Event('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 400));
  assert(!doc.getElementById('screen-quiz').classList.contains('hidden'), 'quiz screen visible after selecting quiz 1');
  assert(doc.getElementById('question-text').textContent === 'Which animal is this?', 'Q1 text correct');
  assert(doc.getElementById('central-image').src.includes('cheetah'), 'Q1 central image is cheetah placeholder');

  const choices1 = doc.querySelectorAll('#choices .choice');
  assert(choices1.length === 4, 'Q1 has 4 choices');
  assert(!choices1[0].classList.contains('image-choice'), 'Q1 choices render as text (not image cards)');

  // Try WRONG answer first (choice a = Leopard, correct is b = Cheetah)
  choices1[0].dispatchEvent(new window.Event('click', { bubbles: true }));
  doc.getElementById('btn-submit').dispatchEvent(new window.Event('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 100));
  const fb1 = doc.getElementById('feedback');
  assert(!fb1.classList.contains('hidden') && fb1.textContent === 'Incorrect. Please choose again.', 'wrong answer shows incorrect message: got "' + fb1.textContent + '"');
  assert(doc.getElementById('btn-next').classList.contains('hidden'), 'Next button hidden after wrong answer');

  // Now pick CORRECT answer (b = Cheetah)
  choices1[1].dispatchEvent(new window.Event('click', { bubbles: true }));
  doc.getElementById('btn-submit').dispatchEvent(new window.Event('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 100));
  assert(fb1.textContent === 'Great job!', 'correct answer shows Great job!: got "' + fb1.textContent + '"');
  assert(!doc.getElementById('btn-next').classList.contains('hidden'), 'Next button visible after correct answer');

  // Go to Q2 (image choices)
  doc.getElementById('btn-next').dispatchEvent(new window.Event('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 100));
  assert(doc.getElementById('progress-label').textContent === 'Question 2 of 2', 'now on question 2');
  const choices2 = doc.querySelectorAll('#choices .choice');
  assert(choices2[0].classList.contains('image-choice'), 'Q2 choices render as image cards');
  assert(choices2[0].querySelector('img').src.includes('lion'), 'Q2 choice A image is lion');
  assert(choices2[2].querySelector('img').src.includes('deer'), 'Q2 choice C image is deer');

  // Test BACK navigation to Q1 - should show stored correct answer + Great job + Next visible
  doc.getElementById('btn-back').dispatchEvent(new window.Event('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 100));
  assert(doc.getElementById('progress-label').textContent === 'Question 1 of 2', 'back navigation returns to question 1');
  assert(doc.getElementById('choices').querySelectorAll('.choice')[1].classList.contains('selected'), 'previously selected correct choice (b) still shown selected');
  assert(doc.getElementById('feedback').textContent === 'Great job!', 'revisited correct question still shows Great job!');
  assert(!doc.getElementById('btn-next').classList.contains('hidden'), 'Next still available on revisit');

  // Go forward again, answer Q2 correctly (c = deer)
  doc.getElementById('btn-next').dispatchEvent(new window.Event('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 100));
  const choices2b = doc.querySelectorAll('#choices .choice');
  choices2b[2].dispatchEvent(new window.Event('click', { bubbles: true }));
  doc.getElementById('btn-submit').dispatchEvent(new window.Event('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 100));
  assert(doc.getElementById('feedback').textContent === 'Great job!', 'Q2 correct answer shows Great job!');
  assert(doc.getElementById('btn-next').textContent === 'See Results', 'last question Next button reads See Results');

  doc.getElementById('btn-next').dispatchEvent(new window.Event('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 100));
  assert(!doc.getElementById('screen-results').classList.contains('hidden'), 'results screen visible');
  assert(doc.getElementById('score-number').textContent === '2 / 2', 'score shows 2/2: got ' + doc.getElementById('score-number').textContent);

  // Go back from results into quiz to edit Q2 to a WRONG answer, verify score drops
  doc.getElementById('btn-results-back').dispatchEvent(new window.Event('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 100));
  assert(doc.getElementById('progress-label').textContent === 'Question 2 of 2', 'results-back lands on last question');
  const choices2c = doc.querySelectorAll('#choices .choice');
  choices2c[0].dispatchEvent(new window.Event('click', { bubbles: true })); // wrong: lion
  doc.getElementById('btn-submit').dispatchEvent(new window.Event('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 100));
  assert(doc.getElementById('feedback').textContent === 'Incorrect. Please choose again.', 'editing to wrong answer shows incorrect message');
  // fix it back
  choices2c[2].dispatchEvent(new window.Event('click', { bubbles: true }));
  doc.getElementById('btn-submit').dispatchEvent(new window.Event('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 100));
  doc.getElementById('btn-next').dispatchEvent(new window.Event('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 100));
  assert(doc.getElementById('score-number').textContent === '2 / 2', 'score recomputed correctly after edit+refix: ' + doc.getElementById('score-number').textContent);

  // Back to menu, test QUIZ 2 (showCorrectAnswer = N -> silent auto-advance)
  doc.getElementById('btn-results-menu').dispatchEvent(new window.Event('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 100));
  const menuItems2 = doc.querySelectorAll('#menu-list .menu-item');
  menuItems2[1].dispatchEvent(new window.Event('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 400));
  assert(doc.getElementById('question-text').textContent === 'Which shape has three sides?', 'quiz 2 loaded correctly');

  // Submit a WRONG answer in N-mode: should auto-advance silently, no message
  const q2c1 = doc.querySelectorAll('#choices .choice');
  q2c1[0].dispatchEvent(new window.Event('click', { bubbles: true })); // wrong: Square
  doc.getElementById('btn-submit').dispatchEvent(new window.Event('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 100));
  assert(doc.getElementById('progress-label').textContent === 'Question 2 of 2', 'N-mode auto-advanced to Q2 after wrong answer, no retry required');
  assert(doc.getElementById('feedback').classList.contains('hidden'), 'N-mode shows no feedback message');

  const q2c2 = doc.querySelectorAll('#choices .choice');
  q2c2[2].dispatchEvent(new window.Event('click', { bubbles: true })); // correct: banana
  doc.getElementById('btn-submit').dispatchEvent(new window.Event('click', { bubbles: true }));
  await new Promise(r => setTimeout(r, 100));
  assert(!doc.getElementById('screen-results').classList.contains('hidden'), 'N-mode quiz reached results after final submit');
  assert(doc.getElementById('score-number').textContent === '1 / 2', 'N-mode score correctly counts silently: wrong Q1, correct Q2 = 1/2, got ' + doc.getElementById('score-number').textContent);

  console.log('\n' + (failures === 0 ? 'ALL TESTS PASSED' : failures + ' TEST(S) FAILED'));
  process.exit(failures === 0 ? 0 : 1);
}

run().catch(e => { console.error('HARNESS ERROR', e); process.exit(1); });
