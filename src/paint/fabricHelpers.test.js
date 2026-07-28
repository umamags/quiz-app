import { describe, expect, it, vi, beforeEach } from 'vitest';

// jsdom has no real <canvas> 2D context, so real fabric shape/image classes
// aren't safe to instantiate here -- stand in with plain objects that record
// what they were constructed/called with.
vi.mock('fabric', () => {
  class FakeFabricObject {
    constructor(options = {}) {
      Object.assign(this, options);
    }
    set(options) {
      Object.assign(this, options);
      return this;
    }
  }
  class Rect extends FakeFabricObject {}
  class Circle extends FakeFabricObject {}
  class Line extends FakeFabricObject {
    constructor(points, options) {
      super(options);
      this.points = points;
    }
  }
  class IText extends FakeFabricObject {
    constructor(text, options) {
      super(options);
      this.text = text;
    }
  }
  const FabricImage = { fromURL: vi.fn() };
  return { Rect, Circle, Line, FabricImage, IText };
});

import { Rect, Circle, Line, FabricImage, IText } from 'fabric';
import {
  buildShape,
  addImageAt,
  createText,
  eraseObjectAt,
  findObjectAt,
  exportPng,
  generateFilename,
  downloadDataUrl,
  isFillableObject,
} from './fabricHelpers.js';

const style = { strokeColor: '#111111' };

describe('buildShape', () => {
  it('builds a rectangle spanning the drag rectangle, always unfilled', () => {
    const shape = buildShape('rectangle', { x0: 10, y0: 20, x1: 110, y1: 70 }, style);
    expect(shape).toBeInstanceOf(Rect);
    expect(shape).toMatchObject({ left: 10, top: 20, width: 100, height: 50, stroke: '#111111', fill: 'transparent' });
  });

  it('handles drags in any direction by normalizing left/top', () => {
    const shape = buildShape('rectangle', { x0: 110, y0: 70, x1: 10, y1: 20 }, style);
    expect(shape).toMatchObject({ left: 10, top: 20, width: 100, height: 50 });
  });

  it('builds a square using the larger of width/height for both sides', () => {
    const shape = buildShape('square', { x0: 0, y0: 0, x1: 30, y1: 90 }, style);
    expect(shape.width).toBe(90);
    expect(shape.height).toBe(90);
  });

  it('builds a circle with radius from half the bounding box', () => {
    const shape = buildShape('circle', { x0: 0, y0: 0, x1: 60, y1: 20 }, style);
    expect(shape).toBeInstanceOf(Circle);
    expect(shape.radius).toBe(30);
  });

  it('builds a line between the two drag points', () => {
    const shape = buildShape('line', { x0: 5, y0: 6, x1: 50, y1: 60 }, style);
    expect(shape).toBeInstanceOf(Line);
    expect(shape.points).toEqual([5, 6, 50, 60]);
    expect(shape.stroke).toBe('#111111');
  });

  it('returns null for an unknown tool', () => {
    expect(buildShape('select', { x0: 0, y0: 0, x1: 1, y1: 1 }, style)).toBeNull();
  });
});

describe('isFillableObject', () => {
  it('is true for rectangles and circles, which have a bounded interior', () => {
    expect(isFillableObject({ type: 'rect' })).toBe(true);
    expect(isFillableObject({ type: 'circle' })).toBe(true);
  });

  it('is false for lines, freehand paths, text, and images, which do not', () => {
    expect(isFillableObject({ type: 'line' })).toBe(false);
    expect(isFillableObject({ type: 'path' })).toBe(false);
    expect(isFillableObject({ type: 'i-text' })).toBe(false);
    expect(isFillableObject({ type: 'image' })).toBe(false);
  });

  it('is false for null/undefined', () => {
    expect(isFillableObject(null)).toBe(false);
    expect(isFillableObject(undefined)).toBe(false);
  });
});

describe('createText', () => {
  it('creates an empty, editable text object with the given font and color', () => {
    const text = createText(50, 60, { fontFamily: 'Georgia', fontSize: 32, color: '#123456' });
    expect(text).toBeInstanceOf(IText);
    expect(text).toMatchObject({ text: '', left: 50, top: 60, fontFamily: 'Georgia', fontSize: 32, fill: '#123456' });
  });
});

describe('findObjectAt', () => {
  function stubObject(hit) {
    return { containsPoint: vi.fn().mockReturnValue(hit) };
  }

  it('returns the topmost object under the pointer, without removing it', () => {
    const bottom = stubObject(true);
    const top = stubObject(true);
    const canvas = { getObjects: () => [bottom, top], remove: vi.fn() };

    const result = findObjectAt(canvas, { x: 1, y: 1 });

    expect(result).toBe(top);
    expect(canvas.remove).not.toHaveBeenCalled();
  });

  it('returns null when no object is under the pointer', () => {
    const canvas = { getObjects: () => [stubObject(false), stubObject(false)] };
    expect(findObjectAt(canvas, { x: 1, y: 1 })).toBeNull();
  });
});

describe('eraseObjectAt', () => {
  function stubObject(hit) {
    return { containsPoint: vi.fn().mockReturnValue(hit) };
  }

  it('removes and returns the topmost object under the pointer', () => {
    const bottom = stubObject(true);
    const top = stubObject(true);
    const canvas = { getObjects: () => [bottom, top], remove: vi.fn() };

    const result = eraseObjectAt(canvas, { x: 1, y: 1 });

    expect(result).toBe(top);
    expect(canvas.remove).toHaveBeenCalledWith(top);
    expect(canvas.remove).toHaveBeenCalledTimes(1);
  });

  it('skips objects that do not contain the pointer to find the one that does', () => {
    const miss = stubObject(false);
    const hit = stubObject(true);
    const canvas = { getObjects: () => [hit, miss], remove: vi.fn() };

    const result = eraseObjectAt(canvas, { x: 1, y: 1 });

    expect(result).toBe(hit);
    expect(canvas.remove).toHaveBeenCalledWith(hit);
  });

  it('returns null and removes nothing when no object is under the pointer', () => {
    const canvas = { getObjects: () => [stubObject(false), stubObject(false)], remove: vi.fn() };

    const result = eraseObjectAt(canvas, { x: 1, y: 1 });

    expect(result).toBeNull();
    expect(canvas.remove).not.toHaveBeenCalled();
  });
});

describe('addImageAt', () => {
  beforeEach(() => {
    FabricImage.fromURL.mockReset();
  });

  it('centers the image at the given point and adds it to the canvas', async () => {
    const img = { width: 100, height: 100, set: vi.fn() };
    FabricImage.fromURL.mockResolvedValue(img);
    const canvas = { add: vi.fn(), setActiveObject: vi.fn(), requestRenderAll: vi.fn() };

    await addImageAt(canvas, 'images_downloaded/animals/dog_1.jpg', 200, 300);

    expect(FabricImage.fromURL).toHaveBeenCalledWith('images_downloaded/animals/dog_1.jpg');
    expect(img.set).toHaveBeenCalledWith({ left: 150, top: 250, scaleX: 1, scaleY: 1 });
    expect(canvas.add).toHaveBeenCalledWith(img);
    expect(canvas.setActiveObject).toHaveBeenCalledWith(img);
    expect(canvas.requestRenderAll).toHaveBeenCalled();
  });

  it('scales down images larger than the max dimension', async () => {
    const img = { width: 440, height: 220, set: vi.fn() };
    FabricImage.fromURL.mockResolvedValue(img);
    const canvas = { add: vi.fn(), setActiveObject: vi.fn(), requestRenderAll: vi.fn() };

    await addImageAt(canvas, 'src.jpg', 0, 0);

    expect(img.set).toHaveBeenCalledWith(expect.objectContaining({ scaleX: 0.5, scaleY: 0.5 }));
  });
});

describe('exportPng', () => {
  it('requests a PNG data URL at 2x scale', () => {
    const canvas = { toDataURL: vi.fn().mockReturnValue('data:image/png;base64,ABC') };
    expect(exportPng(canvas)).toBe('data:image/png;base64,ABC');
    expect(canvas.toDataURL).toHaveBeenCalledWith({ format: 'png', multiplier: 2 });
  });
});

describe('generateFilename', () => {
  it('produces a timestamped png filename with the given prefix', () => {
    const filename = generateFilename('paint-drawing');
    expect(filename).toMatch(/^paint-drawing-.+\.png$/);
  });
});

describe('downloadDataUrl', () => {
  it('creates a temporary anchor with the right href/filename, clicks it, and removes it', () => {
    let clickedAnchor = null;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      clickedAnchor = { href: this.href, download: this.download };
    });

    downloadDataUrl('data:image/png;base64,ABC', 'my-drawing.png');

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(clickedAnchor).toEqual({ href: 'data:image/png;base64,ABC', download: 'my-drawing.png' });
    expect(document.body.querySelector('a[download="my-drawing.png"]')).toBeNull();

    clickSpy.mockRestore();
  });
});
