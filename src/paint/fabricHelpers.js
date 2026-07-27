import { Rect, Circle, Line, FabricImage } from 'fabric';

const MIN_SHAPE_SIZE = 4;
const IMAGE_MAX_DIMENSION = 220;

// Builds a fresh shape object spanning the drag rectangle (x0,y0) -> (x1,y1).
// Called on every mouse:move during a drag, so callers should replace the
// previous shape with the one returned here rather than mutating in place.
export function buildShape(tool, { x0, y0, x1, y1 }, { strokeColor, fillEnabled, fillColor }) {
  const fill = fillEnabled ? fillColor : 'transparent';
  const left = Math.min(x0, x1);
  const top = Math.min(y0, y1);
  const width = Math.max(Math.abs(x1 - x0), MIN_SHAPE_SIZE);
  const height = Math.max(Math.abs(y1 - y0), MIN_SHAPE_SIZE);

  switch (tool) {
    case 'line':
      return new Line([x0, y0, x1, y1], {
        stroke: strokeColor,
        strokeWidth: 3,
      });

    case 'rectangle':
      return new Rect({ left, top, width, height, stroke: strokeColor, fill, strokeWidth: 2 });

    case 'square': {
      const side = Math.max(width, height);
      return new Rect({ left, top, width: side, height: side, stroke: strokeColor, fill, strokeWidth: 2 });
    }

    case 'circle': {
      const radius = Math.max(width, height) / 2;
      return new Circle({ left, top, radius, stroke: strokeColor, fill, strokeWidth: 2 });
    }

    default:
      return null;
  }
}

// Loads an image from `src` and adds it to the canvas centered at (x, y),
// scaled down so oversized source photos don't dwarf the canvas.
export async function addImageAt(canvas, src, x, y) {
  const img = await FabricImage.fromURL(src);
  const scale = Math.min(1, IMAGE_MAX_DIMENSION / Math.max(img.width || IMAGE_MAX_DIMENSION, img.height || IMAGE_MAX_DIMENSION));
  img.set({
    left: x - (img.width * scale) / 2,
    top: y - (img.height * scale) / 2,
    scaleX: scale,
    scaleY: scale,
  });
  canvas.add(img);
  canvas.setActiveObject(img);
  canvas.requestRenderAll();
  return img;
}

export function exportPng(canvas) {
  return canvas.toDataURL({ format: 'png', multiplier: 2 });
}

export function generateFilename(prefix = 'paint-drawing') {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${prefix}-${timestamp}.png`;
}

export function downloadDataUrl(dataUrl, filename) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
