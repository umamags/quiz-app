import { computeScore } from '../quizState.js';

export default function ResultsScreen({ state, dispatch }) {
  const { quiz, answers, matchState } = state;
  const { score, total } = computeScore(quiz, answers, matchState);

  return (
    <div className="screen">
      <h1>{quiz.quizTitle} - Complete</h1>
      <div className="score-display">
        <div className="score-number">{score} / {total}</div>
        <div className="score-label">questions answered correctly</div>
      </div>
      <div className="spacer" />
      <div className="nav-row">
        <button className="btn-secondary" onClick={() => dispatch({ type: 'RESULTS_BACK' })}>Back</button>
        <button className="btn-primary" onClick={() => dispatch({ type: 'BACK_TO_MENU' })}>Back to Menu</button>
      </div>
    </div>
  );
}
