import { useEffect, useRef, useState } from 'react';
import { Canvas } from 'fabric';
import PaintCategorySidebar from '../components/PaintCategorySidebar.jsx';
import PaintToolbar from '../components/PaintToolbar.jsx';
import {
  buildShape,
  addImageAt,
  createText,
  eraseObjectAt,
  exportPng,
  generateFilename,
  downloadDataUrl,
} from '../paint/fabricHelpers.js';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 560;
const DEFAULT_STROKE = '#4361ee';
const DEFAULT_FILL = '#ffd166';
const DEFAULT_FONT_FAMILY = 'Arial';
const DEFAULT_FONT_SIZE = 28;

export default function PaintScreen({ learnManifest, learnItems, paintCategory, dispatch }) {
  const canvasElRef = useRef(null);
  const fabricCanvasRef = useRef(null);
  const drawingRef = useRef(null); // { tool, startX, startY, shape } while a drag-to-draw is in progress

  const [activeTool, setActiveTool] = useState('select');
  const [strokeColor, setStrokeColor] = useState(DEFAULT_STROKE);
  const [fillColor, setFillColor] = useState(DEFAULT_FILL);
  const [fillEnabled, setFillEnabled] = useState(false);
  const [fontFamily, setFontFamily] = useState(DEFAULT_FONT_FAMILY);
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const [hasSelection, setHasSelection] = useState(false);

  // Mouse handlers are registered once; refs keep them reading current tool/color state.
  const toolRef = useRef(activeTool);
  const strokeRef = useRef(strokeColor);
  const fillColorRef = useRef(fillColor);
  const fillEnabledRef = useRef(fillEnabled);
  const fontFamilyRef = useRef(fontFamily);
  const fontSizeRef = useRef(fontSize);
  toolRef.current = activeTool;
  strokeRef.current = strokeColor;
  fillColorRef.current = fillColor;
  fillEnabledRef.current = fillEnabled;
  fontFamilyRef.current = fontFamily;
  fontSizeRef.current = fontSize;

  useEffect(() => {
    if (fabricCanvasRef.current) return; // StrictMode double-invoke guard
    const canvas = new Canvas(canvasElRef.current, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: '#ffffff',
    });
    fabricCanvasRef.current = canvas;

    const updateSelection = () => setHasSelection(canvas.getActiveObjects().length > 0);
    canvas.on('selection:created', updateSelection);
    canvas.on('selection:updated', updateSelection);
    canvas.on('selection:cleared', updateSelection);

    canvas.on('mouse:down', opt => {
      const tool = toolRef.current;
      if (tool === 'select') return;
      const pointer = canvas.getScenePoint(opt.e);

      if (tool === 'eraser') {
        if (eraseObjectAt(canvas, pointer)) canvas.requestRenderAll();
        return;
      }

      if (tool === 'text') {
        const text = createText(pointer.x, pointer.y, {
          fontFamily: fontFamilyRef.current,
          fontSize: fontSizeRef.current,
          color: strokeRef.current,
        });
        canvas.add(text);
        canvas.setActiveObject(text);
        text.enterEditing();
        canvas.requestRenderAll();
        setActiveTool('select');
        return;
      }

      const shape = buildShape(tool, { x0: pointer.x, y0: pointer.y, x1: pointer.x, y1: pointer.y }, {
        strokeColor: strokeRef.current,
        fillEnabled: fillEnabledRef.current,
        fillColor: fillColorRef.current,
      });
      if (!shape) return;
      shape.set({ selectable: false, evented: false });
      canvas.add(shape);
      drawingRef.current = { tool, startX: pointer.x, startY: pointer.y, shape };
    });

    canvas.on('mouse:move', opt => {
      const drawing = drawingRef.current;
      if (!drawing) return;
      const pointer = canvas.getScenePoint(opt.e);
      const next = buildShape(
        drawing.tool,
        { x0: drawing.startX, y0: drawing.startY, x1: pointer.x, y1: pointer.y },
        { strokeColor: strokeRef.current, fillEnabled: fillEnabledRef.current, fillColor: fillColorRef.current }
      );
      if (!next) return;
      canvas.remove(drawing.shape);
      next.set({ selectable: false, evented: false });
      canvas.add(next);
      drawing.shape = next;
      canvas.requestRenderAll();
    });

    canvas.on('mouse:up', () => {
      const drawing = drawingRef.current;
      if (!drawing) return;
      drawing.shape.set({ selectable: true, evented: true });
      canvas.setActiveObject(drawing.shape);
      drawingRef.current = null;
      setActiveTool('select');
      canvas.requestRenderAll();
    });

    return () => {
      canvas.dispose();
      fabricCanvasRef.current = null;
    };
  }, []);

  // While a shape tool is active, disable normal object selection/dragging so
  // drawing over existing objects doesn't move them instead.
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const drawMode = activeTool !== 'select';
    canvas.selection = !drawMode;
    canvas.skipTargetFind = drawMode;
    canvas.defaultCursor = drawMode ? 'crosshair' : 'default';
  }, [activeTool]);

  function handleImageDragStart(e, src) {
    e.dataTransfer.setData('text/plain', src);
    e.dataTransfer.effectAllowed = 'copy';
  }

  function handleCanvasDrop(e) {
    e.preventDefault();
    const src = e.dataTransfer.getData('text/plain');
    const canvas = fabricCanvasRef.current;
    if (!src || !canvas || !canvasElRef.current) return;
    const rect = canvasElRef.current.getBoundingClientRect();
    addImageAt(canvas, src, e.clientX - rect.left, e.clientY - rect.top);
  }

  function handleImageClick(src) {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    addImageAt(canvas, src, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
  }

  function handleDeleteSelected() {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    canvas.getActiveObjects().forEach(obj => canvas.remove(obj));
    canvas.discardActiveObject();
    canvas.requestRenderAll();
  }

  function handleClear() {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !window.confirm('Clear the whole canvas?')) return;
    canvas.clear();
    canvas.backgroundColor = '#ffffff';
    canvas.requestRenderAll();
  }

  function handleDownload() {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    downloadDataUrl(exportPng(canvas), generateFilename());
  }

  return (
    <div className="paint-screen">
      <PaintCategorySidebar
        learnManifest={learnManifest}
        learnItems={learnItems}
        paintCategory={paintCategory}
        dispatch={dispatch}
        onImageDragStart={handleImageDragStart}
        onImageClick={handleImageClick}
      />

      <div className="paint-main">
        <PaintToolbar
          activeTool={activeTool}
          onToolChange={setActiveTool}
          strokeColor={strokeColor}
          onStrokeColorChange={setStrokeColor}
          fillColor={fillColor}
          onFillColorChange={setFillColor}
          fillEnabled={fillEnabled}
          onFillEnabledChange={setFillEnabled}
          fontFamily={fontFamily}
          onFontFamilyChange={setFontFamily}
          fontSize={fontSize}
          onFontSizeChange={setFontSize}
          hasSelection={hasSelection}
          onDeleteSelected={handleDeleteSelected}
          onClear={handleClear}
          onDownload={handleDownload}
        />

        <div className="hint">Drag (or click) an image from the left onto the canvas, then draw shapes on top.</div>

        <div className="paint-canvas-wrap" onDragOver={e => e.preventDefault()} onDrop={handleCanvasDrop}>
          <canvas ref={canvasElRef} />
        </div>
      </div>
    </div>
  );
}
