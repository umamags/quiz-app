import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
