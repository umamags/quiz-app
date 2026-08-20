const ITEMS = [
  { id: 'bring-forward', label: 'Bring forward' },
  { id: 'send-to-back', label: 'Send to back' },
  { id: 'duplicate', label: 'Duplicate' },
  { id: 'delete', label: 'Delete', danger: true },
];

const FILLABLE_ITEMS = [
  { id: 'fill', label: 'Fill', highlight: true },
  ...ITEMS,
];

const CANVAS_ITEMS = [
  { id: 'paste', label: 'Paste' },
];

export default function PaintContextMenu({ x, y, object, isFillable, onBringForward, onSendToBack, onDuplicate, onDelete, onPaste, onFill, ref }) {
  const items = !object ? CANVAS_ITEMS : (isFillable ? FILLABLE_ITEMS : ITEMS);
  const handlers = {
    'bring-forward': onBringForward,
    'send-to-back': onSendToBack,
    duplicate: onDuplicate,
    delete: onDelete,
    paste: onPaste,
    fill: onFill,
  };

  return (
    <div ref={ref} className="paint-context-menu" style={{ left: x, top: y }}>
      {items.map(item => (
        <button
          key={item.id}
          type="button"
          className={`paint-context-menu-item${item.danger ? ' danger' : ''}${item.highlight ? ' highlight' : ''}`}
          onClick={handlers[item.id]}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
