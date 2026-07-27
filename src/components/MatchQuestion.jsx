import { useState } from 'react';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import Lightbox from './Lightbox.jsx';

function MatchContent({ type, content, onZoom }) {
  if (type !== 'image') return <span>{content}</span>;
  return (
    <button
      type="button"
      className="match-image-zoom"
      onClick={e => {
        e.stopPropagation();
        onZoom(content);
      }}
    >
      <img src={content} alt="" />
    </button>
  );
}

function LeftItem({ pairIndex, type, content, matched, onZoom }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: 'left-' + pairIndex,
    data: { pairIndex },
    disabled: matched,
  });
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 10, position: 'relative' }
    : undefined;
  const className =
    'match-item match-left' + (matched ? ' matched correct' : '') + (isDragging ? ' dragging' : '');

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={className}
      data-pair-index={pairIndex}
      {...listeners}
      {...attributes}
    >
      <MatchContent type={type} content={content} onZoom={onZoom} />
    </div>
  );
}

function RightItem({ pairIndex, type, content, matched, flashIncorrect, onZoom }) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'right-' + pairIndex,
    data: { pairIndex },
    disabled: matched,
  });
  const className =
    'match-item match-right' +
    (matched ? ' matched correct' : '') +
    (isOver && !matched ? ' drag-over' : '') +
    (flashIncorrect ? ' incorrect' : '');

  return (
    <div ref={setNodeRef} className={className} data-pair-index={pairIndex}>
      <MatchContent type={type} content={content} onZoom={onZoom} />
    </div>
  );
}

export default function MatchQuestion({ q, matchedPairs, rightOrder, onCorrectMatch }) {
  const [flashTarget, setFlashTarget] = useState(null);
  const [lightbox, setLightbox] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  );

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over) return;
    const sourcePairIndex = active.data.current.pairIndex;
    const targetPairIndex = over.data.current.pairIndex;
    if (sourcePairIndex === targetPairIndex) {
      onCorrectMatch(sourcePairIndex);
    } else {
      setFlashTarget(targetPairIndex);
      setTimeout(() => setFlashTarget(null), 500);
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="match-wrap">
        <div className="match-col">
          {q.pairs.map((pair, pairIndex) => (
            <LeftItem
              key={pairIndex}
              pairIndex={pairIndex}
              type={q.leftType}
              content={pair.left}
              matched={matchedPairs.includes(pairIndex)}
              onZoom={src => setLightbox({ src, alt: '' })}
            />
          ))}
        </div>
        <div className="match-col">
          {rightOrder.map(pairIndex => (
            <RightItem
              key={pairIndex}
              pairIndex={pairIndex}
              type={q.rightType}
              content={q.pairs[pairIndex].right}
              matched={matchedPairs.includes(pairIndex)}
              flashIncorrect={flashTarget === pairIndex}
              onZoom={src => setLightbox({ src, alt: '' })}
            />
          ))}
        </div>
      </div>
      <Lightbox image={lightbox} onClose={() => setLightbox(null)} />
    </DndContext>
  );
}
