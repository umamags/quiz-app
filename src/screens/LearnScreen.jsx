import { filterLearnItems } from '../quizState.js';

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function LearnVideo({ video }) {
  if (video.type === 'file') {
    return <video className="learn-video-player" controls preload="none" src={video.url} />;
  }
  return (
    <a className="learn-video-link" href={video.pageUrl} target="_blank" rel="noopener noreferrer">
      Watch on {capitalize(video.source)} ↗
    </a>
  );
}

function LearnCard({ item }) {
  return (
    <div className="learn-card">
      <div className="learn-card-header">
        <h3 className="learn-card-title">{capitalize(item.name)}</h3>
        <span className="category-tag">{item.category}</span>
      </div>
      <p className="learn-card-description">{item.description}</p>
      {item.images?.length > 0 && (
        <div className="learn-card-images">
          {item.images.map(src => (
            <img key={src} className="learn-card-image" src={src} alt={item.name} />
          ))}
        </div>
      )}
      {item.videos?.length > 0 && (
        <div className="learn-video-list">
          {item.videos.map(v => (
            <LearnVideo key={v.source} video={v} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function LearnScreen({
  learnManifest,
  learnManifestError,
  learnItems,
  learnCategory,
  learnSearch,
  dispatch,
}) {
  if (learnManifestError) {
    return <div className="hint">{learnManifestError}</div>;
  }

  if (!learnItems) {
    return <div className="hint">Loading...</div>;
  }

  const results = filterLearnItems(learnItems, learnCategory, learnSearch);

  return (
    <div className="learn-screen">
      <input
        className="search-input"
        type="text"
        placeholder="Search by name or description..."
        value={learnSearch}
        onChange={e => dispatch({ type: 'LEARN_SEARCH_CHANGED', query: e.target.value })}
      />

      <div className="category-chip-row">
        <button
          className={`category-chip${learnCategory === null ? ' active' : ''}`}
          onClick={() => dispatch({ type: 'LEARN_CATEGORY_SELECTED', category: null })}
        >
          All
        </button>
        {learnManifest?.categories.map(c => (
          <button
            key={c.file}
            className={`category-chip${learnCategory === c.title ? ' active' : ''}`}
            onClick={() => dispatch({ type: 'LEARN_CATEGORY_SELECTED', category: c.title })}
          >
            {c.title}
          </button>
        ))}
      </div>

      <div className="learn-card-list">
        {results.map(item => (
          <LearnCard key={item.category + item.name} item={item} />
        ))}
        {results.length === 0 && <div className="hint">No matches found.</div>}
      </div>
    </div>
  );
}
