// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ActionButton } from '../poker/molecules/ActionButton';

// Mock motion/react to render plain elements (avoids JSDOM animation issues)
vi.mock('motion/react', () => ({
  motion: {
    button: ({ children, animate, transition, whileTap, layoutId, ...props }: any) => (
      <button {...props}>{children}</button>
    ),
    div: ({ children, animate, transition, layoutId, ...props }: any) => (
      <div {...props}>{children}</div>
    ),
    span: ({ children, animate, transition, layoutId, ...props }: any) => (
      <span {...props}>{children}</span>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

afterEach(() => cleanup());

describe('ActionButton', () => {
  describe('rendering states', () => {
    it('renders label text', () => {
      render(<ActionButton actionId="FOLD" label="Fold" state="idle" />);
      expect(screen.getByText('Fold')).toBeDefined();
    });

    it('is clickable when idle', () => {
      const onClick = vi.fn();
      render(<ActionButton actionId="FOLD" label="Fold" state="idle" onClick={onClick} />);

      const buttons = screen.getAllByRole('button');
      // The motion.button is the main interactive button
      const mainButton = buttons.find(b => !b.disabled);
      fireEvent.click(mainButton!);
      expect(onClick).toHaveBeenCalledOnce();
    });

    it('is disabled when state is disabled', () => {
      const onClick = vi.fn();
      render(<ActionButton actionId="FOLD" label="Fold" state="disabled" onClick={onClick} />);

      const buttons = screen.getAllByRole('button');
      const disabledButton = buttons.find(b => b.hasAttribute('disabled'));
      expect(disabledButton).toBeDefined();
      fireEvent.click(disabledButton!);
      expect(onClick).not.toHaveBeenCalled();
    });

    it('is disabled when revealed-correct', () => {
      render(
        <ActionButton actionId="CALL" label="Call" state="revealed-correct" />
      );
      const buttons = screen.getAllByRole('button');
      const disabled = buttons.filter(b => b.hasAttribute('disabled'));
      expect(disabled.length).toBeGreaterThan(0);
    });

    it('is disabled when revealed-incorrect', () => {
      render(
        <ActionButton actionId="RAISE" label="Raise" state="revealed-incorrect" />
      );
      const buttons = screen.getAllByRole('button');
      const disabled = buttons.filter(b => b.hasAttribute('disabled'));
      expect(disabled.length).toBeGreaterThan(0);
    });
  });

  describe('EV display', () => {
    it('does not show EV when idle', () => {
      render(<ActionButton actionId="FOLD" label="Fold" state="idle" ev={1.5} />);
      expect(screen.queryByText(/BB/)).toBeNull();
    });

    it('shows positive EV after reveal', () => {
      render(
        <ActionButton actionId="CALL" label="Call" state="revealed-correct" ev={2.35} />
      );
      expect(screen.getByText('+2.35 BB')).toBeDefined();
    });

    it('shows negative EV after reveal', () => {
      render(
        <ActionButton actionId="FOLD" label="Fold" state="revealed-incorrect" ev={-1.2} />
      );
      expect(screen.getByText('-1.20 BB')).toBeDefined();
    });

    it('shows zero EV without + prefix', () => {
      render(
        <ActionButton actionId="CHECK" label="Check" state="revealed-correct" ev={0} />
      );
      expect(screen.getByText('0.00 BB')).toBeDefined();
    });
  });

  describe('frequency bar', () => {
    it('does not show frequency bar when not revealed', () => {
      render(<ActionButton actionId="FOLD" label="Fold" state="idle" frequency={0.65} />);
      expect(screen.queryByText('65%')).toBeNull();
    });

    it('shows frequency bar when revealed with frequency', () => {
      render(
        <ActionButton actionId="CALL" label="Call" state="revealed-correct" frequency={0.75} />
      );
      expect(screen.getByText('75%')).toBeDefined();
    });

    it('does not show frequency bar when revealed without frequency', () => {
      render(
        <ActionButton actionId="CALL" label="Call" state="revealed-correct" />
      );
      expect(screen.queryByText(/%/)).toBeNull();
    });

    it('formats frequency as integer percentage', () => {
      render(
        <ActionButton actionId="RAISE" label="Raise" state="revealed-incorrect" frequency={0.333} />
      );
      expect(screen.getByText('33%')).toBeDefined();
    });
  });
});
