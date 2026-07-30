import { useEffect, useRef, useState } from 'react';
import { Canvas, PencilBrush } from 'fabric';
import PaintCategorySidebar from '../components/PaintCategorySidebar.jsx';
import PaintToolbar from '../components/PaintToolbar.jsx';
import PaintContextMenu from '../components/PaintContextMenu.jsx';
import {
  buildShape,
  addImageAt,
  addImageFromFile,
  pasteImageFromClipboard,
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
  const fileInputRef = useRef(null);

  const [activeTool, setActiveTool] = useState('select');
  const [strokeColor, setStrokeColor] = useState(DEFAULT_STROKE);
  const [fillColor, setFillColor] = useState(DEFAULT_FILL);
  const [fontFamily, setFontFamily] = useState(DEFAULT_FONT_FAMILY);
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const [brushSize, setBrushSize] = useState(DEFAULT_BRUSH_SIZE);
  const [hasSelection, setHasSelection] = useState(false);
  const [canFillSelection, setCanFillSelection] = useState(false);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, object, canvasX, canvasY } in viewport coords, or null when closed
  const contextMenuRef = useRef(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);

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

  function saveCanvasState() {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const state = JSON.stringify(canvas);
    undoStackRef.current.push(state);
    redoStackRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }

  function handleUndo() {
    const canvas = fabricCanvasRef.current;
    if (!canvas || undoStackRef.current.length === 0) return;

    const currentState = JSON.stringify(canvas);
    redoStackRef.current.push(currentState);
    setCanRedo(true);

    const previousState = undoStackRef.current.pop();
    canvas.loadFromJSON(previousState, () => {
      canvas.requestRenderAll();
      setCanUndo(undoStackRef.current.length > 0);
    });
  }

  function handleRedo() {
    const canvas = fabricCanvasRef.current;
    if (!canvas || redoStackRef.current.length === 0) return;

    const currentState = JSON.stringify(canvas);
    undoStackRef.current.push(currentState);
    setCanUndo(true);

    const nextState = redoStackRef.current.pop();
    canvas.loadFromJSON(nextState, () => {
      canvas.requestRenderAll();
      setCanRedo(redoStackRef.current.length > 0);
    });
  }

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
      saveCanvasState();
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

  async function handleCanvasDrop(e) {
    e.preventDefault();
    const src = e.dataTransfer.getData('text/plain');
    const canvas = fabricCanvasRef.current;
    if (!src || !canvas || !canvasElRef.current) return;
    const rect = canvasElRef.current.getBoundingClientRect();
    await addImageAt(canvas, src, e.clientX - rect.left, e.clientY - rect.top);
    saveCanvasState();
  }

  async function handleImageClick(src) {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    await addImageAt(canvas, src, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    saveCanvasState();
  }

  function handleFillColorChange(color) {
    setFillColor(color);
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObjects().filter(isFillableObject);
    if (active.length === 0) return;
    active.forEach(obj => obj.set('fill', color));
    canvas.requestRenderAll();
    saveCanvasState();
  }

  function handleDeleteSelected() {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    canvas.getActiveObjects().forEach(obj => canvas.remove(obj));
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    saveCanvasState();
  }

  function handleContextMenu(e) {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const pointer = canvas.getScenePoint(e);
    const target = findObjectAt(canvas, pointer);
    if (!target) {
      // No object: show context menu with paste option
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, object: null, canvasX: pointer.x, canvasY: pointer.y });
      return;
    }
    e.preventDefault();
    canvas.discardActiveObject();
    canvas.setActiveObject(target);
    canvas.requestRenderAll();
    setContextMenu({ x: e.clientX, y: e.clientY, object: target, canvasX: pointer.x, canvasY: pointer.y });
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
    saveCanvasState();
  }

  function handleSendToBack() {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !contextMenu) return;
    canvas.sendObjectBackwards(contextMenu.object);
    canvas.requestRenderAll();
    closeContextMenu();
    saveCanvasState();
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
    saveCanvasState();
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
    saveCanvasState();
  }

  function handleDownload() {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    downloadDataUrl(exportPng(canvas), generateFilename());
  }

  function handleLoadImageClick() {
    fileInputRef.current?.click();
  }

  async function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    try {
      await addImageFromFile(canvas, file, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      saveCanvasState();
    } catch (err) {
      console.error('Failed to load image:', err);
    }
    // Reset the input so the same file can be selected again
    e.target.value = '';
  }

  async function handlePaste() {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !contextMenu) return;
    try {
      await pasteImageFromClipboard(canvas, contextMenu.canvasX, contextMenu.canvasY);
      saveCanvasState();
    } catch (err) {
      console.error('Failed to paste image:', err);
    }
    closeContextMenu();
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
          onLoadImage={handleLoadImageClick}
          canUndo={canUndo}
          onUndo={handleUndo}
          canRedo={canRedo}
          onRedo={handleRedo}
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
          object={contextMenu.object}
          onBringForward={handleBringForward}
          onSendToBack={handleSendToBack}
          onDuplicate={handleDuplicate}
          onDelete={handleContextDelete}
          onPaste={handlePaste}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
    </div>
  );
}
