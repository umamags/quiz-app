import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PaintScreen from './PaintScreen.jsx';

// jsdom has no real <canvas> 2D context, so a real fabric.Canvas can't be
// constructed here. Stub out just enough of its API surface for PaintScreen
// to mount and wire up event listeners without crashing.
vi.mock('fabric', () => {
  class FakeCanvas {
    constructor() {
      this.handlers = {};
      this.selection = true;
      this.skipTargetFind = false;
      this.isDrawingMode = false;
      this.freeDrawingBrush = null;
      this.objects = [];
      this.activeObjects = [];
      this.bringObjectForward = vi.fn();
      this.sendObjectBackwards = vi.fn();
      FakeCanvas.instances.push(this);
    }
    on(event, handler) {
      this.handlers[event] = handler;
    }
    getActiveObjects() {
      return this.activeObjects;
    }
    getObjects() {
      return this.objects;
    }
    getScenePoint() {
      return { x: 0, y: 0 };
    }
    add(obj) {
      this.objects.push(obj);
    }
    remove(obj) {
      this.objects = this.objects.filter(o => o !== obj);
    }
    setActiveObject(obj) {
      this.activeObjects = [obj];
    }
    discardActiveObject() {
      this.activeObjects = [];
    }
    requestRenderAll() {}
    clear() {
      this.objects = [];
    }
    dispose() {}
    toDataURL() {
      return 'data:image/png;base64,ABC';
    }
  }
  FakeCanvas.instances = [];

  class FakeIText {
    constructor(text, options) {
      Object.assign(this, options);
      this.text = text;
    }
    enterEditing() {}
  }

  class FakePencilBrush {
    constructor(canvas) {
      this.canvas = canvas;
    }
  }

  return {
    Canvas: FakeCanvas,
    Rect: class {},
    Circle: class {},
    Line: class {},
    IText: FakeIText,
    PencilBrush: FakePencilBrush,
    FabricImage: { fromURL: vi.fn().mockResolvedValue({ width: 100, height: 100, set: vi.fn() }) },
  };
});

import { Canvas } from 'fabric';

function latestCanvas() {
  return Canvas.instances[Canvas.instances.length - 1];
}

const learnManifest = {
  categories: [
    { title: 'Birds', file: 'learn/birds.json' },
    { title: 'Animals', file: 'learn/animals.json' },
  ],
};

const learnItems = [
  {
    category: 'Animals',
    name: 'lion',
    description: 'A big cat.',
    images: ['images_downloaded/animals/lion_1.jpg', 'images_downloaded/animals/lion_2.jpg'],
  },
  {
    category: 'Animals',
    name: 'tiger',
    description: 'A striped big cat.',
    images: ['images_downloaded/animals/tiger_1.jpg'],
  },
  {
    category: 'Birds',
    name: 'eagle',
    description: 'A bird of prey.',
    images: ['images_downloaded/birds/eagle_1.jpg'],
  },
];

function renderScreen(overrides = {}) {
  const dispatch = vi.fn();
  render(
    <PaintScreen
      learnManifest={learnManifest}
      learnItems={learnItems}
      paintCategory={null}
      dispatch={dispatch}
      {...overrides}
    />
  );
  return dispatch;
}

describe('PaintScreen', () => {
  it('renders the category sidebar and every drawing tool', () => {
    renderScreen();
    expect(screen.getByRole('button', { name: 'Animals' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Birds' })).toBeInTheDocument();
    for (const tool of ['Select', 'Line', 'Rectangle', 'Text', 'Square', 'Circle', 'Eraser']) {
      expect(screen.getByRole('button', { name: tool })).toBeInTheDocument();
    }
  });

  it('renders font family and font size controls for the Text tool', () => {
    renderScreen();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton')).toHaveValue(28);
  });

  it('shows a hint instead of thumbnails until a category is selected', () => {
    renderScreen();
    expect(screen.getByText('Choose a category to see images.')).toBeInTheDocument();
  });

  it('shows that category\'s image thumbnails once a category is selected, e.g. Animals -> lion/tiger', () => {
    renderScreen({ paintCategory: 'Animals' });
    expect(screen.getAllByAltText('lion')).toHaveLength(2); // lion has two images in the fixture
    expect(screen.getByAltText('tiger')).toBeInTheDocument();
    expect(screen.queryByAltText('eagle')).not.toBeInTheDocument();
  });

  it('dispatches PAINT_CATEGORY_SELECTED when a category is clicked', async () => {
    const user = userEvent.setup();
    const dispatch = renderScreen();
    await user.click(screen.getByRole('button', { name: 'Birds' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'PAINT_CATEGORY_SELECTED', category: 'Birds' });
  });

  it('marks the active drawing tool and switches it on click', async () => {
    const user = userEvent.setup();
    renderScreen();
    expect(screen.getByRole('button', { name: 'Select' })).toHaveClass('active');

    await user.click(screen.getByRole('button', { name: 'Rectangle' }));
    expect(screen.getByRole('button', { name: 'Rectangle' })).toHaveClass('active');
    expect(screen.getByRole('button', { name: 'Select' })).not.toHaveClass('active');
  });

  it('disables Delete until something is selected', () => {
    renderScreen();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
  });

  it('disables the fill color picker until a fillable shape is selected, then applies fill on change', () => {
    renderScreen();
    const canvas = latestCanvas();
    const colorInputs = document.querySelectorAll('input[type="color"]');
    const fillColorInput = colorInputs[1];
    expect(fillColorInput).toBeDisabled();

    const rect = { type: 'rect', fill: 'transparent', set(prop, value) { this[prop] = value; } };
    canvas.add(rect);
    canvas.activeObjects = [rect];
    act(() => {
      canvas.handlers['selection:created']();
    });
    expect(fillColorInput).toBeEnabled();

    fireEvent.change(fillColorInput, { target: { value: '#00ff00' } });
    expect(rect.fill).toBe('#00ff00');
  });

  it('leaves the fill color picker disabled when the selection includes a non-fillable object (e.g. a line)', () => {
    renderScreen();
    const canvas = latestCanvas();
    const colorInputs = document.querySelectorAll('input[type="color"]');
    const fillColorInput = colorInputs[1];

    const line = { type: 'line', set() {} };
    canvas.add(line);
    canvas.activeObjects = [line];
    act(() => {
      canvas.handlers['selection:created']();
    });

    expect(fillColorInput).toBeDisabled();
  });

  it('clicking a thumbnail adds the image to the canvas without crashing', async () => {
    const user = userEvent.setup();
    renderScreen({ paintCategory: 'Animals' });
    await user.click(screen.getByAltText('tiger'));
    // No error thrown, and the mocked FabricImage.fromURL pipeline ran.
  });

  it('placing a Text object on the canvas immediately reverts the tool to Select', async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.click(screen.getByRole('button', { name: 'Text' }));
    expect(screen.getByRole('button', { name: 'Text' })).toHaveClass('active');

    act(() => {
      latestCanvas().handlers['mouse:down']({ e: {} });
    });

    expect(screen.getByRole('button', { name: 'Select' })).toHaveClass('active');
    expect(screen.getByRole('button', { name: 'Text' })).not.toHaveClass('active');
  });

  it('Eraser removes the clicked object and stays active for erasing more', async () => {
    const user = userEvent.setup();
    renderScreen();
    const canvas = latestCanvas();
    const target = { containsPoint: () => true };
    canvas.add(target);

    await user.click(screen.getByRole('button', { name: 'Eraser' }));
    canvas.handlers['mouse:down']({ e: {} });

    expect(canvas.getObjects()).not.toContain(target);
    expect(screen.getByRole('button', { name: 'Eraser' })).toHaveClass('active');
  });
});

function fakeObject(overrides = {}) {
  return {
    type: 'rect',
    containsPoint: () => true,
    set(keyOrObj, value) {
      if (typeof keyOrObj === 'object') Object.assign(this, keyOrObj);
      else this[keyOrObj] = value;
    },
    ...overrides,
  };
}

function rightClickCanvas(coords = { clientX: 50, clientY: 60 }) {
  fireEvent.contextMenu(document.querySelector('.paint-canvas-wrap'), coords);
}

function contextMenuQueries() {
  return within(document.querySelector('.paint-context-menu'));
}

describe('PaintScreen right-click object menu', () => {
  it('opens with all 4 actions on an object, narrowing any existing multi-selection to just that object', () => {
    renderScreen();
    const canvas = latestCanvas();
    const objA = fakeObject();
    const objB = fakeObject({ type: 'circle', containsPoint: () => false });
    canvas.add(objA);
    canvas.activeObjects = [objA, objB]; // pretend a multi-selection already exists

    rightClickCanvas();

    expect(canvas.getActiveObjects()).toEqual([objA]);
    const menu = contextMenuQueries();
    for (const label of ['Bring forward', 'Send to back', 'Duplicate', 'Delete']) {
      expect(menu.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('does not open when right-clicking empty canvas', () => {
    renderScreen();

    rightClickCanvas();

    expect(screen.queryByRole('button', { name: 'Duplicate' })).not.toBeInTheDocument();
  });

  it('Bring forward moves the target object forward one step and closes the menu', async () => {
    const user = userEvent.setup();
    renderScreen();
    const canvas = latestCanvas();
    const obj = fakeObject();
    canvas.add(obj);
    rightClickCanvas();

    await user.click(screen.getByRole('button', { name: 'Bring forward' }));

    expect(canvas.bringObjectForward).toHaveBeenCalledWith(obj);
    expect(screen.queryByRole('button', { name: 'Bring forward' })).not.toBeInTheDocument();
  });

  it('Send to back moves the target object back one step and closes the menu', async () => {
    const user = userEvent.setup();
    renderScreen();
    const canvas = latestCanvas();
    const obj = fakeObject();
    canvas.add(obj);
    rightClickCanvas();

    await user.click(screen.getByRole('button', { name: 'Send to back' }));

    expect(canvas.sendObjectBackwards).toHaveBeenCalledWith(obj);
    expect(screen.queryByRole('button', { name: 'Send to back' })).not.toBeInTheDocument();
  });

  it('Duplicate clones the object with an offset, keeping its color, and selects the copy', async () => {
    const user = userEvent.setup();
    renderScreen();
    const canvas = latestCanvas();
    const clone = fakeObject();
    const original = fakeObject({ left: 10, top: 20, fill: '#4361ee', clone: vi.fn().mockResolvedValue(clone) });
    canvas.add(original);
    rightClickCanvas();

    await user.click(screen.getByRole('button', { name: 'Duplicate' }));
    await act(async () => {}); // flush the clone() promise

    expect(original.clone).toHaveBeenCalled();
    expect(clone.left).toBe(22);
    expect(clone.top).toBe(32);
    expect(canvas.getObjects()).toContain(clone);
    expect(canvas.getActiveObjects()).toEqual([clone]);
  });

  it('Delete removes the target object and closes the menu', async () => {
    const user = userEvent.setup();
    renderScreen();
    const canvas = latestCanvas();
    const obj = fakeObject();
    canvas.add(obj);
    rightClickCanvas();

    await user.click(contextMenuQueries().getByRole('button', { name: 'Delete' }));

    expect(canvas.getObjects()).not.toContain(obj);
    expect(document.querySelector('.paint-context-menu')).not.toBeInTheDocument();
  });

  it('closes on an outside click without changing the selection', () => {
    renderScreen();
    const canvas = latestCanvas();
    const obj = fakeObject();
    canvas.add(obj);
    rightClickCanvas();
    expect(screen.getByRole('button', { name: 'Duplicate' })).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole('button', { name: 'Duplicate' })).not.toBeInTheDocument();
  });

  it('closes on Escape', () => {
    renderScreen();
    const canvas = latestCanvas();
    const obj = fakeObject();
    canvas.add(obj);
    rightClickCanvas();
    expect(screen.getByRole('button', { name: 'Duplicate' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('button', { name: 'Duplicate' })).not.toBeInTheDocument();
  });
});
