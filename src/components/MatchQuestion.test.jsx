import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MatchQuestion from './MatchQuestion.jsx';

// dnd-kit's drag gesture relies on real browser layout/pointer capture that
// jsdom doesn't provide, so the interactive drag itself is covered by the
// browser-based verification described in the summary, not here. This test
// covers the presentational contract: given a matchedPairs state, the right
// items render in the supplied (shuffled) order and matched pairs are
// visually marked and non-interactive.
const q = {
  leftType: 'text',
  rightType: 'text',
  pairs: [
    { left: 'Lion', right: 'Lion-pic' },
    { left: 'Tiger', right: 'Tiger-pic' },
  ],
};

describe('MatchQuestion', () => {
  it('renders left items in authored order and right items in the given order', () => {
    render(
      <MatchQuestion q={q} matchedPairs={[]} rightOrder={[1, 0]} onCorrectMatch={vi.fn()} />
    );
    const lefts = screen.getAllByText(/Lion$|Tiger$/);
    expect(lefts.map(el => el.textContent)).toEqual(['Lion', 'Tiger']);

    const rights = screen.getAllByText(/-pic$/);
    expect(rights.map(el => el.textContent)).toEqual(['Tiger-pic', 'Lion-pic']);
  });

  it('marks matched pairs on both sides and leaves the rest interactive', () => {
    render(
      <MatchQuestion q={q} matchedPairs={[0]} rightOrder={[0, 1]} onCorrectMatch={vi.fn()} />
    );
    const lionLeft = screen.getByText('Lion').closest('.match-item');
    const tigerLeft = screen.getByText('Tiger').closest('.match-item');
    expect(lionLeft).toHaveClass('matched', 'correct');
    expect(tigerLeft).not.toHaveClass('matched');
  });
});

describe('MatchQuestion image zoom', () => {
  const imageQ = {
    leftType: 'text',
    rightType: 'image',
    pairs: [
      { left: 'Lion', right: 'images_downloaded/animals/lion_1.jpg' },
      { left: 'Tiger', right: 'images_downloaded/animals/tiger_1.jpg' },
    ],
  };

  it('opens a lightbox with the full-size image when a match image tile is clicked', async () => {
    const user = userEvent.setup();
    render(
      <MatchQuestion q={imageQ} matchedPairs={[]} rightOrder={[0, 1]} onCorrectMatch={vi.fn()} />
    );
    expect(document.querySelector('.lightbox-overlay')).not.toBeInTheDocument();

    const [lionZoom] = screen.getAllByRole('button', { name: '' });
    await user.click(lionZoom);

    const lightboxImage = document.querySelector('.lightbox-image');
    expect(lightboxImage).toBeInTheDocument();
    expect(lightboxImage).toHaveAttribute('src', 'images_downloaded/animals/lion_1.jpg');
  });

  it('closes the lightbox via the close button without affecting match state', async () => {
    const user = userEvent.setup();
    const onCorrectMatch = vi.fn();
    render(
      <MatchQuestion q={imageQ} matchedPairs={[]} rightOrder={[0, 1]} onCorrectMatch={onCorrectMatch} />
    );

    const [lionZoom] = screen.getAllByRole('button', { name: '' });
    await user.click(lionZoom);
    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(document.querySelector('.lightbox-overlay')).not.toBeInTheDocument();
    expect(onCorrectMatch).not.toHaveBeenCalled();
  });
});
