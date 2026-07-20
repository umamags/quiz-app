import { describe, expect, it } from 'vitest';
import { computeScore, filterLearnItems, initialState, quizReducer, showCorrectAnswerEnabled } from './quizState.js';

const textQuiz = {
  quizTitle: 'Text Quiz',
  showCorrectAnswer: 'Y',
  questions: [
    { questionText: 'Q1', choiceType: 'text', choices: ['a', 'b', 'c', 'd'], correctAnswer: 'b' },
    { questionText: 'Q2', choiceType: 'text', choices: ['a', 'b', 'c', 'd'], correctAnswer: 'c' },
  ],
};

const mixedQuiz = {
  quizTitle: 'Mixed Quiz',
  showCorrectAnswer: 'Y',
  questions: [
    { questionText: 'Q1', choiceType: 'text', choices: ['a', 'b', 'c', 'd'], correctAnswer: 'a' },
    {
      questionText: 'Match it',
      choiceType: 'match',
      leftType: 'text',
      rightType: 'text',
      pairs: [
        { left: 'A', right: 'A-img' },
        { left: 'B', right: 'B-img' },
      ],
    },
  ],
};

describe('showCorrectAnswerEnabled', () => {
  it('is true for "Y" (case-insensitive)', () => {
    expect(showCorrectAnswerEnabled({ showCorrectAnswer: 'Y' })).toBe(true);
    expect(showCorrectAnswerEnabled({ showCorrectAnswer: 'y' })).toBe(true);
  });
  it('is false for "N"', () => {
    expect(showCorrectAnswerEnabled({ showCorrectAnswer: 'N' })).toBe(false);
  });
});

describe('quizReducer', () => {
  it('START_QUIZ resets answers/matchState and precomputes a shuffled matchOrder per match question', () => {
    const state = quizReducer(initialState, { type: 'START_QUIZ', quiz: mixedQuiz, file: 'quizzes/mixed.json' });
    expect(state.screen).toBe('quiz');
    expect(state.currentIndex).toBe(0);
    expect(state.answers).toEqual([null, null]);
    expect(state.matchState).toEqual({});
    expect(state.matchOrder[1].slice().sort()).toEqual([0, 1]);
    expect(state.matchOrder[0]).toBeUndefined(); // question 0 isn't a match type
  });

  it('SUBMIT_ANSWER records the letter for the current question only', () => {
    let state = quizReducer(initialState, { type: 'START_QUIZ', quiz: textQuiz, file: 'f' });
    state = quizReducer(state, { type: 'SUBMIT_ANSWER', letter: 'b' });
    expect(state.answers).toEqual(['b', null]);
  });

  it('GO_NEXT advances currentIndex, and moves to results on the last question', () => {
    let state = quizReducer(initialState, { type: 'START_QUIZ', quiz: textQuiz, file: 'f' });
    state = quizReducer(state, { type: 'GO_NEXT' });
    expect(state.currentIndex).toBe(1);
    expect(state.screen).toBe('quiz');
    state = quizReducer(state, { type: 'GO_NEXT' });
    expect(state.screen).toBe('results');
  });

  it('GO_BACK from the first question returns to the menu', () => {
    let state = quizReducer(initialState, { type: 'START_QUIZ', quiz: textQuiz, file: 'f' });
    state = quizReducer(state, { type: 'GO_BACK' });
    expect(state.screen).toBe('menu');
  });

  it('MATCH_CORRECT accumulates pair indices and marks the question "matched" once complete', () => {
    let state = quizReducer(initialState, { type: 'START_QUIZ', quiz: mixedQuiz, file: 'f' });
    state = quizReducer(state, { type: 'MATCH_CORRECT', questionIndex: 1, pairIndex: 0 });
    expect(state.matchState[1]).toEqual([0]);
    expect(state.answers[1]).toBeNull();

    state = quizReducer(state, { type: 'MATCH_CORRECT', questionIndex: 1, pairIndex: 1 });
    expect(state.matchState[1]).toEqual([0, 1]);
    expect(state.answers[1]).toBe('matched');
  });

  it('MATCH_CORRECT is idempotent for an already-matched pair', () => {
    let state = quizReducer(initialState, { type: 'START_QUIZ', quiz: mixedQuiz, file: 'f' });
    state = quizReducer(state, { type: 'MATCH_CORRECT', questionIndex: 1, pairIndex: 0 });
    const again = quizReducer(state, { type: 'MATCH_CORRECT', questionIndex: 1, pairIndex: 0 });
    expect(again.matchState[1]).toEqual([0]);
  });
});

describe('Learn tab reducer cases', () => {
  it('SET_HOME_TAB switches between quiz and learn', () => {
    const state = quizReducer(initialState, { type: 'SET_HOME_TAB', tab: 'learn' });
    expect(state.homeTab).toBe('learn');
  });

  it('LEARN_ITEMS_LOADED stores the flattened items list', () => {
    const items = [{ category: 'Animals', name: 'dog', description: 'd' }];
    const state = quizReducer(initialState, { type: 'LEARN_ITEMS_LOADED', items });
    expect(state.learnItems).toBe(items);
  });

  it('LEARN_CATEGORY_SELECTED and LEARN_SEARCH_CHANGED update their respective fields independently', () => {
    let state = quizReducer(initialState, { type: 'LEARN_CATEGORY_SELECTED', category: 'Animals' });
    expect(state.learnCategory).toBe('Animals');
    state = quizReducer(state, { type: 'LEARN_SEARCH_CHANGED', query: 'dog' });
    expect(state.learnSearch).toBe('dog');
    expect(state.learnCategory).toBe('Animals');
  });
});

describe('filterLearnItems', () => {
  const items = [
    { category: 'Animals', name: 'dog', description: 'A loyal pet that barks.' },
    { category: 'Animals', name: 'cat', description: 'An independent pet that meows.' },
    { category: 'Dinosaurs', name: 'triceratops', description: 'A plant-eating dinosaur with three horns.' },
  ];

  it('returns everything when there is no category filter or search query', () => {
    expect(filterLearnItems(items, null, '')).toHaveLength(3);
  });

  it('filters by category', () => {
    const result = filterLearnItems(items, 'Dinosaurs', '');
    expect(result.map(i => i.name)).toEqual(['triceratops']);
  });

  it('filters by a case-insensitive match against name or description', () => {
    expect(filterLearnItems(items, null, 'DOG').map(i => i.name)).toEqual(['dog']);
    expect(filterLearnItems(items, null, 'pet').map(i => i.name).sort()).toEqual(['cat', 'dog']);
  });

  it('combines category and search filters', () => {
    expect(filterLearnItems(items, 'Animals', 'horns')).toEqual([]);
  });
});

describe('computeScore', () => {
  it('scores text questions by correctAnswer and match questions by full completion', () => {
    const answers = ['a', null];
    const matchState = { 1: [0, 1] };
    expect(computeScore(mixedQuiz, answers, matchState)).toEqual({ score: 2, total: 2 });
  });

  it('does not award a match question that is only partially matched', () => {
    const answers = ['a', null];
    const matchState = { 1: [0] };
    expect(computeScore(mixedQuiz, answers, matchState)).toEqual({ score: 1, total: 2 });
  });
});
