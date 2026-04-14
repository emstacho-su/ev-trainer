// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { RangeGridView } from '../range/RangeGridView';
import type { RangeData } from '@/lib/range/types';

afterEach(() => cleanup());

function makeRange(hands: Array<{ hand: string; actions: Array<{ type: string; frequency: number }> }>): RangeData {
  return {
    hands: hands as RangeData['hands'],
    totalCombos: hands.length,
  };
}

describe('RangeGridView', () => {
  const sampleRange = makeRange([
    { hand: 'AA', actions: [{ type: 'raise', frequency: 1.0 }] },
    { hand: 'AKs', actions: [{ type: 'raise', frequency: 0.85 }, { type: 'call', frequency: 0.15 }] },
    { hand: 'AKo', actions: [{ type: 'call', frequency: 0.6 }, { type: 'fold', frequency: 0.4 }] },
    { hand: '72o', actions: [{ type: 'fold', frequency: 1.0 }] },
  ]);

  it('renders 169 cells (13x13 grid)', () => {
    render(<RangeGridView range={sampleRange} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBe(169);
  });

  it('renders title when provided', () => {
    render(<RangeGridView range={sampleRange} title="Hero Range" />);
    expect(screen.getByText('Hero Range')).toBeDefined();
  });

  it('does not render title when omitted', () => {
    const emptyRange = makeRange([]);
    render(<RangeGridView range={emptyRange} />);
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('renders correct hand labels in cells', () => {
    render(<RangeGridView range={sampleRange} />);
    // Use getAllByText since the hand appears in both text and aria-label
    expect(screen.getAllByText('AA').length).toBeGreaterThan(0);
    expect(screen.getAllByText('22').length).toBeGreaterThan(0);
    expect(screen.getAllByText('AKs').length).toBeGreaterThan(0);
    expect(screen.getAllByText('AKo').length).toBeGreaterThan(0);
  });

  it('calls onHandClick with correct hand', () => {
    const onClick = vi.fn();
    render(<RangeGridView range={sampleRange} onHandClick={onClick} />);

    // Use getAllByText and click the first match (the button)
    const aaElements = screen.getAllByText('AA');
    // The button is the ancestor, find the closest button parent
    const aaButton = aaElements[0].closest('button');
    fireEvent.click(aaButton!);
    expect(onClick).toHaveBeenCalledWith('AA');
  });

  it('calls onHandHover on enter/leave', () => {
    const onHover = vi.fn();
    render(<RangeGridView range={sampleRange} onHandHover={onHover} />);

    const aaElements = screen.getAllByText('AA');
    const aaButton = aaElements[0].closest('button');
    fireEvent.mouseEnter(aaButton!);
    expect(onHover).toHaveBeenCalledWith('AA');

    fireEvent.mouseLeave(aaButton!);
    expect(onHover).toHaveBeenCalledWith(null);
  });

  it('renders action bars for hands with actions', () => {
    render(<RangeGridView range={sampleRange} />);
    // AA has raise action - the bar should have a title attribute
    const raiseBar = screen.getByTitle('RAISE 100.0%');
    expect(raiseBar).toBeDefined();
  });

  it('cells without actions have gray bg and no action bars', () => {
    render(<RangeGridView range={sampleRange} />);
    // 32o has no actions — its aria-label should just be "32o" (no action description)
    const button32o = screen.getByRole('button', { name: '32o' });
    expect(button32o).toBeDefined();
    // It shouldn't have action bar titles
    expect(button32o.querySelector('[title]')).toBeNull();
  });
});
