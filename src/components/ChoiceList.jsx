import { LETTERS } from '../quizState.js';

export default function ChoiceList({ q, selectedLetter, onSelect }) {
  const isImageChoice = q.choiceType === 'image';

  return (
    <div className={'choices' + (isImageChoice ? ' image-choices' : '')}>
      {q.choices.map((choice, i) => {
        const letter = LETTERS[i];
        const selected = selectedLetter === letter;
        const className = 'choice' + (isImageChoice ? ' image-choice' : '') + (selected ? ' selected' : '');
        return (
          <div key={letter} className={className} onClick={() => onSelect(letter)}>
            {isImageChoice ? (
              <>
                <img src={choice} alt={'choice ' + letter} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                  <span className="choice-letter">{letter.toUpperCase()}</span>
                </div>
              </>
            ) : (
              <>
                <span className="choice-letter">{letter.toUpperCase()}</span>
                <span>{choice}</span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
