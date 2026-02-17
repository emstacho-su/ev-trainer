// src/lib/postflop/session/postflopReducer.ts
// Pure reducer for postflop training session state machine.
// Manages Flop -> Turn -> River progression with deviation tracking.

import type { Card } from '../../solver/types';
import type { SolverNodeOutput } from '../../engine/solverAdapter';
import type { Street, PostflopMachineState, StreetDecision, HandSummaryData } from '../types';

/** Frequency threshold — actions at or below this are considered not part of solver strategy. */
const FREQ_THRESHOLD = 0.01;

/** Next street mapping. */
const NEXT_STREET: Record<Street, Street | null> = {
  FLOP: 'TURN',
  TURN: 'RIVER',
  RIVER: null,
};

// ── State ──────────────────────────────────────────────────────────────

export interface PostflopSessionState {
  machineState: PostflopMachineState;
  currentStreet: Street;
  board: Card[];
  heroHand: [Card, Card] | null;
  potBb: number;
  stackBb: number;
  heroPosition: 'IP' | 'OOP';
  decisions: Partial<Record<Street, StreetDecision>>;
  deviatedStreet: Street | null;
  summary: HandSummaryData | null;
}

export const initialPostflopState: PostflopSessionState = {
  machineState: 'idle',
  currentStreet: 'FLOP',
  board: [],
  heroHand: null,
  potBb: 0,
  stackBb: 0,
  heroPosition: 'IP',
  decisions: {},
  deviatedStreet: null,
  summary: null,
};

// ── Actions ────────────────────────────────────────────────────────────

type StartHandAction = {
  type: 'START_HAND';
  payload: {
    heroHand: [Card, Card];
    board: Card[];
    potBb: number;
    stackBb: number;
    heroPosition: 'IP' | 'OOP';
  };
};

type UserDecidedAction = {
  type: 'USER_DECIDED';
  payload: { actionId: string };
};

type SolverOutputAction = {
  type: 'SOLVER_OUTPUT';
  payload: { output: SolverNodeOutput };
};

type AdvanceStreetAction = {
  type: 'ADVANCE_STREET';
  payload: { nextBoard: Card[] };
};

type ResetAction = {
  type: 'RESET';
};

export type PostflopAction =
  | StartHandAction
  | UserDecidedAction
  | SolverOutputAction
  | AdvanceStreetAction
  | ResetAction;

// ── Reducer ────────────────────────────────────────────────────────────

export function postflopReducer(
  state: PostflopSessionState,
  action: PostflopAction,
): PostflopSessionState {
  switch (action.type) {
    case 'START_HAND': {
      const { heroHand, board, potBb, stackBb, heroPosition } = action.payload;
      return {
        ...initialPostflopState,
        machineState: 'deciding',
        currentStreet: 'FLOP',
        board: board.slice(0, 3),
        heroHand,
        potBb,
        stackBb,
        heroPosition,
      };
    }

    case 'USER_DECIDED': {
      const { actionId } = action.payload;
      const decision: StreetDecision = {
        actionId,
        solverOutput: null,
        isOnSolverLine: true,
      };
      return {
        ...state,
        machineState: 'evaluating',
        decisions: { ...state.decisions, [state.currentStreet]: decision },
      };
    }

    case 'SOLVER_OUTPUT': {
      const { output } = action.payload;
      const currentDecision = state.decisions[state.currentStreet];
      if (!currentDecision) return state;

      const userAction = currentDecision.actionId;
      const matchingSolverAction = output.actions.find(
        (a) => a.actionId === userAction && a.frequency > FREQ_THRESHOLD,
      );
      const isOnSolverLine = matchingSolverAction !== undefined;

      const updatedDecision: StreetDecision = {
        ...currentDecision,
        solverOutput: output,
        isOnSolverLine,
      };

      const deviatedStreet =
        !isOnSolverLine && state.deviatedStreet === null
          ? state.currentStreet
          : state.deviatedStreet;

      return {
        ...state,
        machineState: 'advancing',
        decisions: { ...state.decisions, [state.currentStreet]: updatedDecision },
        deviatedStreet,
      };
    }

    case 'ADVANCE_STREET': {
      const { nextBoard } = action.payload;
      const nextStreet = NEXT_STREET[state.currentStreet];

      if (nextStreet === null) {
        // River complete — build summary
        const summary: HandSummaryData = {
          spot: {
            heroHand: state.heroHand!,
            board: state.board,
            potBb: state.potBb,
            stackBb: state.stackBb,
            heroPosition: state.heroPosition,
            villainPosition: state.heroPosition === 'IP' ? 'OOP' : 'IP',
            preflopHistory: '',
          },
          decisions: { ...state.decisions },
          deviatedStreet: state.deviatedStreet,
          completedAt: new Date().toISOString(),
        };
        return {
          ...state,
          machineState: 'summary',
          summary,
        };
      }

      return {
        ...state,
        machineState: 'deciding',
        currentStreet: nextStreet,
        board: nextBoard,
      };
    }

    case 'RESET':
      return { ...initialPostflopState };

    default:
      return state;
  }
}
