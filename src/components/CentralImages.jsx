export default function CentralImages({ q }) {
  if (!q.centralImage) return <div className="central-image-wrap" />;
  const images = Array.isArray(q.centralImage) ? q.centralImage : [q.centralImage];
  return (
    <div className="central-image-wrap">
      {images.map((src, i) => (
        <img key={src + i} className="central-image" src={src} alt={q.questionText} />
      ))}
    </div>
  );
}
