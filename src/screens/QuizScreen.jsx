import { useEffect, useState } from 'react';
import { showCorrectAnswerEnabled, soundEnabled } from '../quizState.js';
import { playHappySound, playUhOhSound } from '../audio.js';
import CentralImages from '../components/CentralImages.jsx';
import ChoiceList from '../components/ChoiceList.jsx';
import MatchQuestion from '../components/MatchQuestion.jsx';

export default function QuizScreen({ state, dispatch }) {
  const { quiz, quizFile, currentIndex, answers, matchState, matchOrder, settings } = state;
  const q = quiz.questions[currentIndex];
  const total = quiz.questions.length;
  const storedAnswer = answers[currentIndex];
  const isMatch = q.choiceType === 'match';
  const isLast = currentIndex === total - 1;
  const soundOn = soundEnabled(settings);

  const [selectedNow, setSelectedNow] = useState(storedAnswer);
  const [feedback, setFeedback] = useState(null); // { type: 'correct' | 'incorrect', text } | null

  // Mirrors the resolved state of this question whenever we navigate to it.
  useEffect(() => {
    setSelectedNow(answers[currentIndex]);
    setFeedback(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, quizFile]);

  const alreadyCorrect =
    !isMatch && storedAnswer !== null && showCorrectAnswerEnabled(quiz) && storedAnswer === q.correctAnswer;

  const matchedPairs = matchState[currentIndex] || [];
  const matchComplete = isMatch && matchedPairs.length === q.pairs.length;

  function handleSubmit() {
    if (!selectedNow) {
      setFeedback({ type: 'incorrect', text: 'Please select an answer first.' });
      return;
    }

    dispatch({ type: 'SUBMIT_ANSWER', letter: selectedNow });
    const isCorrect = selectedNow === q.correctAnswer;

    if (soundOn) {
      if (isCorrect) playHappySound(); else playUhOhSound();
    }

    if (!showCorrectAnswerEnabled(quiz)) {
      dispatch({ type: 'GO_NEXT' });
      return;
    }

    setFeedback(
      isCorrect
        ? { type: 'correct', text: 'Great job!' }
        : { type: 'incorrect', text: 'Incorrect. Please choose again.' }
    );
  }

  function handleMatchCorrect(pairIndex) {
    const willComplete = matchedPairs.length + 1 === q.pairs.length;
    dispatch({ type: 'MATCH_CORRECT', questionIndex: currentIndex, pairIndex });
    if (willComplete) {
      if (soundOn) playHappySound();
      if (!showCorrectAnswerEnabled(quiz)) {
        setTimeout(() => dispatch({ type: 'GO_NEXT' }), 500);
      }
    }
  }

  const showCorrectFeedback = alreadyCorrect || (feedback && feedback.type === 'correct');
  const showSubmitBtn = !isMatch && !showCorrectFeedback;
  const showNextBtn = isMatch ? matchComplete : showCorrectFeedback;
  const feedbackToShow = isMatch ? null : (alreadyCorrect ? { type: 'correct', text: 'Great job!' } : feedback);

  return (
    <div className="screen">
      <div className="quiz-toolbar">
        <button className="link-button" onClick={() => dispatch({ type: 'BACK_TO_MENU' })}>
          Exit to Main Menu
        </button>
        <button className="btn-secondary btn-audio" onClick={() => dispatch({ type: 'TOGGLE_SOUND' })}>
          {soundOn ? 'Audio Off' : 'Audio On'}
        </button>
      </div>
      <div className="progress">Question {currentIndex + 1} of {total}</div>
      <div className="question-text">{q.questionText}</div>
      <CentralImages q={q} />

      {feedbackToShow && (
        <div className={'feedback ' + feedbackToShow.type}>{feedbackToShow.text}</div>
      )}

      {!isMatch && (
        <ChoiceList q={q} selectedLetter={selectedNow} onSelect={setSelectedNow} />
      )}

      {isMatch && (
        <MatchQuestion
          q={q}
          matchedPairs={matchedPairs}
          rightOrder={matchOrder[currentIndex] || []}
          onCorrectMatch={handleMatchCorrect}
        />
      )}

      <div className="spacer" />
      <div className="nav-row">
        <button className="btn-secondary" onClick={() => dispatch({ type: 'GO_BACK' })}>Back</button>
        {showSubmitBtn && (
          <button className="btn-primary" onClick={handleSubmit}>Submit</button>
        )}
        {showNextBtn && (
          <button className="btn-primary" onClick={() => dispatch({ type: 'GO_NEXT' })}>
            {isLast ? 'See Results' : 'Next Question'}
          </button>
        )}
      </div>
    </div>
  );
}
