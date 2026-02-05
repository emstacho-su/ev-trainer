// src/lib/solver/abstraction/cards.test.ts
import { describe, it, expect } from 'vitest';
import {
  CANONICAL_HANDS,
  canonicalizePreflop,
  buildPreflopAbstraction,
  getAllCombosForCanonical,
  getCanonicalCategory,
  generateAllHands,
  getBucketId,
} from './cards';
import type { Hand, CanonicalHand } from '../types';

describe('CANONICAL_HANDS', () => {
  it('contains exactly 169 hands', () => {
    expect(CANONICAL_HANDS.length).toBe(169);
  });

  it('contains all 13 pairs', () => {
    const pairs = ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22'];
    for (const pair of pairs) {
      expect(CANONICAL_HANDS).toContain(pair);
    }
  });

  it('contains suited hands', () => {
    expect(CANONICAL_HANDS).toContain('AKs');
    expect(CANONICAL_HANDS).toContain('AQs');
    expect(CANONICAL_HANDS).toContain('72s');
    expect(CANONICAL_HANDS).toContain('32s');
  });

  it('contains offsuit hands', () => {
    expect(CANONICAL_HANDS).toContain('AKo');
    expect(CANONICAL_HANDS).toContain('AQo');
    expect(CANONICAL_HANDS).toContain('72o');
    expect(CANONICAL_HANDS).toContain('32o');
  });

  it('has no duplicates', () => {
    const unique = new Set(CANONICAL_HANDS);
    expect(unique.size).toBe(CANONICAL_HANDS.length);
  });

  it('has pairs first', () => {
    // First 13 should be pairs (AA through 22)
    expect(CANONICAL_HANDS[0]).toBe('AA');
    expect(CANONICAL_HANDS[1]).toBe('KK');
    expect(CANONICAL_HANDS[12]).toBe('22');
  });
});

describe('canonicalizePreflop', () => {
  describe('suited hands', () => {
    it('canonicalizes hearts suited to AKs', () => {
      expect(canonicalizePreflop('Ah', 'Kh')).toBe('AKs');
    });

    it('canonicalizes spades suited to AKs (isomorphism)', () => {
      expect(canonicalizePreflop('As', 'Ks')).toBe('AKs');
    });

    it('canonicalizes diamonds suited to AKs (isomorphism)', () => {
      expect(canonicalizePreflop('Ad', 'Kd')).toBe('AKs');
    });

    it('canonicalizes clubs suited to AKs (isomorphism)', () => {
      expect(canonicalizePreflop('Ac', 'Kc')).toBe('AKs');
    });

    it('normalizes card order (K then A)', () => {
      expect(canonicalizePreflop('Kh', 'Ah')).toBe('AKs');
    });

    it('handles low suited hands', () => {
      expect(canonicalizePreflop('7h', '2h')).toBe('72s');
      expect(canonicalizePreflop('2s', '7s')).toBe('72s');
    });
  });

  describe('offsuit hands', () => {
    it('canonicalizes to AKo', () => {
      expect(canonicalizePreflop('Ah', 'Kd')).toBe('AKo');
    });

    it('canonicalizes different suit combos to same AKo', () => {
      expect(canonicalizePreflop('As', 'Kc')).toBe('AKo');
      expect(canonicalizePreflop('Ad', 'Kh')).toBe('AKo');
    });

    it('normalizes card order', () => {
      expect(canonicalizePreflop('Kd', 'Ah')).toBe('AKo');
    });

    it('handles low offsuit hands', () => {
      expect(canonicalizePreflop('7h', '2d')).toBe('72o');
    });
  });

  describe('pairs', () => {
    it('canonicalizes aces to AA', () => {
      expect(canonicalizePreflop('Ah', 'Ad')).toBe('AA');
    });

    it('canonicalizes different ace combos to AA', () => {
      expect(canonicalizePreflop('As', 'Ac')).toBe('AA');
      expect(canonicalizePreflop('Ah', 'As')).toBe('AA');
    });

    it('canonicalizes kings to KK', () => {
      expect(canonicalizePreflop('Kh', 'Kd')).toBe('KK');
    });

    it('canonicalizes deuces to 22', () => {
      expect(canonicalizePreflop('2h', '2c')).toBe('22');
    });
  });
});

describe('buildPreflopAbstraction', () => {
  it('returns a map with 169 entries', () => {
    const abstraction = buildPreflopAbstraction();
    expect(abstraction.size).toBe(169);
  });

  it('maps hands to sequential bucket IDs', () => {
    const abstraction = buildPreflopAbstraction();
    expect(abstraction.get('AA')).toBe(0);
    expect(abstraction.get('KK')).toBe(1);
    expect(abstraction.get('22')).toBe(12);
  });

  it('maps all canonical hands to valid IDs', () => {
    const abstraction = buildPreflopAbstraction();
    for (const hand of CANONICAL_HANDS) {
      const id = abstraction.get(hand);
      expect(id).toBeDefined();
      expect(id).toBeGreaterThanOrEqual(0);
      expect(id).toBeLessThan(169);
    }
  });
});

describe('getAllCombosForCanonical', () => {
  it('returns 6 combos for pairs', () => {
    const aaCombos = getAllCombosForCanonical('AA');
    expect(aaCombos.length).toBe(6);

    // Verify they're all AA hands
    for (const combo of aaCombos) {
      expect(combo[0][0]).toBe('A');
      expect(combo[1][0]).toBe('A');
      expect(combo[0][1]).not.toBe(combo[1][1]); // Different suits
    }
  });

  it('returns 4 combos for suited hands', () => {
    const aksCombos = getAllCombosForCanonical('AKs');
    expect(aksCombos.length).toBe(4);

    // Verify they're all AK suited
    for (const combo of aksCombos) {
      const ranks = [combo[0][0], combo[1][0]].sort();
      expect(ranks).toEqual(['A', 'K']);
      expect(combo[0][1]).toBe(combo[1][1]); // Same suit
    }
  });

  it('returns 12 combos for offsuit hands', () => {
    const akoCombos = getAllCombosForCanonical('AKo');
    expect(akoCombos.length).toBe(12);

    // Verify they're all AK offsuit
    for (const combo of akoCombos) {
      const ranks = [combo[0][0], combo[1][0]].sort();
      expect(ranks).toEqual(['A', 'K']);
      expect(combo[0][1]).not.toBe(combo[1][1]); // Different suits
    }
  });

  it('returns correct combos for low hands', () => {
    const combo72s = getAllCombosForCanonical('72s');
    expect(combo72s.length).toBe(4);

    const combo72o = getAllCombosForCanonical('72o');
    expect(combo72o.length).toBe(12);

    const combo22 = getAllCombosForCanonical('22');
    expect(combo22.length).toBe(6);
  });
});

describe('getCanonicalCategory', () => {
  it('identifies pairs', () => {
    expect(getCanonicalCategory('AA')).toBe('pair');
    expect(getCanonicalCategory('KK')).toBe('pair');
    expect(getCanonicalCategory('22')).toBe('pair');
  });

  it('identifies suited hands', () => {
    expect(getCanonicalCategory('AKs')).toBe('suited');
    expect(getCanonicalCategory('72s')).toBe('suited');
  });

  it('identifies offsuit hands', () => {
    expect(getCanonicalCategory('AKo')).toBe('offsuit');
    expect(getCanonicalCategory('72o')).toBe('offsuit');
  });
});

describe('generateAllHands', () => {
  it('generates exactly 1326 hands', () => {
    const allHands = generateAllHands();
    expect(allHands.length).toBe(1326);
  });

  it('generates unique hands', () => {
    const allHands = generateAllHands();
    const handStrings = allHands.map(h => h.sort().join('-'));
    const unique = new Set(handStrings);
    expect(unique.size).toBe(1326);
  });
});

describe('complete abstraction mapping', () => {
  it('maps all 1326 hands to exactly 169 buckets', () => {
    const allHands = generateAllHands();
    const buckets = new Map<CanonicalHand, number>();

    for (const hand of allHands) {
      const canonical = canonicalizePreflop(hand[0], hand[1]);
      buckets.set(canonical, (buckets.get(canonical) || 0) + 1);
    }

    // Should have exactly 169 unique canonical hands
    expect(buckets.size).toBe(169);

    // Verify combo counts per bucket
    for (const [canonical, count] of buckets) {
      const category = getCanonicalCategory(canonical);
      if (category === 'pair') {
        expect(count).toBe(6);
      } else if (category === 'suited') {
        expect(count).toBe(4);
      } else {
        expect(count).toBe(12);
      }
    }
  });

  it('total combos sum to 1326', () => {
    // 13 pairs * 6 = 78
    // 78 suited * 4 = 312
    // 78 offsuit * 12 = 936
    // Total: 78 + 312 + 936 = 1326
    let total = 0;
    for (const canonical of CANONICAL_HANDS) {
      total += getAllCombosForCanonical(canonical).length;
    }
    expect(total).toBe(1326);
  });
});

describe('getBucketId', () => {
  it('returns correct bucket IDs', () => {
    expect(getBucketId('Ah', 'Ad')).toBe(0); // AA is first
    expect(getBucketId('Kh', 'Kd')).toBe(1); // KK is second
  });

  it('returns same ID for isomorphic hands', () => {
    // All AK suited should map to same bucket
    const id1 = getBucketId('Ah', 'Kh');
    const id2 = getBucketId('As', 'Ks');
    const id3 = getBucketId('Ad', 'Kd');
    const id4 = getBucketId('Ac', 'Kc');

    expect(id1).toBe(id2);
    expect(id2).toBe(id3);
    expect(id3).toBe(id4);
  });

  it('returns different IDs for suited vs offsuit', () => {
    const suitedId = getBucketId('Ah', 'Kh');
    const offsuitId = getBucketId('Ah', 'Kd');

    expect(suitedId).not.toBe(offsuitId);
  });
});
