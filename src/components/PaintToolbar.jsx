const ICON_PROPS = { viewBox: '0 0 24 24', width: 18, height: 18, 'aria-hidden': true };
const STROKE_ICON_PROPS = { ...ICON_PROPS, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };

const ICONS = {
  select: (
    <svg {...ICON_PROPS}>
      <path d="M3 11 21 3l-8 18-2-8z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  ),
  freehand: (
    <svg {...STROKE_ICON_PROPS}>
      <path d="M14.5 4.5l5 5L8 21H3v-5z" />
    </svg>
  ),
  line: (
    <svg {...STROKE_ICON_PROPS}>
      <line x1="5" y1="19" x2="19" y2="5" />
      <circle cx="5" cy="19" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="19" cy="5" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  ),
  rectangle: (
    <svg {...STROKE_ICON_PROPS}>
      <rect x="3" y="7" width="18" height="10" rx="1" />
    </svg>
  ),
  text: (
    <svg {...STROKE_ICON_PROPS}>
      <path d="M4 6h16M12 6v14" />
    </svg>
  ),
  square: (
    <svg {...STROKE_ICON_PROPS}>
      <rect x="4" y="4" width="16" height="16" rx="1" />
    </svg>
  ),
  circle: (
    <svg {...STROKE_ICON_PROPS}>
      <circle cx="12" cy="12" r="8" />
    </svg>
  ),
  eraser: (
    <svg {...STROKE_ICON_PROPS}>
      <path d="M6 19 3.5 16.5a2 2 0 0 1 0-2.8l7-7a2 2 0 0 1 2.8 0l4.5 4.5a2 2 0 0 1 0 2.8L13.5 19" />
      <path d="M3 19h13" />
      <path d="M9.5 8.5 16 15" />
    </svg>
  ),
};

const TOOLS = [
  { id: 'select', label: 'Select' },
  { id: 'freehand', label: 'Freehand' },
  { id: 'line', label: 'Line' },
  { id: 'rectangle', label: 'Rectangle' },
  { id: 'text', label: 'Text' },
  { id: 'square', label: 'Square' },
  { id: 'circle', label: 'Circle' },
  { id: 'eraser', label: 'Eraser' },
];

const FONT_FAMILIES = ['Arial', 'Times New Roman', 'Georgia', 'Courier New', 'Verdana', 'Comic Sans MS'];

const BRUSH_SIZES = [2, 5, 10, 16, 24];

export default function PaintToolbar({
  activeTool,
  onToolChange,
  strokeColor,
  onStrokeColorChange,
  fillColor,
  onFillColorChange,
  canFillSelection,
  fontFamily,
  onFontFamilyChange,
  fontSize,
  onFontSizeChange,
  brushSize,
  onBrushSizeChange,
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
            aria-label={t.label}
            title={t.label}
          >
            {ICONS[t.id]}
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
        <label className="paint-color-label" title="Select a rectangle, square, or circle to fill it with this color">
          Fill
          <input
            type="color"
            value={fillColor}
            onChange={e => onFillColorChange(e.target.value)}
            disabled={!canFillSelection}
          />
        </label>

        <div className="paint-brush-size-group" role="group" aria-label="Brush size">
          <span className="paint-color-label">Brush</span>
          {BRUSH_SIZES.map(size => (
            <button
              key={size}
              type="button"
              className={`paint-brush-size-button${brushSize === size ? ' active' : ''}`}
              onClick={() => onBrushSizeChange(size)}
              title={`${size}px`}
              aria-label={`Brush size ${size}`}
            >
              <span className="paint-brush-dot" style={{ width: size, height: size }} />
            </button>
          ))}
        </div>

        <label className="paint-color-label">
          Font
          <select
            className="paint-font-select"
            value={fontFamily}
            onChange={e => onFontFamilyChange(e.target.value)}
          >
            {FONT_FAMILIES.map(font => (
              <option key={font} value={font}>{font}</option>
            ))}
          </select>
        </label>
        <label className="paint-color-label">
          Size
          <input
            type="number"
            className="paint-font-size-input"
            min="8"
            max="120"
            value={fontSize}
            onChange={e => onFontSizeChange(Number(e.target.value))}
          />
        </label>
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
