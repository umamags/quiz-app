import { useEffect, useReducer } from 'react';
import { initialState, quizReducer } from './quizState.js';
import MenuScreen from './screens/MenuScreen.jsx';
import QuizScreen from './screens/QuizScreen.jsx';
import ResultsScreen from './screens/ResultsScreen.jsx';

export default function App() {
  const [state, dispatch] = useReducer(quizReducer, initialState);

  useEffect(() => {
    fetch('config/settings.json')
      .then(r => (r.ok ? r.json() : { sound: 'on' }))
      .then(settings => dispatch({ type: 'SETTINGS_LOADED', settings }))
      .catch(() => dispatch({ type: 'SETTINGS_LOADED', settings: { sound: 'on' } }));

    fetch('quizzes/manifest.json')
      .then(r => {
        if (!r.ok) throw new Error('manifest not found');
        return r.json();
      })
      .then(manifest => dispatch({ type: 'MANIFEST_LOADED', manifest }))
      .catch(() => dispatch({
        type: 'MANIFEST_ERROR',
        message: 'Could not load quizzes/manifest.json. If you opened this file directly by double-clicking it, browsers block loading local JSON files for security reasons. Please run a simple local server instead (see README.md) and open the app via http://localhost.',
      }));
  }, []);

  function startQuiz(file) {
    fetch(file)
      .then(r => r.json())
      .then(quiz => dispatch({ type: 'START_QUIZ', quiz, file }))
      .catch(() => alert('Could not load quiz file: ' + file));
  }

  return (
    <div className="app">
      {state.screen === 'menu' && (
        <MenuScreen
          manifest={state.manifest}
          manifestError={state.manifestError}
          onSelectQuiz={startQuiz}
        />
      )}
      {state.screen === 'quiz' && state.quiz && (
        <QuizScreen state={state} dispatch={dispatch} />
      )}
      {state.screen === 'results' && state.quiz && (
        <ResultsScreen state={state} dispatch={dispatch} />
      )}
    </div>
  );
}
