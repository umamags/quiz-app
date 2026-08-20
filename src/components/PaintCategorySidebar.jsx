import { useState } from 'react';
import { getImageUrl, getCountryImageUrl } from '../config/assetUrls.js';

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export default function PaintCategorySidebar({
  learnManifest,
  learnItems,
  paintCategory,
  dispatch,
  onImageDragStart,
  onImageClick,
}) {
  const categories = [...(learnManifest?.categories ?? [])].sort((a, b) => a.title.localeCompare(b.title));

  const images = paintCategory
    ? (learnItems || [])
        .filter(item => item.category === paintCategory)
        .flatMap(item => (item.images || []).map(src => ({ src, name: item.name })))
    : [];

  const [hoveredImage, setHoveredImage] = useState(null);

  return (
    <div className="paint-sidebar">
      <div className="paint-category-list">
        {categories.map(c => (
          <button
            key={c.file}
            type="button"
            className={`paint-category-button${paintCategory === c.title ? ' active' : ''}`}
            onClick={() => dispatch({ type: 'PAINT_CATEGORY_SELECTED', category: c.title })}
          >
            {c.title}
          </button>
        ))}
      </div>

      <div className="paint-thumb-grid">
        {paintCategory === null && <div className="hint">Choose a category to see images.</div>}
        {images.map(({ src, name }) => {
          // Transform relative image path to correct URL (local or remote)
          const imageUrl = src.includes('countries_images') ? getCountryImageUrl(src) : getImageUrl(src);
          return (
            <div key={src} className="paint-thumb-wrapper">
              <button
                type="button"
                className="paint-thumb"
                draggable
                onDragStart={e => onImageDragStart(e, src)}
                onClick={() => onImageClick(src)}
                onMouseEnter={() => setHoveredImage(src)}
                onMouseLeave={() => setHoveredImage(null)}
                title={`Add ${capitalize(name)} to the canvas`}
              >
                <img src={imageUrl} alt={name} loading="lazy" />
              </button>
              {hoveredImage === src && (
                <div className="paint-thumb-tooltip">{capitalize(name)}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
