import { useEffect } from 'react';

export default function Lightbox({ image, onClose }) {
  useEffect(() => {
    if (!image) return;
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [image, onClose]);

  if (!image) return null;

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <button type="button" className="lightbox-close" aria-label="Close" onClick={onClose}>
        &times;
      </button>
      <img className="lightbox-image" src={image.src} alt={image.alt} onClick={e => e.stopPropagation()} />
    </div>
  );
}
