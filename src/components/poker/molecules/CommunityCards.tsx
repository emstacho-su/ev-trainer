import { cn } from '@/lib/utils';
import { Card } from '../atoms/Card';

interface CommunityCardsProps {
  cards: Array<{ rank: string; suit: 'h' | 'd' | 'c' | 's' }>;
  className?: string;
}

export function CommunityCards({ cards, className }: CommunityCardsProps) {
  if (cards.length === 0) return null;

  return (
    <div className={cn('flex gap-2', className)}>
      {cards.map((card, i) => (
        <Card key={i} rank={card.rank} suit={card.suit} size="md" />
      ))}
    </div>
  );
}
