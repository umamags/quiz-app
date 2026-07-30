import { useEffect, useState } from 'react';
import { filterLearnItems } from '../quizState.js';
import Lightbox from '../components/Lightbox.jsx';

const SEARCH_DEBOUNCE_MS = 200;

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function anchorId(category, name) {
  return `learn-item-${category}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function groupByCategory(items) {
  const groups = [];
  const byCategory = new Map();
  for (const item of items) {
    let group = byCategory.get(item.category);
    if (!group) {
      group = { category: item.category, items: [] };
      byCategory.set(item.category, group);
      groups.push(group);
    }
    group.items.push(item);
  }
  for (const group of groups) {
    group.items.sort((a, b) => a.name.localeCompare(b.name));
  }
  groups.sort((a, b) => a.category.localeCompare(b.category));
  return groups;
}

function LearnVideo({ video }) {
  if (video.type === 'file') {
    return <video className="learn-video-player" controls preload="none" src={video.url} />;
  }
  if (video.source === 'youtube') {
    return (
      <iframe
        className="learn-video-player"
        src={video.url}
        title="YouTube video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }
  return (
    <a className="learn-video-link" href={video.pageUrl} target="_blank" rel="noopener noreferrer">
      Watch on {capitalize(video.source)} ↗
    </a>
  );
}

function LearnCard({ item, onImageClick }) {
  function playAudio() {
    new Audio(item.audio_desc).play();
  }

  return (
    <div className="learn-card" id={anchorId(item.category, item.name)}>
      <div className="learn-card-header">
        <div className="learn-card-title-row">
          <h3 className="learn-card-title">{capitalize(item.name)}</h3>
          <a href="#learn-top" className="back-to-top-link">Back to top</a>
        </div>
        <span className="category-tag">{item.category}</span>
      </div>
      <div className="learn-card-description-row">
        <p className="learn-card-description">{item.description}</p>
        {item.audio_desc && (
          <button
            type="button"
            className="audio-play-button"
            aria-label={`Play audio for ${item.name}`}
            onClick={playAudio}
          >
            🔊
          </button>
        )}
      </div>
      {item.images?.length > 0 && (
        <div className="learn-card-images">
          {item.images.map(src => (
            <button
              key={src}
              type="button"
              className="learn-image-button"
              onClick={() => onImageClick(src, item.name)}
            >
              <img className="learn-card-image" src={src} alt={item.name} loading="lazy" />
            </button>
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

function LearnGroup({ group, onImageClick }) {
  return (
    <div className="learn-group">
      <h2 className="learn-group-title">{group.category}</h2>
      <div className="learn-jump-row">
        {group.items.map(item => (
          <a key={item.name} className="learn-jump-link" href={`#${anchorId(item.category, item.name)}`}>
            {capitalize(item.name)}
          </a>
        ))}
      </div>
      {group.items.map(item => (
        <LearnCard key={item.name} item={item} onImageClick={onImageClick} />
      ))}
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
  const [lightbox, setLightbox] = useState(null); // { src, alt } | null
  const [searchInput, setSearchInput] = useState(learnSearch);

  // Debounce: filtering/re-rendering the full result list on every single
  // keystroke is what made typing feel slow with hundreds of items on
  // screen. Keep the input itself instantly responsive (local state) and
  // only dispatch the expensive part once typing pauses.
  useEffect(() => {
    if (searchInput === learnSearch) return;
    const handle = setTimeout(() => {
      dispatch({ type: 'LEARN_SEARCH_CHANGED', query: searchInput });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  function clearSearch() {
    setSearchInput('');
    dispatch({ type: 'LEARN_SEARCH_CHANGED', query: '' });
  }

  if (learnManifestError) {
    return <div className="hint">{learnManifestError}</div>;
  }

  if (!learnItems) {
    return <div className="hint">Loading...</div>;
  }

  const showBrowsePrompt = learnCategory === null && learnSearch.trim() === '';
  const results = showBrowsePrompt ? [] : filterLearnItems(learnItems, learnCategory, learnSearch);
  const groups = groupByCategory(results);

  return (
    <div className="learn-screen" id="learn-top">
      <div className="search-row">
        <input
          className="search-input"
          type="text"
          placeholder="Search by name or description..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
        />
        <button
          type="button"
          className="btn-secondary search-clear"
          onClick={clearSearch}
          disabled={!searchInput}
        >
          Clear
        </button>
      </div>

      <div className="hint">Tip: clicking on an image enlarges it.</div>

      <div className="category-chip-row">
        <button
          className={`category-chip${learnCategory === null ? ' active' : ''}`}
          onClick={() => dispatch({ type: 'LEARN_CATEGORY_SELECTED', category: null })}
        >
          All
        </button>
        {[...(learnManifest?.categories ?? [])].sort((a, b) => a.title.localeCompare(b.title)).map(c => (
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
        {showBrowsePrompt && (
          <div className="hint">Choose a category above, or start typing to search.</div>
        )}
        {!showBrowsePrompt && groups.map(group => (
          <LearnGroup
            key={group.category}
            group={group}
            onImageClick={(src, name) => setLightbox({ src, alt: name })}
          />
        ))}
        {!showBrowsePrompt && results.length === 0 && <div className="hint">No matches found.</div>}
      </div>

      <Lightbox image={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}
