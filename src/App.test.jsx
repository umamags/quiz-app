import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App.jsx';
import { playHappySound, playUhOhSound } from './audio.js';

vi.mock('./audio.js', () => ({
  playHappySound: vi.fn(),
  playUhOhSound: vi.fn(),
}));

const settings = { sound: 'off' };

const manifest = {
  quizzes: [
    { title: 'Quiz A (retry mode)', file: 'quizzes/a.json' },
    { title: 'Quiz B (silent mode)', file: 'quizzes/b.json' },
  ],
};

const quizA = {
  quizTitle: 'Quiz A',
  showCorrectAnswer: 'Y',
  questions: [
    { questionText: 'What is 1+1?', choiceType: 'text', choices: ['1', '2', '3', '4'], correctAnswer: 'b' },
    { questionText: 'What is 2+2?', choiceType: 'text', choices: ['3', '4', '5', '6'], correctAnswer: 'b' },
  ],
};

const quizB = {
  quizTitle: 'Quiz B',
  showCorrectAnswer: 'N',
  questions: [
    { questionText: 'Silent Q1', choiceType: 'text', choices: ['a', 'b', 'c', 'd'], correctAnswer: 'a' },
    { questionText: 'Silent Q2', choiceType: 'text', choices: ['a', 'b', 'c', 'd'], correctAnswer: 'b' },
  ],
};

const learnManifest = {
  categories: [{ title: 'Animals', file: 'learn/animals.json' }],
};

const learnAnimals = [
  { name: 'dog', description: 'A loyal pet that barks.', images: [], videos: [] },
];

function mockFetch() {
  return vi.fn((url) => {
    const body =
      url.includes('settings.json') ? settings :
      url.includes('learn/manifest.json') ? learnManifest :
      url.includes('learn/animals.json') ? learnAnimals :
      url.includes('quizzes/manifest.json') ? manifest :
      url.includes('a.json') ? quizA :
      url.includes('b.json') ? quizB :
      null;
    if (!body) return Promise.resolve({ ok: false });
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
  });
}

beforeEach(() => {
  global.fetch = mockFetch();
  playHappySound.mockClear();
  playUhOhSound.mockClear();
});

describe('menu', () => {
  it('lists quizzes from the manifest', async () => {
    render(<App />);
    expect(await screen.findByText('Quiz A (retry mode)')).toBeInTheDocument();
    expect(screen.getByText('Quiz B (silent mode)')).toBeInTheDocument();
  });
});

describe('learn tab', () => {
  it('switches to the Learn tab and shows items loaded from every category manifest entry', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Quiz A (retry mode)');

    await user.click(screen.getByRole('button', { name: 'Learn' }));
    expect(await screen.findByRole('heading', { name: 'Dog', level: 3 })).toBeInTheDocument();
    expect(screen.getByText('A loyal pet that barks.')).toBeInTheDocument();
  });
});

describe('quiz with showCorrectAnswer = Y', () => {
  it('requires retrying a wrong answer before advancing, then scores correctly', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByText('Quiz A (retry mode)'));

    expect(await screen.findByText('What is 1+1?')).toBeInTheDocument();

    // wrong answer ("1") -> forced retry
    await user.click(screen.getByText('1'));
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText('Incorrect. Please choose again.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next Question' })).not.toBeInTheDocument();

    // correct answer ("2") -> unlocks Next
    await user.click(screen.getByText('2'));
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText('Great job!')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next Question' }));

    expect(await screen.findByText('What is 2+2?')).toBeInTheDocument();
    await user.click(screen.getByText('4'));
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await user.click(await screen.findByRole('button', { name: 'See Results' }));

    expect(await screen.findByText('2 / 2')).toBeInTheDocument();
  });

  it('reviewing an already-correct answer via Back still shows it resolved, with the score unchanged', async () => {
    // Once a question is answered correctly its Submit button is gone (not just
    // hidden) -- by design, matching the original app -- so Back navigation
    // lets you review a resolved question, not silently reopen it for editing.
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByText('Quiz A (retry mode)'));
    await screen.findByText('What is 1+1?');

    await user.click(screen.getByText('2')); // correct
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await user.click(await screen.findByRole('button', { name: 'Next Question' }));

    await screen.findByText('What is 2+2?');
    await user.click(screen.getByText('4')); // correct
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await user.click(await screen.findByRole('button', { name: 'See Results' }));
    expect(await screen.findByText('2 / 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    await screen.findByText('What is 2+2?');
    expect(screen.getByText('Great job!')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'See Results' }));
    expect(await screen.findByText('2 / 2')).toBeInTheDocument();
  });
});

describe('quiz with showCorrectAnswer = N', () => {
  it('auto-advances silently with no feedback message, even on a wrong answer', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByText('Quiz B (silent mode)'));
    await screen.findByText('Silent Q1');

    await user.click(screen.getByText('b')); // wrong (correct is 'a')
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByText('Silent Q2')).toBeInTheDocument();
    expect(screen.queryByText('Incorrect. Please choose again.')).not.toBeInTheDocument();
    expect(screen.queryByText('Great job!')).not.toBeInTheDocument();

    await user.click(screen.getByText('b')); // correct
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    // Q1 answered 'b' (wrong, correct is 'a'); Q2 answered 'b' (correct) => 1/2
    await waitFor(() => expect(screen.getByText('1 / 2')).toBeInTheDocument());
  });
});

describe('quiz toolbar', () => {
  it('"Exit to Main Menu" returns to the menu from any question, mid-quiz', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByText('Quiz A (retry mode)'));
    await screen.findByText('What is 1+1?');

    // leave the question unanswered entirely, jump straight to the menu
    await user.click(screen.getByRole('button', { name: 'Exit to Main Menu' }));

    expect(await screen.findByText('Choose a quiz to begin')).toBeInTheDocument();
    expect(screen.getByText('Quiz A (retry mode)')).toBeInTheDocument();
  });

  it('the audio toggle flips its label and gates whether sounds play on submit', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByText('Quiz A (retry mode)'));
    await screen.findByText('What is 1+1?');

    // fixture settings.json has sound "off" => button offers to turn it on
    const toggle = screen.getByRole('button', { name: 'Audio On' });

    await user.click(screen.getByText('1')); // wrong
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await screen.findByText('Incorrect. Please choose again.');
    expect(playUhOhSound).not.toHaveBeenCalled();

    await user.click(toggle);
    expect(await screen.findByRole('button', { name: 'Audio Off' })).toBeInTheDocument();

    await user.click(screen.getByText('2')); // correct
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await screen.findByText('Great job!');
    expect(playHappySound).toHaveBeenCalledTimes(1);

    // toggle back off; further submits should stay silent again
    await user.click(screen.getByRole('button', { name: 'Audio Off' }));
    expect(await screen.findByRole('button', { name: 'Audio On' })).toBeInTheDocument();
  });
});
