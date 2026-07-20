import MenuScreen from './MenuScreen.jsx';
import LearnScreen from './LearnScreen.jsx';

export default function HomeScreen({ state, dispatch, onSelectQuiz }) {
  const tab = state.homeTab;

  return (
    <div className="screen">
      <div className="tab-row">
        <button
          className={`tab-button${tab === 'quiz' ? ' active' : ''}`}
          onClick={() => dispatch({ type: 'SET_HOME_TAB', tab: 'quiz' })}
        >
          Quiz
        </button>
        <button
          className={`tab-button${tab === 'learn' ? ' active' : ''}`}
          onClick={() => dispatch({ type: 'SET_HOME_TAB', tab: 'learn' })}
        >
          Learn
        </button>
      </div>

      {tab === 'quiz' && (
        <MenuScreen
          manifest={state.manifest}
          manifestError={state.manifestError}
          onSelectQuiz={onSelectQuiz}
        />
      )}

      {tab === 'learn' && (
        <LearnScreen
          learnManifest={state.learnManifest}
          learnManifestError={state.learnManifestError}
          learnItems={state.learnItems}
          learnCategory={state.learnCategory}
          learnSearch={state.learnSearch}
          dispatch={dispatch}
        />
      )}
    </div>
  );
}
