import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
    }
    on(event, handler) {
      this.handlers[event] = handler;
    }
    getActiveObjects() {
      return [];
    }
    getScenePoint() {
      return { x: 0, y: 0 };
    }
    add() {}
    remove() {}
    setActiveObject() {}
    discardActiveObject() {}
    requestRenderAll() {}
    clear() {}
    dispose() {}
    toDataURL() {
      return 'data:image/png;base64,ABC';
    }
  }
  return {
    Canvas: FakeCanvas,
    Rect: class {},
    Circle: class {},
    Line: class {},
    FabricImage: { fromURL: vi.fn().mockResolvedValue({ width: 100, height: 100, set: vi.fn() }) },
  };
});

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
    for (const tool of ['Select', 'Line', 'Rectangle', 'Square', 'Circle']) {
      expect(screen.getByRole('button', { name: tool })).toBeInTheDocument();
    }
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

  it('disables the fill color picker until "Fill" is checked', async () => {
    const user = userEvent.setup();
    renderScreen();
    const fillCheckbox = screen.getByRole('checkbox', { name: 'Fill' });
    const colorInputs = document.querySelectorAll('input[type="color"]');
    const fillColorInput = colorInputs[1];
    expect(fillColorInput).toBeDisabled();

    await user.click(fillCheckbox);
    expect(fillColorInput).toBeEnabled();
  });

  it('clicking a thumbnail adds the image to the canvas without crashing', async () => {
    const user = userEvent.setup();
    renderScreen({ paintCategory: 'Animals' });
    await user.click(screen.getByAltText('tiger'));
    // No error thrown, and the mocked FabricImage.fromURL pipeline ran.
  });
});
