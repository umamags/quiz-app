import { useState } from 'react';
import Lightbox from './Lightbox.jsx';

export default function CentralImages({ q }) {
  const [lightbox, setLightbox] = useState(null);

  if (!q.centralImage) return <div className="central-image-wrap" />;
  const images = Array.isArray(q.centralImage) ? q.centralImage : [q.centralImage];

  return (
    <div className="central-image-wrap">
      {images.map((src, i) => (
        <button
          key={src + i}
          type="button"
          className="central-image-button"
          onClick={() => setLightbox({ src, alt: q.questionText })}
        >
          <img className="central-image" src={src} alt={q.questionText} />
        </button>
      ))}
      <Lightbox image={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}
