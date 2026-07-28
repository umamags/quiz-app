import { useEffect, useRef, useState } from 'react';
import { Canvas, PencilBrush } from 'fabric';
import PaintCategorySidebar from '../components/PaintCategorySidebar.jsx';
import PaintToolbar from '../components/PaintToolbar.jsx';
import PaintContextMenu from '../components/PaintContextMenu.jsx';
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
} from '../paint/fabricHelpers.js';

const CANVAS_WIDTH = 1040; // 800 * 1.3
const CANVAS_HEIGHT = 560;
const DEFAULT_STROKE = '#4361ee';
const DEFAULT_FILL = '#ffd166';
const DEFAULT_FONT_FAMILY = 'Arial';
const DEFAULT_FONT_SIZE = 28;
const DEFAULT_BRUSH_SIZE = 5;

export default function PaintScreen({ learnManifest, learnItems, paintCategory, dispatch }) {
  const canvasElRef = useRef(null);
  const fabricCanvasRef = useRef(null);
  const drawingRef = useRef(null); // { tool, startX, startY, shape } while a drag-to-draw is in progress

  const [activeTool, setActiveTool] = useState('select');
  const [strokeColor, setStrokeColor] = useState(DEFAULT_STROKE);
  const [fillColor, setFillColor] = useState(DEFAULT_FILL);
  const [fontFamily, setFontFamily] = useState(DEFAULT_FONT_FAMILY);
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const [brushSize, setBrushSize] = useState(DEFAULT_BRUSH_SIZE);
  const [hasSelection, setHasSelection] = useState(false);
  const [canFillSelection, setCanFillSelection] = useState(false);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, object } in viewport coords, or null when closed
  const contextMenuRef = useRef(null);

  // Mouse handlers are registered once; refs keep them reading current tool/color state.
  const toolRef = useRef(activeTool);
  const strokeRef = useRef(strokeColor);
  const fontFamilyRef = useRef(fontFamily);
  const fontSizeRef = useRef(fontSize);
  const brushSizeRef = useRef(brushSize);
  toolRef.current = activeTool;
  strokeRef.current = strokeColor;
  fontFamilyRef.current = fontFamily;
  fontSizeRef.current = fontSize;
  brushSizeRef.current = brushSize;

  useEffect(() => {
    if (fabricCanvasRef.current) return; // StrictMode double-invoke guard
    const canvas = new Canvas(canvasElRef.current, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: '#ffffff',
      stopContextMenu: false, // let the native contextmenu event bubble up to our own React handler
    });
    fabricCanvasRef.current = canvas;

    canvas.freeDrawingBrush = new PencilBrush(canvas);
    canvas.freeDrawingBrush.color = strokeRef.current;
    canvas.freeDrawingBrush.width = brushSizeRef.current;

    const updateSelection = () => {
      const active = canvas.getActiveObjects();
      setHasSelection(active.length > 0);
      const fillable = active.length > 0 && active.every(isFillableObject);
      setCanFillSelection(fillable);
      if (fillable && active.length === 1 && typeof active[0].fill === 'string' && active[0].fill !== 'transparent') {
        setFillColor(active[0].fill);
      }
    };
    canvas.on('selection:created', updateSelection);
    canvas.on('selection:updated', updateSelection);
    canvas.on('selection:cleared', updateSelection);

    canvas.on('mouse:down', opt => {
      if (opt.e.button !== undefined && opt.e.button !== 0) return; // ignore right/middle-click; left-click drawing only
      const tool = toolRef.current;
      if (tool === 'select' || tool === 'freehand') return; // freehand draws via canvas.isDrawingMode
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
        { strokeColor: strokeRef.current }
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
    canvas.isDrawingMode = activeTool === 'freehand';
    canvas.selection = !drawMode;
    canvas.skipTargetFind = drawMode;
    canvas.defaultCursor = drawMode ? 'crosshair' : 'default';
  }, [activeTool]);

  // Keep the freehand brush's color/width in sync while it's in use.
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !canvas.freeDrawingBrush) return;
    canvas.freeDrawingBrush.color = strokeColor;
    canvas.freeDrawingBrush.width = brushSize;
  }, [strokeColor, brushSize]);

  // Close the right-click object menu on an outside click or Escape.
  useEffect(() => {
    if (!contextMenu) return;
    function handlePointerDown(e) {
      if (!contextMenuRef.current || !contextMenuRef.current.contains(e.target)) {
        setContextMenu(null);
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') setContextMenu(null);
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu]);

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

  function handleFillColorChange(color) {
    setFillColor(color);
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObjects().filter(isFillableObject);
    if (active.length === 0) return;
    active.forEach(obj => obj.set('fill', color));
    canvas.requestRenderAll();
  }

  function handleDeleteSelected() {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    canvas.getActiveObjects().forEach(obj => canvas.remove(obj));
    canvas.discardActiveObject();
    canvas.requestRenderAll();
  }

  function handleContextMenu(e) {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const pointer = canvas.getScenePoint(e);
    const target = findObjectAt(canvas, pointer);
    if (!target) {
      setContextMenu(null);
      return; // no object here: let the browser's native context menu show
    }
    e.preventDefault();
    canvas.discardActiveObject();
    canvas.setActiveObject(target);
    canvas.requestRenderAll();
    setContextMenu({ x: e.clientX, y: e.clientY, object: target });
  }

  function closeContextMenu() {
    setContextMenu(null);
  }

  function handleBringForward() {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !contextMenu) return;
    canvas.bringObjectForward(contextMenu.object);
    canvas.requestRenderAll();
    closeContextMenu();
  }

  function handleSendToBack() {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !contextMenu) return;
    canvas.sendObjectBackwards(contextMenu.object);
    canvas.requestRenderAll();
    closeContextMenu();
  }

  async function handleDuplicate() {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !contextMenu) return;
    const original = contextMenu.object;
    closeContextMenu();
    const clone = await original.clone();
    clone.set({ left: (original.left ?? 0) + 12, top: (original.top ?? 0) + 12 });
    canvas.add(clone);
    canvas.setActiveObject(clone);
    canvas.requestRenderAll();
  }

  function handleContextDelete() {
    handleDeleteSelected();
    closeContextMenu();
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
          onFillColorChange={handleFillColorChange}
          canFillSelection={canFillSelection}
          fontFamily={fontFamily}
          onFontFamilyChange={setFontFamily}
          fontSize={fontSize}
          onFontSizeChange={setFontSize}
          brushSize={brushSize}
          onBrushSizeChange={setBrushSize}
          hasSelection={hasSelection}
          onDeleteSelected={handleDeleteSelected}
          onClear={handleClear}
          onDownload={handleDownload}
        />

        <div className="hint">Drag (or click) an image from the left onto the canvas, then draw shapes on top.</div>

        <div
          className="paint-canvas-wrap"
          onDragOver={e => e.preventDefault()}
          onDrop={handleCanvasDrop}
          onContextMenu={handleContextMenu}
        >
          <canvas ref={canvasElRef} />
        </div>
      </div>

      {contextMenu && (
        <PaintContextMenu
          ref={contextMenuRef}
          x={contextMenu.x}
          y={contextMenu.y}
          onBringForward={handleBringForward}
          onSendToBack={handleSendToBack}
          onDuplicate={handleDuplicate}
          onDelete={handleContextDelete}
        />
      )}
    </div>
  );
}
