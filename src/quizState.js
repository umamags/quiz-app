export const LETTERS = ['a', 'b', 'c', 'd'];

function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const initialState = {
  screen: 'menu', // 'menu' | 'quiz' | 'results'
  homeTab: 'quiz', // 'quiz' | 'learn' | 'paint'
  manifest: null,
  manifestError: null,
  settings: { sound: 'on' },
  quiz: null,
  quizFile: null,
  currentIndex: 0,
  answers: [],       // stored final answer letter per question index, or null, or 'matched'
  matchState: {},     // question index -> array of correctly-matched pair indices
  matchOrder: {},      // question index -> shuffled display order of pair indices (right column)
  learnManifest: null,
  learnManifestError: null,
  learnItems: null,     // flattened array of { category, ...item } across every learn category, once loaded
  learnCategory: null,   // selected category title filter, or null for "all"
  learnSearch: '',        // free-text filter, matched against name + description
  paintCategory: null,   // selected category title in the Paint tab's image sidebar, or null
};

export function showCorrectAnswerEnabled(quiz) {
  return String(quiz.showCorrectAnswer).toUpperCase() === 'Y';
}

export function soundEnabled(settings) {
  return String(settings.sound).toUpperCase() === 'ON';
}

export function filterLearnItems(items, category, query) {
  const q = query.trim().toLowerCase();
  return (items || []).filter(item => {
    if (category && item.category !== category) return false;
    if (!q) return true;
    return item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
  });
}

export function computeScore(quiz, answers, matchState) {
  let score = 0;
  quiz.questions.forEach((q, i) => {
    if (q.choiceType === 'match') {
      const matched = matchState[i];
      if (matched && matched.length === q.pairs.length) score += 1;
    } else if (answers[i] === q.correctAnswer) {
      score += 1;
    }
  });
  return { score, total: quiz.questions.length };
}

export function quizReducer(state, action) {
  switch (action.type) {
    case 'SETTINGS_LOADED':
      return { ...state, settings: action.settings };

    case 'TOGGLE_SOUND':
      return { ...state, settings: { ...state.settings, sound: soundEnabled(state.settings) ? 'off' : 'on' } };

    case 'MANIFEST_LOADED':
      return { ...state, manifest: action.manifest, manifestError: null };

    case 'MANIFEST_ERROR':
      return { ...state, manifestError: action.message };

    case 'SET_HOME_TAB':
      return { ...state, homeTab: action.tab };

    case 'LEARN_MANIFEST_LOADED':
      return { ...state, learnManifest: action.manifest, learnManifestError: null };

    case 'LEARN_MANIFEST_ERROR':
      return { ...state, learnManifestError: action.message };

    case 'LEARN_ITEMS_LOADED':
      return { ...state, learnItems: action.items };

    case 'LEARN_CATEGORY_SELECTED':
      return { ...state, learnCategory: action.category };

    case 'LEARN_SEARCH_CHANGED':
      return { ...state, learnSearch: action.query };

    case 'PAINT_CATEGORY_SELECTED':
      return { ...state, paintCategory: action.category };

    case 'START_QUIZ': {
      const { quiz, file } = action;
      const matchOrder = {};
      quiz.questions.forEach((q, i) => {
        if (q.choiceType === 'match') {
          matchOrder[i] = shuffled(q.pairs.map((_, pi) => pi));
        }
      });
      return {
        ...state,
        quiz,
        quizFile: file,
        currentIndex: 0,
        answers: new Array(quiz.questions.length).fill(null),
        matchState: {},
        matchOrder,
        screen: 'quiz',
      };
    }

    case 'SUBMIT_ANSWER': {
      const answers = state.answers.slice();
      answers[state.currentIndex] = action.letter;
      return { ...state, answers };
    }

    case 'MATCH_CORRECT': {
      const { questionIndex, pairIndex } = action;
      const existing = state.matchState[questionIndex] || [];
      if (existing.includes(pairIndex)) return state;
      let updated = [...existing, pairIndex];
      const q = state.quiz.questions[questionIndex];
      // Once only one pair is left unmatched, there's only one place it can go — fill it in automatically.
      if (updated.length === q.pairs.length - 1) {
        const remaining = q.pairs.map((_, i) => i).filter(i => !updated.includes(i));
        updated = [...updated, ...remaining];
      }
      const complete = updated.length === q.pairs.length;
      const answers = state.answers.slice();
      if (complete) answers[questionIndex] = 'matched';
      return {
        ...state,
        matchState: { ...state.matchState, [questionIndex]: updated },
        answers,
      };
    }

    case 'GO_NEXT': {
      const total = state.quiz.questions.length;
      if (state.currentIndex < total - 1) {
        return { ...state, currentIndex: state.currentIndex + 1 };
      }
      return { ...state, screen: 'results' };
    }

    case 'SKIP_QUESTION': {
      const answers = state.answers.slice();
      answers[state.currentIndex] = 'skipped';
      const total = state.quiz.questions.length;
      if (state.currentIndex < total - 1) {
        return { ...state, answers, currentIndex: state.currentIndex + 1 };
      }
      return { ...state, answers, screen: 'results' };
    }

    case 'GO_BACK': {
      if (state.currentIndex > 0) {
        return { ...state, currentIndex: state.currentIndex - 1 };
      }
      return { ...state, screen: 'menu' };
    }

    case 'RESULTS_BACK':
      return { ...state, currentIndex: state.quiz.questions.length - 1, screen: 'quiz' };

    case 'BACK_TO_MENU':
      return { ...state, screen: 'menu' };

    default:
      return state;
  }
}
