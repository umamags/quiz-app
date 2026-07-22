import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LearnScreen from './LearnScreen.jsx';

// Deliberately out of alphabetical order, to prove the screen sorts these
// itself rather than relying on the manifest/items already being sorted.
const learnManifest = {
  categories: [
    { title: 'Dinosaurs', file: 'learn/dinosaurs.json' },
    { title: 'Animals', file: 'learn/animals.json' },
  ],
};

const learnItems = [
  {
    category: 'Animals',
    name: 'zebra',
    description: 'A striped horse-like animal.',
    images: ['images_downloaded/animals/zebra_1.jpg'],
    videos: [],
  },
  {
    category: 'Animals',
    name: 'dog',
    description: 'A loyal pet that barks.',
    images: ['images_downloaded/animals/dog_1.jpg'],
    videos: [
      { source: 'pexels', type: 'file', url: 'https://videos.pexels.com/dog.mp4', pageUrl: 'https://pexels.com/dog', durationSeconds: 9 },
      { source: 'mixkit', type: 'page', url: 'https://mixkit.co/dog', pageUrl: 'https://mixkit.co/dog', durationSeconds: null },
    ],
    audio_desc: 'audio/animals/dog.mp3',
  },
  {
    category: 'Animals',
    name: 'ant',
    description: 'A tiny, hardworking insect that lives in colonies.',
    images: ['images_downloaded/animals/ant_1.jpg'],
    videos: [],
  },
  {
    category: 'Dinosaurs',
    name: 'triceratops',
    description: 'A plant-eating dinosaur with three horns.',
    images: ['images_downloaded/dinosaurs/triceratops_1.jpg'],
    videos: [],
  },
];

beforeEach(() => {
  vi.stubGlobal('Audio', vi.fn().mockImplementation(function (src) {
    this.src = src;
    this.play = vi.fn();
  }));
});

function renderScreen(overrides = {}) {
  const dispatch = vi.fn();
  render(
    <LearnScreen
      learnManifest={learnManifest}
      learnManifestError={null}
      learnItems={learnItems}
      learnCategory={null}
      learnSearch=""
      dispatch={dispatch}
      {...overrides}
    />
  );
  return dispatch;
}

describe('LearnScreen', () => {
  it('shows a browse prompt instead of the full list until a category or search is chosen', () => {
    renderScreen();
    expect(screen.getByText('Choose a category above, or start typing to search.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Dog', level: 3 })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Triceratops', level: 3 })).not.toBeInTheDocument();
  });

  it('shows items across every category once a search term is entered, with no category selected', () => {
    // 'o' matches both fixture items by name (dog, triceratops)
    renderScreen({ learnSearch: 'o' });
    expect(screen.getByRole('heading', { name: 'Dog', level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Triceratops', level: 3 })).toBeInTheDocument();
  });

  it('shows a playable video for file-type entries and a link for page-type entries', () => {
    renderScreen({ learnCategory: 'Animals' });
    expect(document.querySelector('video.learn-video-player')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Watch on Mixkit ↗' })).toHaveAttribute('href', 'https://mixkit.co/dog');
  });

  it('debounces LEARN_SEARCH_CHANGED so it fires once typing settles, not on every keystroke', async () => {
    const user = userEvent.setup();
    const dispatch = renderScreen();
    const input = screen.getByPlaceholderText('Search by name or description...');
    await user.type(input, 'x');
    expect(dispatch).not.toHaveBeenCalledWith({ type: 'LEARN_SEARCH_CHANGED', query: 'x' });
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith({ type: 'LEARN_SEARCH_CHANGED', query: 'x' });
    });
  });

  it('dispatches LEARN_CATEGORY_SELECTED when a category chip is clicked', async () => {
    const user = userEvent.setup();
    const dispatch = renderScreen();
    await user.click(screen.getByRole('button', { name: 'Dinosaurs' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'LEARN_CATEGORY_SELECTED', category: 'Dinosaurs' });
  });

  it('only shows items in the selected category', () => {
    renderScreen({ learnCategory: 'Dinosaurs' });
    expect(screen.getByRole('heading', { name: 'Triceratops', level: 3 })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Dog', level: 3 })).not.toBeInTheDocument();
  });

  it('filters by search query against name and description, across all categories', () => {
    renderScreen({ learnSearch: 'horns' });
    expect(screen.getByRole('heading', { name: 'Triceratops', level: 3 })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Dog', level: 3 })).not.toBeInTheDocument();
  });

  it('shows a "no matches" hint when nothing matches', () => {
    renderScreen({ learnSearch: 'nonexistent' });
    expect(screen.getByText('No matches found.')).toBeInTheDocument();
  });

  it('lazy-loads card images so off-screen ones do not fetch immediately', () => {
    renderScreen({ learnCategory: 'Animals' });
    expect(screen.getByAltText('dog')).toHaveAttribute('loading', 'lazy');
  });

  it('shows the manifest error message instead of results, when present', () => {
    renderScreen({ learnManifestError: 'Could not load learn/manifest.json.' });
    expect(screen.getByText('Could not load learn/manifest.json.')).toBeInTheDocument();
    expect(screen.queryByText('Dog')).not.toBeInTheDocument();
  });

  it('shows a hint that clicking an image enlarges it', () => {
    renderScreen();
    expect(screen.getByText('Tip: clicking on an image enlarges it.')).toBeInTheDocument();
  });
});

describe('LearnScreen search clear button', () => {
  it('is disabled when the search box is empty', () => {
    renderScreen({ learnSearch: '' });
    expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled();
  });

  it('is enabled and clears the search when clicked', async () => {
    const user = userEvent.setup();
    const dispatch = renderScreen({ learnSearch: 'dog' });
    const clearButton = screen.getByRole('button', { name: 'Clear' });
    expect(clearButton).toBeEnabled();
    await user.click(clearButton);
    expect(dispatch).toHaveBeenCalledWith({ type: 'LEARN_SEARCH_CHANGED', query: '' });
  });
});

describe('LearnScreen alphabetical sorting', () => {
  it('sorts category chips alphabetically regardless of manifest order', () => {
    renderScreen();
    const chipRow = document.querySelector('.category-chip-row');
    const labels = within(chipRow).getAllByRole('button').map(btn => btn.textContent);
    expect(labels).toEqual(['All', 'Animals', 'Dinosaurs']);
  });

  it('sorts item names alphabetically within a group, regardless of source order', () => {
    renderScreen({ learnCategory: 'Animals' });
    const titles = screen.getAllByRole('heading', { level: 3 }).map(h => h.textContent);
    expect(titles).toEqual(['Ant', 'Dog', 'Zebra']);
  });

  it('sorts the per-group jump links alphabetically too', () => {
    renderScreen({ learnCategory: 'Animals' });
    const jumpRow = document.querySelector('.learn-jump-row');
    const labels = within(jumpRow).getAllByRole('link').map(a => a.textContent);
    expect(labels).toEqual(['Ant', 'Dog', 'Zebra']);
  });
});

describe('LearnScreen per-group jump links', () => {
  it('lists a jump link for every item in each visible category group', () => {
    renderScreen({ learnSearch: 'o' });
    const animalsGroup = screen.getByRole('heading', { name: 'Animals', level: 2 }).closest('.learn-group');
    expect(within(animalsGroup).getByRole('link', { name: 'Dog' })).toBeInTheDocument();

    const dinosaursGroup = screen.getByRole('heading', { name: 'Dinosaurs', level: 2 }).closest('.learn-group');
    expect(within(dinosaursGroup).getByRole('link', { name: 'Triceratops' })).toBeInTheDocument();
  });

  it('a jump link points at its card via a matching #anchor id', () => {
    renderScreen({ learnSearch: 'o' });
    const link = screen.getByRole('link', { name: 'Dog' });
    const href = link.getAttribute('href');
    expect(href).toMatch(/^#/);
    const card = document.querySelector(href);
    expect(card).toHaveClass('learn-card');
    expect(within(card).getByRole('heading', { name: 'Dog', level: 3 })).toBeInTheDocument();
  });

  it('only lists jump links for categories present in the filtered results', () => {
    renderScreen({ learnCategory: 'Dinosaurs' });
    expect(screen.queryByRole('heading', { name: 'Animals', level: 2 })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dinosaurs', level: 2 })).toBeInTheDocument();
  });
});

describe('LearnScreen back to top link', () => {
  it('renders a "Back to top" link next to each item name, pointing at the top of the page', () => {
    renderScreen({ learnCategory: 'Dinosaurs' }); // single item (triceratops) -> exactly one link
    const links = screen.getAllByRole('link', { name: 'Back to top' });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', '#learn-top');
  });

  it('the target of "Back to top" exists at the top of the screen', () => {
    renderScreen({ learnSearch: 'o' });
    expect(document.getElementById('learn-top')).toHaveClass('learn-screen');
  });
});

describe('LearnScreen sound icon', () => {
  it('shows a sound icon for an item with audio_desc, and plays that file when clicked', async () => {
    const user = userEvent.setup();
    renderScreen({ learnCategory: 'Animals' });

    const button = screen.getByRole('button', { name: 'Play audio for dog' });
    await user.click(button);

    expect(Audio).toHaveBeenCalledWith('audio/animals/dog.mp3');
    const instance = Audio.mock.results[0].value;
    expect(instance.play).toHaveBeenCalled();
  });

  it('does not show a sound icon for an item with no audio_desc', () => {
    renderScreen({ learnCategory: 'Dinosaurs' });
    expect(screen.queryByRole('button', { name: /Play audio for/ })).not.toBeInTheDocument();
  });
});

describe('LearnScreen image lightbox', () => {
  it('opens a blown-up version of an image when it is clicked', async () => {
    const user = userEvent.setup();
    renderScreen({ learnCategory: 'Animals' });
    expect(document.querySelector('.lightbox-overlay')).not.toBeInTheDocument();

    await user.click(screen.getByAltText('dog'));

    const lightboxImage = document.querySelector('.lightbox-image');
    expect(lightboxImage).toBeInTheDocument();
    expect(lightboxImage).toHaveAttribute('src', 'images_downloaded/animals/dog_1.jpg');
  });

  it('closes the lightbox via the close button, the overlay, or Escape', async () => {
    const user = userEvent.setup();
    renderScreen({ learnCategory: 'Animals' });

    await user.click(screen.getByAltText('dog'));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(document.querySelector('.lightbox-overlay')).not.toBeInTheDocument();

    await user.click(screen.getByAltText('dog'));
    await user.click(document.querySelector('.lightbox-overlay'));
    expect(document.querySelector('.lightbox-overlay')).not.toBeInTheDocument();

    await user.click(screen.getByAltText('dog'));
    await user.keyboard('{Escape}');
    expect(document.querySelector('.lightbox-overlay')).not.toBeInTheDocument();
  });

  it('clicking the enlarged image itself does not close the lightbox', async () => {
    const user = userEvent.setup();
    renderScreen({ learnCategory: 'Animals' });

    await user.click(screen.getByAltText('dog'));
    await user.click(document.querySelector('.lightbox-image'));
    expect(document.querySelector('.lightbox-overlay')).toBeInTheDocument();
  });
});
