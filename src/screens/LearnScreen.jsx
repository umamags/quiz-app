import { useEffect, useState } from 'react';
import { filterLearnItems } from '../quizState.js';

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
  return groups;
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

function LearnCard({ item, onImageClick }) {
  return (
    <div className="learn-card" id={anchorId(item.category, item.name)}>
      <div className="learn-card-header">
        <h3 className="learn-card-title">{capitalize(item.name)}</h3>
        <span className="category-tag">{item.category}</span>
      </div>
      <p className="learn-card-description">{item.description}</p>
      {item.images?.length > 0 && (
        <div className="learn-card-images">
          {item.images.map(src => (
            <button
              key={src}
              type="button"
              className="learn-image-button"
              onClick={() => onImageClick(src, item.name)}
            >
              <img className="learn-card-image" src={src} alt={item.name} />
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

  useEffect(() => {
    if (!lightbox) return;
    function onKeyDown(e) {
      if (e.key === 'Escape') setLightbox(null);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightbox]);

  if (learnManifestError) {
    return <div className="hint">{learnManifestError}</div>;
  }

  if (!learnItems) {
    return <div className="hint">Loading...</div>;
  }

  const results = filterLearnItems(learnItems, learnCategory, learnSearch);
  const groups = groupByCategory(results);

  return (
    <div className="learn-screen">
      <div className="search-row">
        <input
          className="search-input"
          type="text"
          placeholder="Search by name or description..."
          value={learnSearch}
          onChange={e => dispatch({ type: 'LEARN_SEARCH_CHANGED', query: e.target.value })}
        />
        <button
          type="button"
          className="btn-secondary search-clear"
          onClick={() => dispatch({ type: 'LEARN_SEARCH_CHANGED', query: '' })}
          disabled={!learnSearch}
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
        {groups.map(group => (
          <LearnGroup
            key={group.category}
            group={group}
            onImageClick={(src, name) => setLightbox({ src, alt: name })}
          />
        ))}
        {results.length === 0 && <div className="hint">No matches found.</div>}
      </div>

      {lightbox && (
        <div className="lightbox-overlay" onClick={() => setLightbox(null)}>
          <button
            type="button"
            className="lightbox-close"
            aria-label="Close"
            onClick={() => setLightbox(null)}
          >
            &times;
          </button>
          <img
            className="lightbox-image"
            src={lightbox.src}
            alt={lightbox.alt}
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
