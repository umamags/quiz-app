const TOOLS = [
  { id: 'select', label: 'Select' },
  { id: 'line', label: 'Line' },
  { id: 'rectangle', label: 'Rectangle' },
  { id: 'square', label: 'Square' },
  { id: 'circle', label: 'Circle' },
];

export default function PaintToolbar({
  activeTool,
  onToolChange,
  strokeColor,
  onStrokeColorChange,
  fillColor,
  onFillColorChange,
  fillEnabled,
  onFillEnabledChange,
  hasSelection,
  onDeleteSelected,
  onClear,
  onDownload,
}) {
  return (
    <div className="paint-toolbar">
      <div className="paint-tool-group">
        {TOOLS.map(t => (
          <button
            key={t.id}
            type="button"
            className={`paint-tool-button${activeTool === t.id ? ' active' : ''}`}
            onClick={() => onToolChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="paint-color-row">
        <label className="paint-color-label">
          Stroke
          <input
            type="color"
            value={strokeColor}
            onChange={e => onStrokeColorChange(e.target.value)}
          />
        </label>
        <label className="paint-color-label">
          <input
            type="checkbox"
            checked={fillEnabled}
            onChange={e => onFillEnabledChange(e.target.checked)}
          />
          Fill
        </label>
        <input
          type="color"
          value={fillColor}
          onChange={e => onFillColorChange(e.target.value)}
          disabled={!fillEnabled}
        />
      </div>

      <div className="paint-action-group">
        <button type="button" className="btn-secondary" onClick={onDeleteSelected} disabled={!hasSelection}>
          Delete
        </button>
        <button type="button" className="btn-secondary" onClick={onClear}>
          Clear
        </button>
        <button type="button" className="btn-primary" onClick={onDownload}>
          Download
        </button>
      </div>
    </div>
  );
}
