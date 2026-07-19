export default function MenuScreen({ manifest, manifestError, onSelectQuiz }) {
  return (
    <div className="screen">
      <h1>Quiz App</h1>
      <h2>Choose a quiz to begin</h2>
      <div className="menu-list">
        {manifest?.quizzes.map(q => (
          <button key={q.file} className="menu-item" onClick={() => onSelectQuiz(q.file)}>
            {q.title}
          </button>
        ))}
      </div>
      {manifestError && <div className="hint">{manifestError}</div>}
    </div>
  );
}
