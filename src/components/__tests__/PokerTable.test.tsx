// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PokerTable } from '../poker/organisms/PokerTable';

// Mock motion/react for JSDOM compatibility
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, layoutId, layout, initial, animate, exit, transition, ...props }: any) => (
      <div data-layout-id={layoutId} {...props}>{children}</div>
    ),
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

afterEach(() => cleanup());

function make6MaxPlayers() {
  return [
    { position: 'BB' as const, stackBB: 100, isActive: true, isFolded: false, isHero: true, showCards: true, cards: [{ rank: 'A', suit: 'h' as const }, { rank: 'K', suit: 's' as const }] },
    { position: 'SB' as const, stackBB: 98, isActive: false, isFolded: false },
    { position: 'BTN' as const, stackBB: 95, isActive: false, isFolded: false },
    { position: 'CO' as const, stackBB: 100, isActive: false, isFolded: true },
    { position: 'HJ' as const, stackBB: 100, isActive: false, isFolded: false },
    { position: 'UTG' as const, stackBB: 100, isActive: false, isFolded: false },
  ];
}

function make9MaxPlayers() {
  return [
    { position: 'BB' as const, stackBB: 100, isActive: true, isFolded: false, isHero: true },
    { position: 'SB' as const, stackBB: 98, isActive: false, isFolded: false },
    { position: 'BTN' as const, stackBB: 95, isActive: false, isFolded: false },
    { position: 'CO' as const, stackBB: 100, isActive: false, isFolded: false },
    { position: 'HJ' as const, stackBB: 100, isActive: false, isFolded: false },
    { position: 'MP' as const, stackBB: 100, isActive: false, isFolded: false },
    { position: 'UTG+2' as const, stackBB: 100, isActive: false, isFolded: false },
    { position: 'UTG+1' as const, stackBB: 100, isActive: false, isFolded: false },
    { position: 'UTG' as const, stackBB: 100, isActive: false, isFolded: false },
  ];
}

describe('PokerTable', () => {
  describe('6-max table', () => {
    it('renders all 6 player position labels', () => {
      const { container } = render(
        <PokerTable
          players={make6MaxPlayers()}
          communityCards={[]}
          pot={3.5}
          dealerPosition="BTN"
          tableSize="6max"
        />
      );
      // Positions appear as text in PlayerSeat
      for (const pos of ['BB', 'SB', 'BTN', 'CO', 'HJ', 'UTG']) {
        expect(screen.getAllByText(pos).length).toBeGreaterThan(0);
      }
    });

    it('displays pot amount with BB suffix', () => {
      render(
        <PokerTable
          players={make6MaxPlayers()}
          communityCards={[]}
          pot={7.5}
          dealerPosition="BTN"
        />
      );
      // PotDisplay renders "7.5 BB"
      expect(screen.getByText('7.5 BB')).toBeDefined();
    });

    it('displays pot type label', () => {
      render(
        <PokerTable
          players={make6MaxPlayers()}
          communityCards={[]}
          pot={12}
          potType="3BP"
          dealerPosition="BTN"
        />
      );
      expect(screen.getByText('3BP')).toBeDefined();
    });

    it('does not display pot type when omitted', () => {
      render(
        <PokerTable
          players={make6MaxPlayers()}
          communityCards={[]}
          pot={3}
          dealerPosition="BTN"
        />
      );
      expect(screen.queryByText('SRP')).toBeNull();
      expect(screen.queryByText('3BP')).toBeNull();
      expect(screen.queryByText('4BP')).toBeNull();
    });

    it('renders dealer button', () => {
      const { container } = render(
        <PokerTable
          players={make6MaxPlayers()}
          communityCards={[]}
          pot={3}
          dealerPosition="BTN"
        />
      );
      const dealerBtn = container.querySelector('[data-layout-id="dealer-button"]');
      expect(dealerBtn).not.toBeNull();
    });
  });

  describe('9-max table', () => {
    it('renders all 9 player position labels', () => {
      render(
        <PokerTable
          players={make9MaxPlayers()}
          communityCards={[]}
          pot={3.5}
          dealerPosition="BTN"
          tableSize="9max"
        />
      );
      for (const pos of ['BB', 'SB', 'BTN', 'CO', 'HJ', 'MP', 'UTG+2', 'UTG+1', 'UTG']) {
        expect(screen.getAllByText(pos).length).toBeGreaterThan(0);
      }
    });
  });

  describe('bet chips', () => {
    it('renders bet chip amounts for players with bets', () => {
      const players = make6MaxPlayers();
      players[0].bet = 3;
      players[1].bet = 1.5;

      render(
        <PokerTable
          players={players}
          communityCards={[]}
          pot={4.5}
          dealerPosition="BTN"
        />
      );
      // Chip component renders "X BB"
      expect(screen.getByText('3 BB')).toBeDefined();
      expect(screen.getByText('1.5 BB')).toBeDefined();
    });

    it('does not render chips for zero bets', () => {
      const players = make6MaxPlayers();
      // Explicitly set bet to 0 on all players
      players.forEach(p => { p.bet = 0; });

      render(
        <PokerTable
          players={players}
          communityCards={[]}
          pot={3}
          dealerPosition="BTN"
        />
      );
      // Should not find any "X BB" chip text (pot display has its own format)
      expect(screen.queryByText('0 BB')).toBeNull();
    });
  });

  describe('hero seat', () => {
    it('renders hero stack with blue styling', () => {
      const { container } = render(
        <PokerTable
          players={make6MaxPlayers()}
          communityCards={[]}
          pot={3}
          dealerPosition="BTN"
          heroPosition="BB"
        />
      );
      // Hero seat has blue background class
      const heroSeat = container.querySelector('.bg-blue-600');
      expect(heroSeat).not.toBeNull();
    });
  });
});
