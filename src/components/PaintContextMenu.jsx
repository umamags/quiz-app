const ITEMS = [
  { id: 'bring-forward', label: 'Bring forward' },
  { id: 'send-to-back', label: 'Send to back' },
  { id: 'duplicate', label: 'Duplicate' },
  { id: 'delete', label: 'Delete', danger: true },
];

const CANVAS_ITEMS = [
  { id: 'paste', label: 'Paste' },
];

export default function PaintContextMenu({ x, y, object, onBringForward, onSendToBack, onDuplicate, onDelete, onPaste, ref }) {
  const items = object ? ITEMS : CANVAS_ITEMS;
  const handlers = {
    'bring-forward': onBringForward,
    'send-to-back': onSendToBack,
    duplicate: onDuplicate,
    delete: onDelete,
    paste: onPaste,
  };

  return (
    <div ref={ref} className="paint-context-menu" style={{ left: x, top: y }}>
      {items.map(item => (
        <button
          key={item.id}
          type="button"
          className={`paint-context-menu-item${item.danger ? ' danger' : ''}`}
          onClick={handlers[item.id]}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
