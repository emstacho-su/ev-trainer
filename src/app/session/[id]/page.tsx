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
import SessionSidebar from "../../../components/config/SessionSidebar";
import { useTrainerConfig } from "../../../lib/v2/hooks/useTrainerConfig";
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
import type { RangeData } from "../../../lib/range/types";
import { getHandAtPosition } from "../../../lib/range/gridLayout";
import { RangeGridModal } from "../../../components/range";

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
  // Fisher-Yates partial shuffle for 2 cards
  const i1 = Math.floor(rng.next() * deck.length);
  const card1 = deck[i1];
  deck[i1] = deck[deck.length - 1];
  const i2 = Math.floor(rng.next() * (deck.length - 1));
  const card2 = deck[i2];

  return [card1, card2];
}

/**
 * Determine if hero faces an outstanding bet.
 * Postflop: if all prior actions in history are CHECKs (or history is empty), no bet facing.
 * Preflop: always facing at least the BB.
 */
function heroFacesBet(spot: Spot): boolean {
  if (spot.board.length === 0) return true; // preflop always faces BB
  return spot.history.some(
    a => a.startsWith('BET_') || a.startsWith('RAISE_') || a === 'CALL'
  );
}

/** Check if this is a preflop RFI (raise first in) spot. */
function isPreflopRfi(spot: Spot): boolean {
  return spot.board.length === 0 && spot.history.every(a => a === 'FOLD');
}

/** Get the action IDs appropriate for the current spot context. */
function getAvailableActions(spot: Spot): { actionId: ActionId; label: string }[] {
  // Preflop RFI: simplified Fold / Raise 3x
  if (isPreflopRfi(spot)) {
    return [
      { actionId: 'FOLD', label: 'Fold' },
      { actionId: 'RAISE_3.0X', label: 'Raise 3x' },
    ];
  }
  if (heroFacesBet(spot)) {
    if (spot.board.length === 0) {
      // Preflop facing a raise: Fold, Call, Raise
      return [
        { actionId: 'FOLD', label: 'Fold' },
        { actionId: 'CALL', label: 'Call' },
        { actionId: 'RAISE_3.0X', label: 'Raise 3x' },
      ];
    }
    // Postflop facing bet
    return [
      { actionId: 'FOLD', label: 'Fold' },
      { actionId: 'CALL', label: 'Call' },
      { actionId: 'RAISE_3.0X', label: 'Raise 3x' },
    ];
  }
  // Postflop not facing bet: Check + multiple bet sizes
  return [
    { actionId: 'CHECK', label: 'Check' },
    { actionId: 'BET_33PCT', label: 'Bet 33%' },
    { actionId: 'BET_50PCT', label: 'Bet 50%' },
    { actionId: 'BET_75PCT', label: 'Bet 75%' },
    { actionId: 'BET_100PCT', label: 'Bet 100%' },
  ];
}

/** Score a decision: 1 if +EV & highest freq, 0.5 if +EV but not highest freq, 0 if -EV. */
function scoreDecision(grade: DecisionGrade, actionId: ActionId): number {
  const userAction = grade.allActions?.find(a => a.actionId === actionId);
  if (!userAction || userAction.ev <= 0) return 0;
  // Find highest frequency action
  const maxFreq = Math.max(...(grade.allActions?.map(a => a.frequency) ?? [0]));
  if (Math.abs(userAction.frequency - maxFreq) < 0.001) return 1;
  return 0.5;
}

/**
 * Generate deterministic mock range data for all 169 canonical hands.
 * Uses seeded RNG so the same spot always produces the same range.
 * The hero and villain get different seeds to produce distinct ranges.
 */
function generateMockRangeData(seed: string, spotId: string, player: 'hero' | 'villain'): RangeData {
  const rng = createSeededRng(combineSeed([seed, spotId, `range-${player}`]));
  const hands: RangeData['hands'] = [];

  for (let row = 0; row < 13; row++) {
    for (let col = 0; col < 13; col++) {
      const hand = getHandAtPosition(row, col);
      if (!hand) continue;

      const r = rng.next();
      // Premium hands (pairs AA-QQ, AKs, AQs) mostly raise
      const isPremium = (row === col && row <= 2) || (row === 0 && col <= 2 && col !== row);
      // Marginal hands fold more
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [heroRange, setHeroRange] = useState<RangeData | null>(null);
  const [villainRange, setVillainRange] = useState<RangeData | null>(null);
  const [rangeModalOpen, setRangeModalOpen] = useState(false);
  const [currentVillainPosition, setCurrentVillainPosition] = useState<string | null>(null);
  const { config, updateConfig } = useTrainerConfig();

  // Refs for stable keyboard handler access
  const uiStateRef = useRef(uiState);
  const currentSpotRef = useRef(currentSpot);
  uiStateRef.current = uiState;
  currentSpotRef.current = currentSpot;

  const accuracy = handCount > 0 ? (correctCount / handCount) * 100 : 0;

  const loadSession = useCallback(
    async (sessionSeed: string) => {
      try {
        const detail = await getSession(sessionId, sessionSeed);
        updateFromSessionDetail(detail);
        setStorageWarning(consumeStorageWarning());
        setSession(detail.session);
        if (detail.session.isComplete) {
          router.replace(toSummaryHref(detail));
        }
        return detail;
      } catch (error) {
        // If server lost the in-memory session (dev HMR, restart), re-create it
        if (error instanceof SessionApiError && error.code === "NOT_FOUND") {
          const stored = readSessionRecord(sessionId);
          if (stored?.session) {
            const res = await fetch("/api/session/start", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                seed: stored.session.seed,
                sessionId: stored.session.sessionId,
                mode: stored.session.mode,
                packId: stored.session.packId,
                filters: stored.session.filters,
                decisionsPerSession: stored.session.decisionsPerSession,
              }),
            });
            if (res.ok) {
              const data = await res.json();
              setSession(data.session);
              setCurrentSpot(data.spot);
              setCurrentVillainPosition(data.villainPosition ?? null);
              return null;
            }
          }
        }
        throw error;
      }
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
        const score = scoreDecision(response.result, actionId);
        setCorrectCount(prev => prev + score);
      }

      setHandCount(prev => prev + 1);
      setUiState('revealed');

      // Generate mock range data now that a decision has been made
      if (seed && currentSpot) {
        setHeroRange(generateMockRangeData(seed, currentSpot.spotId, 'hero'));
        setVillainRange(generateMockRangeData(seed, currentSpot.spotId, 'villain'));
      }

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
      setCurrentVillainPosition(response.villainPosition ?? null);

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
          if (detail) {
            router.replace(toSummaryHref(detail));
          } else {
            router.replace(`/summary/${session.sessionId}?mode=${session.mode}`);
          }
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

  // Keyboard shortcuts: 1-5 for action buttons by position
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

  // Determine available actions based on spot context
  const availableActions = useMemo(
    () => (currentSpot ? getAvailableActions(currentSpot) : [{ actionId: 'FOLD' as ActionId, label: 'Fold' }, { actionId: 'CALL' as ActionId, label: 'Call' }]),
    [currentSpot]
  );

  // Build action data for ActionPanel
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

  const showDeleteMissingSeed =
    !seed && !isLoading && errorMessage?.includes("Missing seed") === true;

  // Build PokerTable data from current spot
  const heroCards = useMemo(
    () => (currentSpot && seed ? dealHeroCards(currentSpot, seed) : undefined),
    [currentSpot, seed]
  );
  const players = currentSpot ? spotToPlayers(currentSpot, heroCards, currentVillainPosition ?? undefined) : [];
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
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 text-gray-400 hover:text-white transition-colors rounded hover:bg-gray-700"
            aria-label="Open settings"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
          </button>
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
              router.push("/");
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
                heroPosition={currentSpot.heroToAct as Player['position']}
                tableSize="6max"
              />
            </div>
          </div>

          {/* Action panel */}
          <div className="p-4">
            <ActionPanel
              actions={actionPanelData}
              onAction={(actionId) => void handleSubmitAction(actionId as ActionId)}
            />
          </div>

          {/* Next button + View Ranges (only in revealed state) */}
          {uiState === 'revealed' && (
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
          )}

          {/* Range modal */}
          <RangeGridModal
            isOpen={rangeModalOpen}
            onClose={() => setRangeModalOpen(false)}
            heroRange={heroRange ?? { hands: [], totalCombos: 0 }}
            villainRange={villainRange ?? { hands: [], totalCombos: 0 }}
            currentBoard={communityCards.map((c) => `${c.rank}${c.suit}`)}
          />
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-400">No spot available.</p>
        </div>
      )}

      {/* Settings sidebar */}
      {config && (
        <SessionSidebar
          isOpen={isSidebarOpen}
          config={config}
          onConfigChange={updateConfig}
          onClose={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}
