'use client';

/**
 * Training page at /training.
 *
 * State machine:
 *   Page load -> CONFIGURING (dialog open, table visible but empty behind backdrop)
 *   Start Training -> TRAINING (dialog closes, session active)
 *   Gear icon -> CONFIGURING (dialog reopens with locked fields, session paused visually)
 *   Session complete -> redirect to /summary/[id]
 *
 * Combines the session page training loop (submit/reveal/next) with the
 * TrainingConfigDialog overlay. No route change on session start.
 */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { PokerTable } from '@/components/poker/organisms/PokerTable';
import { ActionPanel } from '@/components/poker/organisms/ActionPanel';
import { TrainingConfigDialog } from '@/components/config/TrainingConfigDialog';
import { useTrainerConfig } from '@/lib/v2/hooks/useTrainerConfig';
import type { Spot } from '@/lib/engine/spot';
import type { ActionId, Position } from '@/lib/engine/types';
import type { DecisionGrade } from '@/lib/engine/trainingOrchestrator';
import { getAvailableActions } from '@/lib/engine/availableActions';
import { createSeededRng, combineSeed } from '@/lib/engine/rng';
import type { SessionSnapshot } from '@/lib/v2/api/sessionHandlers';
import {
  SessionApiError,
  submitAction,
  nextDecision,
} from '@/lib/v2/api-client/sessionClient';
import {
  consumeStorageWarning,
  updateSessionRecord,
  writeSessionRecord,
} from '@/lib/v2/storage/sessionStorage';
import type { RangeData } from '@/lib/range/types';
import { getHandAtPosition } from '@/lib/range/gridLayout';
import { RangeGridModal } from '@/components/range';

// ---------- Spot -> PokerTable conversion ----------

interface Player {
  position: 'BTN' | 'SB' | 'BB' | 'UTG' | 'HJ' | 'CO' | 'UTG+1' | 'MP' | 'UTG+2';
  stackBB: number;
  cards?: Array<{ rank: string; suit: 'h' | 'd' | 'c' | 's' }>;
  bet?: number;
  isActive: boolean;
  isFolded: boolean;
  isHero?: boolean;
  showCards?: boolean;
  actionLabel?: string;
}

const PREFLOP_ORDER = ['UTG', 'UTG+1', 'UTG+2', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB'] as const;

function parseHistoryActions(spot: Spot): Map<string, { actionId: string; betBb: number }> {
  const actingOrder = PREFLOP_ORDER.filter(
    p => spot.positions.includes(p as Position) && p !== spot.heroToAct
  );

  const result = new Map<string, { actionId: string; betBb: number }>();
  const folded = new Set<string>();
  const bets = new Map<string, number>();
  const isPreflop = spot.board.length === 0;

  for (const pos of spot.positions) {
    if (isPreflop && pos === 'SB') bets.set(pos, 0.5);
    else if (isPreflop && pos === 'BB') bets.set(pos, 1.0);
    else bets.set(pos, 0);
  }

  let highBet = isPreflop ? 1.0 : 0;
  let posIdx = 0;

  for (let hIdx = 0; hIdx < spot.history.length; hIdx++) {
    let found = false;
    for (let attempts = 0; attempts < actingOrder.length; attempts++) {
      const pos = actingOrder[posIdx % actingOrder.length];
      posIdx++;
      if (folded.has(pos)) continue;

      const actionId = spot.history[hIdx];

      if (actionId === 'FOLD') {
        folded.add(pos);
        result.set(pos, { actionId, betBb: 0 });
      } else if (actionId === 'CHECK') {
        result.set(pos, { actionId, betBb: 0 });
      } else if (actionId === 'CALL') {
        bets.set(pos, highBet);
        result.set(pos, { actionId, betBb: highBet });
      } else {
        const size = parseFloat(actionId.split('_')[1]) || 0;
        bets.set(pos, size);
        highBet = Math.max(highBet, size);
        result.set(pos, { actionId, betBb: size });
      }

      found = true;
      break;
    }
    if (!found) break;
  }

  return result;
}

function formatActionLabel(actionId: string): string {
  if (actionId === 'FOLD') return 'Fold';
  if (actionId === 'CHECK') return 'Check';
  if (actionId === 'CALL') return 'Call';
  if (actionId.startsWith('RAISE_')) return 'Raise';
  if (actionId.startsWith('BET_')) return 'Bet';
  return actionId;
}

function spotToPlayers(
  spot: Spot,
  heroCards?: Array<{ rank: string; suit: 'h' | 'd' | 'c' | 's' }>,
  villainPosition?: string
): Player[] {
  const actions = parseHistoryActions(spot);
  return spot.positions.map((position) => {
    const isHero = position === spot.heroToAct;
    const isVillain = villainPosition ? position === villainPosition : false;
    const action = actions.get(position);
    const hasFolded = action?.actionId === 'FOLD';
    // Non-hero, non-villain positions without history actions are implicitly folded
    const isImplicitlyFolded = !isHero && !isVillain && !action;
    const isFolded = hasFolded || isImplicitlyFolded;

    let bet: number | undefined;
    if (isFolded) {
      bet = undefined;
    } else if (action) {
      bet = action.betBb > 0 ? action.betBb : undefined;
    } else if (spot.board.length === 0) {
      if (position === 'SB') bet = 0.5;
      else if (position === 'BB') bet = 1.0;
    }

    return {
      position: position as Player['position'],
      stackBB: spot.stacksBb[position],
      cards: isHero ? heroCards : undefined,
      isActive: !isFolded,
      isFolded,
      isHero,
      showCards: isHero,
      bet,
      actionLabel: action && !isFolded ? formatActionLabel(action.actionId) : undefined,
    };
  });
}

function derivePotType(history: ActionId[]): 'SRP' | '3BP' | '4BP' | undefined {
  const raiseCount = history.filter(a => a.startsWith('RAISE_') || a.startsWith('BET_')).length;
  if (raiseCount <= 1) return 'SRP';
  if (raiseCount === 2) return '3BP';
  if (raiseCount >= 3) return '4BP';
  return undefined;
}

function parseCardString(card: string): { rank: string; suit: 'h' | 'd' | 'c' | 's' } {
  return {
    rank: card.slice(0, -1),
    suit: card.slice(-1) as 'h' | 'd' | 'c' | 's',
  };
}

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;
const SUITS: Array<'h' | 'd' | 'c' | 's'> = ['h', 'd', 'c', 's'];

/** Deal two hero hole cards deterministically, avoiding board cards. */
function dealHeroCards(
  spot: Spot,
  seed: string
): Array<{ rank: string; suit: 'h' | 'd' | 'c' | 's' }> {
  const boardSet = new Set(spot.board.map(c => c.toLowerCase()));
  const deck: Array<{ rank: string; suit: 'h' | 'd' | 'c' | 's' }> = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      const key = `${rank}${suit}`.toLowerCase();
      if (!boardSet.has(key)) {
        deck.push({ rank, suit });
      }
    }
  }

  const rng = createSeededRng(combineSeed([seed, spot.spotId, 'hero-cards']));
  const i1 = Math.floor(rng.next() * deck.length);
  const card1 = deck[i1];
  deck[i1] = deck[deck.length - 1];
  const i2 = Math.floor(rng.next() * (deck.length - 1));
  const card2 = deck[i2];

  return [card1, card2];
}

// getAvailableActions is now imported from @/lib/engine/availableActions
// (rule-engine-filtered — respects stack depth and pot size per-spot)

/** Score a decision: 1 if +EV & highest freq, 0.5 if +EV but not highest freq, 0 if -EV. */
function scoreDecision(grade: DecisionGrade, actionId: ActionId): number {
  const userAction = grade.allActions?.find(a => a.actionId === actionId);
  if (!userAction || userAction.ev <= 0) return 0;
  const maxFreq = Math.max(...(grade.allActions?.map(a => a.frequency) ?? [0]));
  if (Math.abs(userAction.frequency - maxFreq) < 0.001) return 1;
  return 0.5;
}

/**
 * Generate deterministic mock range data for all 169 canonical hands.
 * Uses seeded RNG so the same spot always produces the same range.
 */
function generateMockRangeData(seed: string, spotId: string, player: 'hero' | 'villain'): RangeData {
  const rng = createSeededRng(combineSeed([seed, spotId, `range-${player}`]));
  const hands: RangeData['hands'] = [];

  for (let row = 0; row < 13; row++) {
    for (let col = 0; col < 13; col++) {
      const hand = getHandAtPosition(row, col);
      if (!hand) continue;

      const r = rng.next();
      const isPremium = (row === col && row <= 2) || (row === 0 && col <= 2 && col !== row);
      const isMarginal = row > 8 && col > 8;

      let foldFreq: number, callFreq: number, raiseFreq: number;
      if (isPremium) {
        raiseFreq = 0.7 + r * 0.25;
        callFreq = (1 - raiseFreq) * (0.3 + rng.next() * 0.4);
        foldFreq = 1 - raiseFreq - callFreq;
      } else if (isMarginal) {
        foldFreq = 0.5 + r * 0.4;
        callFreq = (1 - foldFreq) * (0.3 + rng.next() * 0.4);
        raiseFreq = 1 - foldFreq - callFreq;
      } else {
        foldFreq = 0.1 + r * 0.4;
        raiseFreq = (1 - foldFreq) * (0.3 + rng.next() * 0.5);
        callFreq = 1 - foldFreq - raiseFreq;
      }

      const actions: RangeData['hands'][number]['actions'] = [];
      if (raiseFreq > 0.01) actions.push({ type: 'raise', frequency: raiseFreq });
      if (callFreq > 0.01) actions.push({ type: 'call', frequency: callFreq });
      if (foldFreq > 0.01) actions.push({ type: 'fold', frequency: foldFreq });

      if (actions.length > 0) {
        hands.push({ hand, actions });
      }
    }
  }

  return { hands, totalCombos: hands.length };
}

// ---------- Page component ----------

type UIState = 'idle' | 'submitted' | 'revealed';

export default function TrainingPageWrapper() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-gray-950"><p className="text-gray-400">Loading...</p></div>}>
      <TrainingPage />
    </Suspense>
  );
}

function TrainingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { config, updateConfig, isLoading: configLoading } = useTrainerConfig();

  // Config dialog state - starts open
  const [configOpen, setConfigOpen] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [seed, setSeed] = useState<string | null>(null);
  const [session, setSession] = useState<SessionSnapshot | null>(null);
  const [currentSpot, setCurrentSpot] = useState<Spot | null>(null);
  const [uiState, setUiState] = useState<UIState>('idle');
  const [selectedActionId, setSelectedActionId] = useState<ActionId | null>(null);
  const [grade, setGrade] = useState<DecisionGrade | null>(null);
  const [handCount, setHandCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [heroRange, setHeroRange] = useState<RangeData | null>(null);
  const [villainRange, setVillainRange] = useState<RangeData | null>(null);
  const [rangeModalOpen, setRangeModalOpen] = useState(false);
  const [villainPosition, setVillainPosition] = useState<string | null>(null);

  // Refs for stable keyboard handler access
  const uiStateRef = useRef(uiState);
  const currentSpotRef = useRef(currentSpot);
  uiStateRef.current = uiState;
  currentSpotRef.current = currentSpot;

  const accuracy = handCount > 0 ? (correctCount / handCount) * 100 : 0;

  // Apply drill filters from URL params on mount
  useEffect(() => {
    const heroPosition = searchParams.get('heroPosition');
    if (heroPosition && config) {
      updateConfig({ positions: [heroPosition as typeof config.positions[number]] });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // canStart: same as TrainerLobby
  const canStart = useMemo(() => {
    if (!config) return false;
    return config.positions.length > 0 && config.potTypes.length > 0;
  }, [config]);

  // ---------- Start Training ----------
  const handleStartTraining = useCallback(async () => {
    if (!config || !canStart || isStarting) return;

    setIsStarting(true);
    setStartError(null);

    try {
      // Postflop mode: redirect to dedicated postflop training page
      if (config.mode === 'FLOP') {
        const res = await fetch('/api/session/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            seed: crypto.randomUUID(),
            mode: 'TRAINING',
            targetStackBb: parseInt(config.stackDepth),
            filters: {
              street: 'FLOP',
              positions: config.positions,
              potTypes: config.potTypes,
            },
          }),
        });

        if (res.ok || res.status === 201) {
          const data = await res.json();
          const newSessionId = data.session?.sessionId ?? data.sessionId;
          const newSeed = data.session?.seed ?? data.seed ?? '';
          router.push(`/postflop-training?sessionId=${newSessionId}&seed=${newSeed}`);
        } else {
          const data = await res.json().catch(() => null);
          setStartError(data?.error?.message ?? `Failed to start session (${res.status})`);
        }
        return;
      }

      // Preflop mode: start session inline (no navigation)
      const res = await fetch('/api/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seed: crypto.randomUUID(),
          mode: 'TRAINING',
          targetStackBb: parseInt(config.stackDepth),
          filters: {
            street: 'PREFLOP',
            positions: config.positions,
            potTypes: config.potTypes,
          },
        }),
      });

      if (res.ok || res.status === 201) {
        const data = await res.json();
        const newSessionId = data.session?.sessionId ?? data.sessionId;
        const newSeed = data.session?.seed ?? data.seed ?? '';

        // Persist initial session + spot
        if (data.session && data.spot) {
          writeSessionRecord({
            session: data.session,
            currentSpot: data.spot,
            startedAt: new Date().toISOString(),
          });
        }

        // Set session state
        setSessionId(newSessionId);
        setSeed(newSeed);
        setSession(data.session);
        setCurrentSpot(data.spot);
        setVillainPosition(data.villainPosition ?? null);
        setHandCount(0);
        setCorrectCount(0);
        setUiState('idle');
        setGrade(null);
        setHeroRange(null);
        setVillainRange(null);
        setSelectedActionId(null);
        setErrorMessage(null);
        setStorageWarning(consumeStorageWarning());

        // Close config dialog - session is now active
        setConfigOpen(false);
      } else {
        const data = await res.json().catch(() => null);
        setStartError(data?.error?.message ?? `Failed to start session (${res.status})`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start session';
      setStartError(msg);
    } finally {
      setIsStarting(false);
    }
  }, [config, canStart, isStarting, router]);

  // ---------- Submit Action ----------
  const handleSubmitAction = useCallback(async (actionId: ActionId) => {
    if (!seed || !session || !currentSpot || uiState !== 'idle') return;

    setUiState('submitted');
    setSelectedActionId(actionId);
    setErrorMessage(null);

    try {
      const response = await submitAction({
        seed,
        sessionId: session.sessionId,
        spot: currentSpot,
        actionId,
      });

      // 500ms reveal delay
      await new Promise(resolve => setTimeout(resolve, 500));

      if ('result' in response) {
        setGrade(response.result);
        const score = scoreDecision(response.result, actionId);
        setCorrectCount(prev => prev + score);
      }

      setHandCount(prev => prev + 1);
      setUiState('revealed');

      // Generate mock range data
      if (seed && currentSpot) {
        setHeroRange(generateMockRangeData(seed, currentSpot.spotId, 'hero'));
        setVillainRange(generateMockRangeData(seed, currentSpot.spotId, 'villain'));
      }

      updateSessionRecord(session.sessionId, (previous) => ({
        session,
        currentSpot,
        reviewAvailable: session.mode === 'TRAINING',
        lastSubmit: response,
        startedAt: previous?.startedAt,
        completedAt: previous?.completedAt,
        aggregates: previous?.aggregates,
      }));
      setStorageWarning(consumeStorageWarning());
    } catch (error) {
      if (error instanceof SessionApiError) {
        setErrorMessage(`${error.code}: ${error.message}`);
      } else {
        setErrorMessage('Failed to submit action.');
      }
      setUiState('idle');
    }
  }, [currentSpot, seed, session, uiState]);

  // ---------- Next Hand ----------
  const handleNext = useCallback(async () => {
    if (!seed || !session || uiState !== 'revealed') return;

    setUiState('idle');
    setGrade(null);
    setHeroRange(null);
    setVillainRange(null);
    setSelectedActionId(null);
    setErrorMessage(null);

    try {
      const response = await nextDecision({
        seed,
        sessionId: session.sessionId,
      });
      setSession(response.session);
      setCurrentSpot(response.spot);
      setVillainPosition(response.villainPosition ?? null);

      updateSessionRecord(response.session.sessionId, (previous) => ({
        session: response.session,
        currentSpot: response.spot,
        reviewAvailable: response.session.mode === 'TRAINING',
        lastSubmit: previous?.lastSubmit,
        startedAt: previous?.startedAt,
        completedAt:
          response.session.isComplete && !previous?.completedAt
            ? new Date().toISOString()
            : previous?.completedAt,
        aggregates: previous?.aggregates,
      }));
      setStorageWarning(consumeStorageWarning());

      if (response.session.isComplete) {
        router.replace(
          `/summary/${response.session.sessionId}?seed=${encodeURIComponent(
            response.session.seed
          )}&mode=${response.session.mode}&reviewAvailable=${
            response.session.mode === 'TRAINING' ? '1' : '0'
          }`
        );
      }
    } catch (error) {
      if (error instanceof SessionApiError && error.code === 'SESSION_COMPLETE') {
        // Session completed: redirect to summary
        router.replace(
          `/summary/${session.sessionId}?seed=${encodeURIComponent(
            session.seed
          )}&mode=${session.mode}`
        );
      } else if (error instanceof SessionApiError) {
        setErrorMessage(`${error.code}: ${error.message}`);
      } else {
        setErrorMessage('Failed to load next decision.');
      }
    }
  }, [router, seed, session, uiState]);

  // ---------- Keyboard shortcuts ----------
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.key === ' ' || e.key === 'Enter') && uiStateRef.current === 'revealed') {
        e.preventDefault();
        void handleNext();
        return;
      }

      if (uiStateRef.current !== 'idle' || !currentSpotRef.current) return;

      const actions = getAvailableActions(currentSpotRef.current);
      const keyNum = parseInt(e.key);
      if (keyNum >= 1 && keyNum <= actions.length) {
        e.preventDefault();
        void handleSubmitAction(actions[keyNum - 1].actionId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handleSubmitAction]);

  // ---------- Derived data ----------

  const availableActions = useMemo(
    () => (currentSpot ? getAvailableActions(currentSpot) : [{ actionId: 'FOLD' as ActionId, label: 'Fold' }, { actionId: 'CALL' as ActionId, label: 'Call' }]),
    [currentSpot]
  );

  const actionPanelData = useMemo(() => {
    return availableActions.map(({ actionId, label }) => {
      const isUserChoice = selectedActionId === actionId;

      let state: 'idle' | 'disabled' | 'selected' | 'revealed-correct' | 'revealed-incorrect' = 'idle';
      let ev: number | undefined;
      let frequency: number | undefined;

      if (uiState === 'submitted') {
        state = isUserChoice ? 'selected' : 'disabled';
      } else if (uiState === 'revealed' && grade) {
        const actionData = grade.allActions?.find(a => a.actionId === actionId);
        if (actionData) {
          ev = actionData.ev;
          frequency = actionData.frequency;
        }
        if (isUserChoice) {
          const score = scoreDecision(grade, selectedActionId!);
          state = score >= 1 ? 'revealed-correct' : score > 0 ? 'revealed-correct' : 'revealed-incorrect';
        } else {
          state = 'revealed-correct';
        }
      }

      return {
        actionId,
        label,
        state,
        ev,
        frequency,
        isUserChoice,
      };
    });
  }, [availableActions, grade, selectedActionId, uiState]);

  // Build PokerTable data from current spot
  const heroCards = useMemo(
    () => (currentSpot && seed ? dealHeroCards(currentSpot, seed) : undefined),
    [currentSpot, seed]
  );
  const players = currentSpot ? spotToPlayers(currentSpot, heroCards, villainPosition ?? undefined) : [];
  const communityCards = currentSpot
    ? currentSpot.board.map(parseCardString)
    : [];
  const potType = currentSpot ? derivePotType(currentSpot.history) : undefined;
  const dealerPosition = currentSpot
    ? (currentSpot.positions.includes('BTN') ? 'BTN' : currentSpot.positions[0]) as Player['position']
    : 'BTN';

  // Loading state
  if (configLoading || !config) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <p className="text-gray-400">Loading configuration...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      {/* Info bar (only shown when session active) */}
      {sessionId && (
        <div className="p-4 bg-gray-800 border-b border-gray-700">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-6">
              <Link href="/" className="text-sm text-gray-400 hover:text-white transition-colors">
                &larr; Dashboard
              </Link>
              <div className="flex gap-8">
                <div className="flex flex-col">
                  <span className="text-xs text-gray-400 uppercase tracking-wide">Hand</span>
                  <span className="text-lg font-bold text-white">#{handCount + 1}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-gray-400 uppercase tracking-wide">Accuracy</span>
                  <span className="text-lg font-bold text-blue-400">{accuracy.toFixed(1)}%</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-gray-400 uppercase tracking-wide">Correct</span>
                  <span className="text-lg font-bold text-green-400">{correctCount % 1 === 0 ? correctCount : correctCount.toFixed(1)}/{handCount}</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setConfigOpen(true)}
              className="p-2 text-gray-400 hover:text-white transition-colors rounded hover:bg-gray-700"
              aria-label="Open training setup"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Errors/warnings */}
      {errorMessage && (
        <div className="mx-4 mt-2 rounded border border-red-500/50 bg-red-900/30 p-3 text-sm text-red-200">
          {errorMessage}
        </div>
      )}
      {storageWarning && (
        <div className="mx-4 mt-2 rounded border border-amber-500/50 bg-amber-900/30 p-3 text-sm text-amber-200">
          {storageWarning}
        </div>
      )}

      {/* PokerTable (always rendered, even before session starts) */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <div className="w-full max-w-6xl">
          {currentSpot ? (
            <PokerTable
              players={players}
              communityCards={communityCards}
              pot={currentSpot.potBb}
              potType={potType}
              dealerPosition={dealerPosition}
              heroPosition={currentSpot.heroToAct as Player['position']}
              tableSize="6max"
            />
          ) : (
            <PokerTable
              players={[]}
              communityCards={[]}
              pot={0}
              dealerPosition="BTN"
              tableSize="6max"
            />
          )}
        </div>
      </div>

      {/* ActionPanel (only shown during active session in idle/submitted/revealed state) */}
      {sessionId && currentSpot && (uiState === 'idle' || uiState === 'submitted') && (
        <div className="p-4">
          <ActionPanel
            actions={actionPanelData}
            onAction={(actionId) => void handleSubmitAction(actionId as ActionId)}
          />
        </div>
      )}

      {/* Revealed state: action panel + next button + view ranges */}
      {sessionId && currentSpot && uiState === 'revealed' && (
        <>
          <div className="p-4">
            <ActionPanel
              actions={actionPanelData}
              onAction={() => {}}
            />
          </div>
          <div className="p-4 bg-gray-900 flex gap-3">
            <button
              onClick={() => void handleNext()}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              Next Hand (Space/Enter)
            </button>
            {heroRange && villainRange && (
              <button
                onClick={() => setRangeModalOpen(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                View Ranges
              </button>
            )}
          </div>
        </>
      )}

      {/* Config dialog overlay */}
      <TrainingConfigDialog
        isOpen={configOpen}
        onClose={() => setConfigOpen(false)}
        onStartTraining={() => void handleStartTraining()}
        isStarting={isStarting}
        canStart={canStart}
        error={startError}
        config={config}
        onConfigChange={updateConfig}
        isSessionActive={sessionId !== null}
      />

      {/* Range modal */}
      <RangeGridModal
        isOpen={rangeModalOpen}
        onClose={() => setRangeModalOpen(false)}
        heroRange={heroRange ?? { hands: [], totalCombos: 0 }}
        villainRange={villainRange ?? { hands: [], totalCombos: 0 }}
        currentBoard={communityCards.map((c) => `${c.rank}${c.suit}`)}
      />
    </div>
  );
}
