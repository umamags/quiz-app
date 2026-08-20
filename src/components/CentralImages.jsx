import { useState } from 'react';
import Lightbox from './Lightbox.jsx';
import { getImageUrl, getCountryImageUrl } from '../config/assetUrls.js';

export default function CentralImages({ q }) {
  const [lightbox, setLightbox] = useState(null);

  if (!q.centralImage) return <div className="central-image-wrap" />;
  const images = Array.isArray(q.centralImage) ? q.centralImage : [q.centralImage];

  return (
    <div className="central-image-wrap">
      {images.map((src, i) => {
        // Transform relative image path to correct URL (local or remote)
        const imageUrl = src.includes('countries_images') ? getCountryImageUrl(src) : getImageUrl(src);
        return (
          <button
            key={src + i}
            type="button"
            className="central-image-button"
            onClick={() => setLightbox({ src: imageUrl, alt: q.questionText })}
          >
            <img className="central-image" src={imageUrl} alt={q.questionText} />
          </button>
        );
      })}
      <Lightbox image={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
}
