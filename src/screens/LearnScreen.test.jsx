import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LearnScreen from './LearnScreen.jsx';

const learnManifest = {
  categories: [
    { title: 'Animals', file: 'learn/animals.json' },
    { title: 'Dinosaurs', file: 'learn/dinosaurs.json' },
  ],
};

const learnItems = [
  {
    category: 'Animals',
    name: 'dog',
    description: 'A loyal pet that barks.',
    images: ['images_downloaded/animals/dog_1.jpg'],
    videos: [
      { source: 'pexels', type: 'file', url: 'https://videos.pexels.com/dog.mp4', pageUrl: 'https://pexels.com/dog', durationSeconds: 9 },
      { source: 'mixkit', type: 'page', url: 'https://mixkit.co/dog', pageUrl: 'https://mixkit.co/dog', durationSeconds: null },
    ],
  },
  {
    category: 'Dinosaurs',
    name: 'triceratops',
    description: 'A plant-eating dinosaur with three horns.',
    images: ['images_downloaded/dinosaurs/triceratops_1.jpg'],
    videos: [],
  },
];

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
  it('renders every item across all categories by default', () => {
    renderScreen();
    expect(screen.getByText('Dog')).toBeInTheDocument();
    expect(screen.getByText('Triceratops')).toBeInTheDocument();
  });

  it('shows a playable video for file-type entries and a link for page-type entries', () => {
    renderScreen();
    expect(document.querySelector('video.learn-video-player')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Watch on Mixkit ↗' })).toHaveAttribute('href', 'https://mixkit.co/dog');
  });

  it('dispatches LEARN_SEARCH_CHANGED as the user types in the search box', async () => {
    const user = userEvent.setup();
    const dispatch = renderScreen();
    await user.type(screen.getByPlaceholderText('Search by name or description...'), 'x');
    expect(dispatch).toHaveBeenCalledWith({ type: 'LEARN_SEARCH_CHANGED', query: 'x' });
  });

  it('dispatches LEARN_CATEGORY_SELECTED when a category chip is clicked', async () => {
    const user = userEvent.setup();
    const dispatch = renderScreen();
    await user.click(screen.getByRole('button', { name: 'Dinosaurs' }));
    expect(dispatch).toHaveBeenCalledWith({ type: 'LEARN_CATEGORY_SELECTED', category: 'Dinosaurs' });
  });

  it('only shows items in the selected category', () => {
    renderScreen({ learnCategory: 'Dinosaurs' });
    expect(screen.getByText('Triceratops')).toBeInTheDocument();
    expect(screen.queryByText('Dog')).not.toBeInTheDocument();
  });

  it('filters by search query against name and description, across all categories', () => {
    renderScreen({ learnSearch: 'horns' });
    expect(screen.getByText('Triceratops')).toBeInTheDocument();
    expect(screen.queryByText('Dog')).not.toBeInTheDocument();
  });

  it('shows a "no matches" hint when nothing matches', () => {
    renderScreen({ learnSearch: 'nonexistent' });
    expect(screen.getByText('No matches found.')).toBeInTheDocument();
  });

  it('shows the manifest error message instead of results, when present', () => {
    renderScreen({ learnManifestError: 'Could not load learn/manifest.json.' });
    expect(screen.getByText('Could not load learn/manifest.json.')).toBeInTheDocument();
    expect(screen.queryByText('Dog')).not.toBeInTheDocument();
  });
});
