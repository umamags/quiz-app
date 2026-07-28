const ITEMS = [
  { id: 'bring-forward', label: 'Bring forward' },
  { id: 'send-to-back', label: 'Send to back' },
  { id: 'duplicate', label: 'Duplicate' },
  { id: 'delete', label: 'Delete', danger: true },
];

export default function PaintContextMenu({ x, y, onBringForward, onSendToBack, onDuplicate, onDelete, ref }) {
  const handlers = {
    'bring-forward': onBringForward,
    'send-to-back': onSendToBack,
    duplicate: onDuplicate,
    delete: onDelete,
  };

  return (
    <div ref={ref} className="paint-context-menu" style={{ left: x, top: y }}>
      {ITEMS.map(item => (
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
