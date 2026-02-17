'use client';

// src/lib/postflop/session/postflopSession.ts
// React context, provider, and hook for postflop training session state.

import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from 'react';
import {
  postflopReducer,
  initialPostflopState,
  type PostflopSessionState,
  type PostflopAction,
} from './postflopReducer';

interface PostflopSessionContextValue {
  state: PostflopSessionState;
  dispatch: Dispatch<PostflopAction>;
}

export const PostflopSessionContext = createContext<PostflopSessionContextValue | null>(null);

export function PostflopSessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(postflopReducer, initialPostflopState);

  return (
    <PostflopSessionContext value={{ state, dispatch }}>
      {children}
    </PostflopSessionContext>
  );
}

export function usePostflopSession(): PostflopSessionContextValue {
  const ctx = useContext(PostflopSessionContext);
  if (ctx === null) {
    throw new Error('usePostflopSession must be used within a PostflopSessionProvider');
  }
  return ctx;
}
