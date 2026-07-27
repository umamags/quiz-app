import { lazy, Suspense, useState } from 'react';
import MenuScreen from './MenuScreen.jsx';
import LearnScreen from './LearnScreen.jsx';

// fabric.js (Paint's canvas engine) is a large dependency -- load it only
// once the user actually opens the Paint tab, instead of in the main bundle.
const PaintScreen = lazy(() => import('./PaintScreen.jsx'));

export default function HomeScreen({ state, dispatch, onSelectQuiz }) {
  const tab = state.homeTab;
  // Once the Paint tab has been opened, keep it mounted (just hidden) so the
  // canvas survives switching to Quiz/Learn and back.
  const [paintActivated, setPaintActivated] = useState(tab === 'paint');

  function selectTab(nextTab) {
    if (nextTab === 'paint') setPaintActivated(true);
    dispatch({ type: 'SET_HOME_TAB', tab: nextTab });
  }

  return (
    <div className="screen">
      <div className="tab-row">
        <button
          className={`tab-button${tab === 'quiz' ? ' active' : ''}`}
          onClick={() => selectTab('quiz')}
        >
          Quiz
        </button>
        <button
          className={`tab-button${tab === 'learn' ? ' active' : ''}`}
          onClick={() => selectTab('learn')}
        >
          Learn
        </button>
        <button
          className={`tab-button${tab === 'paint' ? ' active' : ''}`}
          onClick={() => selectTab('paint')}
        >
          Paint
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

      {paintActivated && (
        <div className={tab === 'paint' ? '' : 'hidden'}>
          <Suspense fallback={<div className="hint">Loading...</div>}>
            <PaintScreen
              learnManifest={state.learnManifest}
              learnItems={state.learnItems}
              paintCategory={state.paintCategory}
              dispatch={dispatch}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}
