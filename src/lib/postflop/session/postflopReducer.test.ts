import { describe, it, expect } from 'vitest';
import {
  postflopReducer,
  initialPostflopState,
  type PostflopSessionState,
  type PostflopAction,
} from './postflopReducer';
import type { SolverNodeOutput } from '../../engine/solverAdapter';
import type { Card } from '../../solver/types';

function makeSolverOutput(actions: { actionId: string; frequency: number; ev: number }[]): SolverNodeOutput {
  return { actions, status: 'ok', units: 'bb' };
}

const heroHand: [Card, Card] = ['Ah', 'Kh'];
const flopBoard: Card[] = ['Qd', 'Js', '2c'];
const turnBoard: Card[] = ['Qd', 'Js', '2c', '7h'];
const riverBoard: Card[] = ['Qd', 'Js', '2c', '7h', '3s'];

const startAction: PostflopAction = {
  type: 'START_HAND',
  payload: { heroHand, board: flopBoard, potBb: 6, stackBb: 97, heroPosition: 'IP' as const },
};

describe('postflopReducer', () => {
  it('has correct initial state', () => {
    expect(initialPostflopState.machineState).toBe('idle');
    expect(initialPostflopState.currentStreet).toBe('FLOP');
    expect(initialPostflopState.board).toEqual([]);
    expect(initialPostflopState.heroHand).toBeNull();
    expect(initialPostflopState.decisions).toEqual({});
    expect(initialPostflopState.deviatedStreet).toBeNull();
    expect(initialPostflopState.summary).toBeNull();
  });

  it('START_HAND transitions to deciding, resets decisions', () => {
    const state = postflopReducer(initialPostflopState, startAction);
    expect(state.machineState).toBe('deciding');
    expect(state.currentStreet).toBe('FLOP');
    expect(state.board).toEqual(flopBoard);
    expect(state.heroHand).toEqual(heroHand);
    expect(state.potBb).toBe(6);
    expect(state.stackBb).toBe(97);
    expect(state.heroPosition).toBe('IP');
    expect(state.decisions).toEqual({});
    expect(state.deviatedStreet).toBeNull();
    expect(state.summary).toBeNull();
  });

  it('USER_DECIDED transitions to evaluating with actionId set', () => {
    const deciding = postflopReducer(initialPostflopState, startAction);
    const state = postflopReducer(deciding, { type: 'USER_DECIDED', payload: { actionId: 'call' } });
    expect(state.machineState).toBe('evaluating');
    expect(state.decisions.FLOP).toBeDefined();
    expect(state.decisions.FLOP!.actionId).toBe('call');
    expect(state.decisions.FLOP!.solverOutput).toBeNull();
    expect(state.decisions.FLOP!.isOnSolverLine).toBe(true);
  });

  it('SOLVER_OUTPUT with matching action: isOnSolverLine=true, no deviatedStreet', () => {
    let state = postflopReducer(initialPostflopState, startAction);
    state = postflopReducer(state, { type: 'USER_DECIDED', payload: { actionId: 'call' } });
    const output = makeSolverOutput([
      { actionId: 'fold', frequency: 0.3, ev: -1 },
      { actionId: 'call', frequency: 0.6, ev: 2 },
      { actionId: 'raise', frequency: 0.1, ev: 1.5 },
    ]);
    state = postflopReducer(state, { type: 'SOLVER_OUTPUT', payload: { output } });
    expect(state.machineState).toBe('advancing');
    expect(state.decisions.FLOP!.solverOutput).toBe(output);
    expect(state.decisions.FLOP!.isOnSolverLine).toBe(true);
    expect(state.deviatedStreet).toBeNull();
  });

  it('SOLVER_OUTPUT with non-matching action: isOnSolverLine=false, deviatedStreet=FLOP', () => {
    let state = postflopReducer(initialPostflopState, startAction);
    state = postflopReducer(state, { type: 'USER_DECIDED', payload: { actionId: 'raise' } });
    const output = makeSolverOutput([
      { actionId: 'fold', frequency: 0.4, ev: -1 },
      { actionId: 'call', frequency: 0.6, ev: 2 },
    ]);
    state = postflopReducer(state, { type: 'SOLVER_OUTPUT', payload: { output } });
    expect(state.machineState).toBe('advancing');
    expect(state.decisions.FLOP!.isOnSolverLine).toBe(false);
    expect(state.deviatedStreet).toBe('FLOP');
  });

  it('ADVANCE_STREET from FLOP: currentStreet=TURN, machineState=deciding', () => {
    let state = postflopReducer(initialPostflopState, startAction);
    state = postflopReducer(state, { type: 'USER_DECIDED', payload: { actionId: 'call' } });
    const output = makeSolverOutput([{ actionId: 'call', frequency: 1.0, ev: 2 }]);
    state = postflopReducer(state, { type: 'SOLVER_OUTPUT', payload: { output } });
    state = postflopReducer(state, { type: 'ADVANCE_STREET', payload: { nextBoard: turnBoard } });
    expect(state.machineState).toBe('deciding');
    expect(state.currentStreet).toBe('TURN');
    expect(state.board).toEqual(turnBoard);
  });

  it('ADVANCE_STREET from RIVER: machineState=summary, summary populated', () => {
    let state = postflopReducer(initialPostflopState, startAction);
    // Flop
    state = postflopReducer(state, { type: 'USER_DECIDED', payload: { actionId: 'call' } });
    state = postflopReducer(state, { type: 'SOLVER_OUTPUT', payload: { output: makeSolverOutput([{ actionId: 'call', frequency: 1.0, ev: 2 }]) } });
    state = postflopReducer(state, { type: 'ADVANCE_STREET', payload: { nextBoard: turnBoard } });
    // Turn
    state = postflopReducer(state, { type: 'USER_DECIDED', payload: { actionId: 'bet' } });
    state = postflopReducer(state, { type: 'SOLVER_OUTPUT', payload: { output: makeSolverOutput([{ actionId: 'bet', frequency: 0.8, ev: 3 }, { actionId: 'check', frequency: 0.2, ev: 1 }]) } });
    state = postflopReducer(state, { type: 'ADVANCE_STREET', payload: { nextBoard: riverBoard } });
    // River
    state = postflopReducer(state, { type: 'USER_DECIDED', payload: { actionId: 'check' } });
    state = postflopReducer(state, { type: 'SOLVER_OUTPUT', payload: { output: makeSolverOutput([{ actionId: 'check', frequency: 0.5, ev: 4 }, { actionId: 'bet', frequency: 0.5, ev: 4 }]) } });
    state = postflopReducer(state, { type: 'ADVANCE_STREET', payload: { nextBoard: riverBoard } });

    expect(state.machineState).toBe('summary');
    expect(state.summary).not.toBeNull();
    expect(state.summary!.deviatedStreet).toBeNull();
    expect(state.summary!.decisions.FLOP).toBeDefined();
    expect(state.summary!.decisions.TURN).toBeDefined();
    expect(state.summary!.decisions.RIVER).toBeDefined();
    expect(state.summary!.completedAt).toBeDefined();
  });

  it('Deviation on FLOP: deviatedStreet persists through TURN and RIVER', () => {
    let state = postflopReducer(initialPostflopState, startAction);
    // Flop - deviate
    state = postflopReducer(state, { type: 'USER_DECIDED', payload: { actionId: 'raise' } });
    state = postflopReducer(state, { type: 'SOLVER_OUTPUT', payload: { output: makeSolverOutput([{ actionId: 'call', frequency: 0.7, ev: 2 }, { actionId: 'fold', frequency: 0.3, ev: -1 }]) } });
    expect(state.deviatedStreet).toBe('FLOP');

    state = postflopReducer(state, { type: 'ADVANCE_STREET', payload: { nextBoard: turnBoard } });
    // Turn - even matching action, deviatedStreet persists
    state = postflopReducer(state, { type: 'USER_DECIDED', payload: { actionId: 'bet' } });
    state = postflopReducer(state, { type: 'SOLVER_OUTPUT', payload: { output: makeSolverOutput([{ actionId: 'bet', frequency: 0.9, ev: 3 }, { actionId: 'check', frequency: 0.1, ev: 1 }]) } });
    expect(state.deviatedStreet).toBe('FLOP'); // still FLOP

    state = postflopReducer(state, { type: 'ADVANCE_STREET', payload: { nextBoard: riverBoard } });
    // River
    state = postflopReducer(state, { type: 'USER_DECIDED', payload: { actionId: 'check' } });
    state = postflopReducer(state, { type: 'SOLVER_OUTPUT', payload: { output: makeSolverOutput([{ actionId: 'check', frequency: 0.5, ev: 4 }, { actionId: 'bet', frequency: 0.5, ev: 4 }]) } });
    expect(state.deviatedStreet).toBe('FLOP'); // still FLOP

    state = postflopReducer(state, { type: 'ADVANCE_STREET', payload: { nextBoard: riverBoard } });
    expect(state.machineState).toBe('summary');
    expect(state.summary!.deviatedStreet).toBe('FLOP');
  });

  it('RESET returns to idle state', () => {
    let state = postflopReducer(initialPostflopState, startAction);
    state = postflopReducer(state, { type: 'USER_DECIDED', payload: { actionId: 'call' } });
    state = postflopReducer(state, { type: 'RESET' });
    expect(state).toEqual(initialPostflopState);
  });

  it('SOLVER_OUTPUT with action frequency <= 0.01 counts as non-matching', () => {
    let state = postflopReducer(initialPostflopState, startAction);
    state = postflopReducer(state, { type: 'USER_DECIDED', payload: { actionId: 'raise' } });
    const output = makeSolverOutput([
      { actionId: 'fold', frequency: 0.49, ev: -1 },
      { actionId: 'call', frequency: 0.5, ev: 2 },
      { actionId: 'raise', frequency: 0.01, ev: 1.5 },
    ]);
    state = postflopReducer(state, { type: 'SOLVER_OUTPUT', payload: { output } });
    expect(state.decisions.FLOP!.isOnSolverLine).toBe(false);
    expect(state.deviatedStreet).toBe('FLOP');
  });
});
