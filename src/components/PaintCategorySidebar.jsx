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
        {images.map(({ src, name }) => (
          <button
            key={src}
            type="button"
            className="paint-thumb"
            draggable
            onDragStart={e => onImageDragStart(e, src)}
            onClick={() => onImageClick(src)}
            title={`Add ${capitalize(name)} to the canvas`}
          >
            <img src={src} alt={name} loading="lazy" />
          </button>
        ))}
      </div>
    </div>
  );
}
