"use client";

/**
 * Overview: Core in-session loop with PokerTable UI.
 * Interacts with: session API client, PokerTable/ActionPanel, local session storage.
 * Importance: Main training workflow where decisions are executed and tracked.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { PokerTable } from "../../../components/poker/organisms/PokerTable";
import { ActionPanel } from "../../../components/poker/organisms/ActionPanel";
import type { Spot } from "../../../lib/engine/spot";
import type { ActionId, Position } from "../../../lib/engine/types";
import type { DecisionGrade } from "../../../lib/engine/trainingOrchestrator";
import { createSeededRng, combineSeed } from "../../../lib/engine/rng";
import type {
  SessionDetailResponse,
  SessionSnapshot,
} from "../../../lib/v2/api/sessionHandlers";
import {
  SessionApiError,
  getSession,
  nextDecision,
  submitAction,
} from "../../../lib/v2/api-client/sessionClient";
import {
  consumeStorageWarning,
  deleteSessionRecord,
  readSessionRecord,
  updateSessionRecord,
  updateFromSessionDetail,
} from "../../../lib/v2/storage/sessionStorage";

// ---------- Spot → PokerTable conversion ----------

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

  for (const pos of spot.positions) {
    if (pos === 'SB') bets.set(pos, 0.5);
    else if (pos === 'BB') bets.set(pos, 1.0);
    else bets.set(pos, 0);
  }

  let highBet = 1.0;
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
        result.set(pos, { actionId, betBb: bets.get(pos) ?? 0 });
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
  heroCards?: Array<{ rank: string; suit: 'h' | 'd' | 'c' | 's' }>
): Player[] {
  const actions = parseHistoryActions(spot);
  return spot.positions.map((position) => {
    const isHero = position === spot.heroToAct;
    const action = actions.get(position);
    const hasFolded = action?.actionId === 'FOLD';

    let bet: number | undefined;
    if (action) {
      bet = action.betBb > 0 ? action.betBb : undefined;
    } else {
      if (position === 'SB') bet = 0.5;
      else if (position === 'BB') bet = 1.0;
    }

    return {
      position: position as Player['position'],
      stackBB: spot.stacksBb[position],
      cards: isHero ? heroCards : undefined,
      isActive: !hasFolded,
      isFolded: hasFolded,
      isHero,
      showCards: isHero,
      bet,
      actionLabel: action ? formatActionLabel(action.actionId) : undefined,
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
  // Fisher-Yates partial shuffle for 2 cards
  const i1 = Math.floor(rng.next() * deck.length);
  const card1 = deck[i1];
  deck[i1] = deck[deck.length - 1];
  const i2 = Math.floor(rng.next() * (deck.length - 1));
  const card2 = deck[i2];

  return [card1, card2];
}

function mapSimpleAction(actionId: ActionId): 'fold' | 'call' | 'raise' {
  if (actionId === 'FOLD') return 'fold';
  if (actionId === 'CALL' || actionId === 'CHECK') return 'call';
  return 'raise';
}

// ---------- Page component ----------

function toSummaryHref(detail: SessionDetailResponse): string {
  return `/summary/${detail.session.sessionId}?seed=${encodeURIComponent(
    detail.session.seed
  )}&mode=${detail.session.mode}&reviewAvailable=${detail.reviewAvailable ? "1" : "0"}`;
}

type UIState = 'idle' | 'submitted' | 'revealed';

export default function SessionPage() {
  const router = useRouter();
  const params = useParams<{ id?: string | string[] }>();
  const searchParams = useSearchParams();
  const sessionId = useMemo(
    () => (typeof params.id === "string" ? params.id : ""),
    [params.id]
  );

  const [seed, setSeed] = useState<string | null>(null);
  const [session, setSession] = useState<SessionSnapshot | null>(null);
  const [currentSpot, setCurrentSpot] = useState<Spot | null>(null);
  const [uiState, setUiState] = useState<UIState>('idle');
  const [selectedActionId, setSelectedActionId] = useState<ActionId | null>(null);
  const [grade, setGrade] = useState<DecisionGrade | null>(null);
  const [handCount, setHandCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  // Refs for stable keyboard handler access
  const uiStateRef = useRef(uiState);
  const currentSpotRef = useRef(currentSpot);
  uiStateRef.current = uiState;
  currentSpotRef.current = currentSpot;

  const accuracy = handCount > 0 ? (correctCount / handCount) * 100 : 0;

  const loadSession = useCallback(
    async (sessionSeed: string) => {
      const detail = await getSession(sessionId, sessionSeed);
      updateFromSessionDetail(detail);
      setStorageWarning(consumeStorageWarning());
      setSession(detail.session);
      if (detail.session.isComplete) {
        router.replace(toSummaryHref(detail));
      }
      return detail;
    },
    [router, sessionId]
  );

  // Bootstrap: load session from localStorage + server
  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      setIsLoading(true);
      setErrorMessage(null);

      const stored = readSessionRecord(sessionId);
      setStorageWarning(consumeStorageWarning());
      const paramSeed = searchParams.get("seed");
      const resolvedSeed = paramSeed ?? stored?.session.seed ?? null;

      if (!mounted) return;
      setSeed(resolvedSeed);

      if (!resolvedSeed) {
        setErrorMessage("Missing seed for this session.");
        setSession(stored?.session ?? null);
        setCurrentSpot(stored?.currentSpot ?? null);
        setIsLoading(false);
        return;
      }

      // Load spot from localStorage first
      setSession(stored?.session ?? null);
      setCurrentSpot(stored?.currentSpot ?? null);

      try {
        await loadSession(resolvedSeed);
        if (!mounted) return;
      } catch (error) {
        if (!mounted) return;
        if (error instanceof SessionApiError) {
          setErrorMessage(`${error.code}: ${error.message}`);
        } else {
          setErrorMessage("Failed to load session.");
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    if (sessionId) {
      void bootstrap();
    } else {
      setIsLoading(false);
      setErrorMessage("Invalid session id.");
    }

    return () => {
      mounted = false;
    };
  }, [loadSession, searchParams, sessionId]);

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
        if (response.result.isBestAction) {
          setCorrectCount(prev => prev + 1);
        }
      }

      setHandCount(prev => prev + 1);
      setUiState('revealed');

      updateSessionRecord(session.sessionId, (previous) => ({
        session,
        currentSpot,
        reviewAvailable: session.mode === "TRAINING",
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
        setErrorMessage("Failed to submit action.");
      }
      setUiState('idle');
    }
  }, [currentSpot, seed, session, uiState]);

  const handleNext = useCallback(async () => {
    if (!seed || !session || uiState !== 'revealed') return;

    setUiState('idle');
    setGrade(null);
    setSelectedActionId(null);
    setErrorMessage(null);

    try {
      const response = await nextDecision({
        seed,
        sessionId: session.sessionId,
      });
      setSession(response.session);
      setCurrentSpot(response.spot);

      updateSessionRecord(response.session.sessionId, (previous) => ({
        session: response.session,
        currentSpot: response.spot,
        reviewAvailable: response.session.mode === "TRAINING",
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
            response.session.mode === "TRAINING" ? "1" : "0"
          }`
        );
      }
    } catch (error) {
      if (error instanceof SessionApiError && error.code === "SESSION_COMPLETE") {
        try {
          const detail = await loadSession(seed);
          router.replace(toSummaryHref(detail));
        } catch {
          router.replace(`/summary/${session.sessionId}?mode=${session.mode}`);
        }
      } else if (error instanceof SessionApiError) {
        setErrorMessage(`${error.code}: ${error.message}`);
      } else {
        setErrorMessage("Failed to load next decision.");
      }
    }
  }, [loadSession, router, seed, session, uiState]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.key === ' ' || e.key === 'Enter') && uiStateRef.current === 'revealed') {
        e.preventDefault();
        void handleNext();
        return;
      }

      if (uiStateRef.current !== 'idle' || !currentSpotRef.current) return;

      let actionId: ActionId | null = null;
      if (e.key === '1' || e.key.toLowerCase() === 'f') actionId = 'FOLD';
      else if (e.key === '2' || e.key.toLowerCase() === 'c') actionId = 'CALL';
      else if (e.key === '3' || e.key.toLowerCase() === 'r') actionId = 'RAISE_2.5BB';

      if (actionId) {
        e.preventDefault();
        void handleSubmitAction(actionId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handleSubmitAction]);

  // Build action data for ActionPanel
  const actionPanelData = useMemo(() => {
    const baseActions: ActionId[] = ['FOLD', 'CALL', 'RAISE_2.5BB'];

    return baseActions.map((actionId) => {
      const simpleAction = mapSimpleAction(actionId);
      const isUserChoice = selectedActionId === actionId;

      let state: 'idle' | 'disabled' | 'selected' | 'revealed-correct' | 'revealed-incorrect' = 'idle';
      let ev: number | undefined;
      let frequency: number | undefined;

      if (uiState === 'submitted') {
        state = isUserChoice ? 'selected' : 'disabled';
      } else if (uiState === 'revealed' && grade) {
        const actionData = grade.allActions?.find(a => mapSimpleAction(a.actionId) === simpleAction);
        if (actionData) {
          ev = actionData.ev;
          frequency = actionData.frequency;
        }
        if (isUserChoice) {
          state = grade.isBestAction ? 'revealed-correct' : 'revealed-incorrect';
        } else {
          state = 'revealed-correct';
        }
      }

      return {
        action: simpleAction,
        label: simpleAction === 'raise' ? 'Raise' : undefined,
        state,
        ev,
        frequency,
        isUserChoice,
      };
    });
  }, [grade, selectedActionId, uiState]);

  const showDeleteMissingSeed =
    !seed && !isLoading && errorMessage?.includes("Missing seed") === true;

  // Build PokerTable data from current spot
  const heroCards = useMemo(
    () => (currentSpot && seed ? dealHeroCards(currentSpot, seed) : undefined),
    [currentSpot, seed]
  );
  const players = currentSpot ? spotToPlayers(currentSpot, heroCards) : [];
  const communityCards = currentSpot
    ? currentSpot.board.map(parseCardString)
    : [];
  const potType = currentSpot ? derivePotType(currentSpot.history) : undefined;
  const dealerPosition = currentSpot
    ? (currentSpot.positions.includes('BTN') ? 'BTN' : currentSpot.positions[0]) as Player['position']
    : 'BTN';

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      {/* Info bar */}
      <div className="p-4 bg-gray-800 border-b border-gray-700">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-6">
            <Link href="/lobby" className="text-sm text-gray-400 hover:text-white transition-colors">
              &larr; Lobby
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
                <span className="text-lg font-bold text-green-400">{correctCount}/{handCount}</span>
              </div>
            </div>
          </div>
          {session && (
            <div className="flex flex-col items-end">
              <span className="text-xs text-gray-400 uppercase tracking-wide">Session</span>
              <span className="text-sm font-semibold text-gray-300">
                {session.mode} · {session.decisionIndex}/{session.decisionsPerSession}
              </span>
            </div>
          )}
        </div>
      </div>

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
      {showDeleteMissingSeed && (
        <div className="mx-4 mt-2">
          <button
            type="button"
            onClick={() => {
              deleteSessionRecord(sessionId);
              router.push("/lobby");
            }}
            className="rounded border border-gray-600 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800"
          >
            Delete this session
          </button>
        </div>
      )}

      {/* Main content */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-400">Loading session...</p>
        </div>
      ) : currentSpot ? (
        <>
          {/* Table display */}
          <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
            <div className="w-full max-w-6xl">
              <PokerTable
                players={players}
                communityCards={communityCards}
                pot={currentSpot.potBb}
                potType={potType}
                dealerPosition={dealerPosition}
                tableSize="6max"
              />
            </div>
          </div>

          {/* Action panel */}
          <div className="p-4">
            <ActionPanel
              actions={actionPanelData}
              onAction={(action) => {
                const actionMap: Record<string, ActionId> = {
                  fold: 'FOLD',
                  call: 'CALL',
                  raise: 'RAISE_2.5BB',
                };
                void handleSubmitAction(actionMap[action]);
              }}
            />
          </div>

          {/* Next button (only in revealed state) */}
          {uiState === 'revealed' && (
            <div className="p-4 bg-gray-900">
              <button
                onClick={() => void handleNext()}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
              >
                Next Hand (Space/Enter)
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-400">No spot available.</p>
        </div>
      )}
    </div>
  );
}
