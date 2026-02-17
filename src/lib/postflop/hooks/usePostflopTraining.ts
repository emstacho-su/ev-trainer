'use client';

// src/lib/postflop/hooks/usePostflopTraining.ts
// Hook that orchestrates postflop training: hand generation, user decisions,
// solver calls, villain action delays, and street advancement.

import { useState, useCallback, useRef } from 'react';
import { usePostflopSession } from '../session/postflopSession';
import { generatePostflopHand } from '../utils/handGenerator';
import { fetchPostflopSolution } from '../api/postflopApiClient';
import { sampleVillainAction } from '../utils/villainSampler';
import type { PostflopConfig } from '../../solver/postflopSolver';
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
    // CFRConfig fields (not used by mock solver, stubbed for type compliance)
    maxIterations: 100,
    targetExploitability: 0.5,
    checkConvergenceEvery: 10,
    // PostflopConfig fields
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

export function usePostflopTraining() {
  const { state, dispatch } = usePostflopSession();
  const [isLoading, setIsLoading] = useState(false);
  const [villainActionLabel, setVillainActionLabel] = useState<string | null>(null);

  // Store the full 5-card board for street advancement
  const fullBoardRef = useRef<Card[]>([]);

  const startNewHand = useCallback(() => {
    const spot = generatePostflopHand();
    fullBoardRef.current = [...spot.board];
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
  }, [dispatch]);

  const handleUserDecision = useCallback(
    async (actionId: string) => {
      dispatch({ type: 'USER_DECIDED', payload: { actionId } });
      setIsLoading(true);

      try {
        const config = buildSolverConfig(
          state.currentStreet,
          state.board,
          state.potBb,
          state.stackBb,
          state.heroPosition,
        );

        const output = await fetchPostflopSolution(config);
        dispatch({ type: 'SOLVER_OUTPUT', payload: { output } });
        setIsLoading(false);

        // Determine next street's board from full 5-card board
        const nextStreet: Street | null =
          state.currentStreet === 'FLOP' ? 'TURN' :
          state.currentStreet === 'TURN' ? 'RIVER' :
          null;

        // After solver output: villain action with delay
        await new Promise((resolve) => setTimeout(resolve, 500));

        const villainAction = sampleVillainAction(output);
        setVillainActionLabel(villainAction);

        // Show villain action label for 1000ms then advance street
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setVillainActionLabel(null);

        if (nextStreet !== null) {
          const nextBoardSize = BOARD_SIZE[nextStreet];
          const nextBoard = fullBoardRef.current.slice(0, nextBoardSize);
          dispatch({ type: 'ADVANCE_STREET', payload: { nextBoard } });
        } else {
          // River complete -> summary
          dispatch({ type: 'ADVANCE_STREET', payload: { nextBoard: state.board } });
        }
      } catch {
        setIsLoading(false);
      }
    },
    [dispatch, state.currentStreet, state.board, state.potBb, state.stackBb, state.heroPosition],
  );

  return {
    startNewHand,
    handleUserDecision,
    isLoading,
    villainActionLabel,
  };
}
