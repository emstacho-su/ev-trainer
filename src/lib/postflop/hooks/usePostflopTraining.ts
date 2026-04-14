'use client';

// src/lib/postflop/hooks/usePostflopTraining.ts
// Hook that orchestrates postflop training: hand generation, user decisions,
// solver calls, villain action delays, and street advancement.

import { useState, useCallback, useRef } from 'react';
import { usePostflopSession } from '../session/postflopSession';
import { generatePostflopHand } from '../utils/handGenerator';
import { fetchPostflopSolution } from '../api/postflopApiClient';
import { sampleVillainAction } from '../utils/villainSampler';
import {
  createInitialGameState,
  computeLegalActions,
  validateActionLegality,
  type GameState,
} from '../../engine/gameState';
import type { Spot } from '../../engine/spot';
import type { Position } from '../../engine/types';
import type { SolverNodeOutput, SolverActionOutput } from '../../engine/solverAdapter';
import type { PostflopConfig } from '../../solver/postflopTypes';
import type { Card } from '../../solver/types';
import type { Street } from '../types';

/** Build a PostflopConfig from current session state for solver call. */
function buildSolverConfig(
  street: Street,
  board: Card[],
  potBb: number,
  stackBb: number,
  heroPosition: 'IP' | 'OOP',
): PostflopConfig {
  return {
    maxIterations: 100,
    targetExploitability: 0.5,
    checkConvergenceEvery: 10,
    street,
    board,
    heroRange: [],
    villainRange: [],
    potBb,
    stackBb,
    heroPosition,
    actionAbstraction: {
      betSizes: {
        PREFLOP: [],
        FLOP: [0.33, 0.5, 0.75, 1.0],
        TURN: [0.33, 0.5, 0.75, 1.0],
        RIVER: [0.33, 0.5, 0.75, 1.0],
      },
      raiseSizes: {
        PREFLOP: [],
        FLOP: [2.2, 2.5, 3.0],
        TURN: [2.2, 2.5, 3.0],
        RIVER: [2.2, 2.5, 3.0],
      },
      includeAllIn: true,
      allInThreshold: 2.0,
    },
  };
}

/** Number of board cards per street. */
const BOARD_SIZE: Record<Street, number> = {
  FLOP: 3,
  TURN: 4,
  RIVER: 5,
};

/** Bridge postflop session state → engine Spot for GameState creation. */
function buildSpotFromPostflopState(
  board: Card[],
  potBb: number,
  stackBb: number,
  heroPosition: 'IP' | 'OOP',
): Spot {
  // Map IP/OOP to standard positions (BTN = IP, BB = OOP)
  const heroPos: Position = heroPosition === 'IP' ? 'BTN' : 'BB';
  const villainPos: Position = heroPosition === 'IP' ? 'BB' : 'BTN';
  return {
    schemaVersion: '1',
    spotId: 'postflop-live',
    gameType: 'NLHE',
    blinds: { sb: 0.5, bb: 1 },
    positions: [villainPos, heroPos] as Position[],
    stacksBb: { [heroPos]: stackBb, [villainPos]: stackBb } as Record<Position, number>,
    potBb,
    board,
    history: [],
    heroToAct: heroPos,
  };
}

export function usePostflopTraining(options?: { targetStackBb?: number }) {
  const { state, dispatch } = usePostflopSession();
  const [isLoading, setIsLoading] = useState(false);
  const [villainActionLabel, setVillainActionLabel] = useState<string | null>(null);

  // Pre-fetched solver actions for current street (available before user decides)
  const [streetActions, setStreetActions] = useState<SolverActionOutput[]>([]);

  // Store the full 5-card board for street advancement
  const fullBoardRef = useRef<Card[]>([]);
  // Store pre-fetched solver output for use after user decides
  const solverOutputRef = useRef<SolverNodeOutput | null>(null);
  // Track game state for action legality validation
  const gameStateRef = useRef<GameState | null>(null);

  /** Fetch solver output for a given street configuration and store it. */
  const prefetchSolver = useCallback(
    async (street: Street, board: Card[], potBb: number, stackBb: number, heroPosition: 'IP' | 'OOP') => {
      setStreetActions([]);
      const config = buildSolverConfig(street, board, potBb, stackBb, heroPosition);
      const output = await fetchPostflopSolution(config);
      solverOutputRef.current = output;
      setStreetActions(output.actions);
    },
    [],
  );

  const startNewHand = useCallback(() => {
    const spot = generatePostflopHand(options?.targetStackBb);
    fullBoardRef.current = [...spot.board];
    solverOutputRef.current = null;

    // Create game state for the flop
    const flopBoard = spot.board.slice(0, 3);
    const engineSpot = buildSpotFromPostflopState(
      flopBoard, spot.potBb, spot.stackBb, spot.heroPosition,
    );
    gameStateRef.current = createInitialGameState(engineSpot);

    dispatch({
      type: 'START_HAND',
      payload: {
        heroHand: spot.heroHand,
        board: spot.board,
        potBb: spot.potBb,
        stackBb: spot.stackBb,
        heroPosition: spot.heroPosition,
      },
    });
    // Pre-fetch solver output for the flop
    prefetchSolver('FLOP', flopBoard, spot.potBb, spot.stackBb, spot.heroPosition);
  }, [dispatch, prefetchSolver]);

  const handleUserDecision = useCallback(
    async (actionId: string) => {
      // Validate action legality against current game state
      if (gameStateRef.current) {
        const validation = validateActionLegality(actionId, gameStateRef.current);
        if (!validation.legal) {
          console.warn(`[game-rules] Illegal action ${actionId}: ${validation.reason}`);
          // Don't block — solver may use different action IDs. Log and continue.
        }
      }

      dispatch({ type: 'USER_DECIDED', payload: { actionId } });
      setIsLoading(true);

      try {
        // Use pre-fetched solver output (already available from prefetch)
        let output = solverOutputRef.current;
        if (!output) {
          // Fallback: fetch if somehow not pre-fetched
          const config = buildSolverConfig(
            state.currentStreet,
            state.board,
            state.potBb,
            state.stackBb,
            state.heroPosition,
          );
          output = await fetchPostflopSolution(config);
        }

        dispatch({ type: 'SOLVER_OUTPUT', payload: { output } });
        setIsLoading(false);

        // Determine next street
        const nextStreet: Street | null =
          state.currentStreet === 'FLOP' ? 'TURN' :
          state.currentStreet === 'TURN' ? 'RIVER' :
          null;

        // Villain action with delay
        await new Promise((resolve) => setTimeout(resolve, 500));

        const villainAction = sampleVillainAction(output);
        setVillainActionLabel(villainAction);

        await new Promise((resolve) => setTimeout(resolve, 1000));
        setVillainActionLabel(null);

        if (nextStreet !== null) {
          const nextBoardSize = BOARD_SIZE[nextStreet];
          const nextBoard = fullBoardRef.current.slice(0, nextBoardSize);

          // Rebuild GameState for the new street
          const engineSpot = buildSpotFromPostflopState(
            nextBoard, state.potBb, state.stackBb, state.heroPosition,
          );
          gameStateRef.current = createInitialGameState(engineSpot);

          dispatch({ type: 'ADVANCE_STREET', payload: { nextBoard } });
          // Pre-fetch solver for next street
          prefetchSolver(nextStreet, nextBoard, state.potBb, state.stackBb, state.heroPosition);
        } else {
          // River complete -> summary
          dispatch({ type: 'ADVANCE_STREET', payload: { nextBoard: state.board } });
          setStreetActions([]);
        }
      } catch {
        setIsLoading(false);
      }
    },
    [dispatch, state.currentStreet, state.board, state.potBb, state.stackBb, state.heroPosition, prefetchSolver],
  );

  // Compute current legal actions for UI hints
  const legalActions = gameStateRef.current
    ? computeLegalActions(gameStateRef.current)
    : null;

  return {
    startNewHand,
    handleUserDecision,
    isLoading,
    villainActionLabel,
    streetActions,
    legalActions,
  };
}
