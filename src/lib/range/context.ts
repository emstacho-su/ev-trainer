// src/lib/range/context.ts

"use client";

import { createContext } from "react";
import type { EquityCategory, RangeActionType } from "./types";

export interface RangeContextValue {
  selectedAction: RangeActionType | null;
  setSelectedAction: (action: RangeActionType | null) => void;
  selectedEquityCategory: EquityCategory | null;
  setSelectedEquityCategory: (category: EquityCategory | null) => void;
}

export const RangeContext = createContext<RangeContextValue>({
  selectedAction: null,
  setSelectedAction: () => {},
  selectedEquityCategory: null,
  setSelectedEquityCategory: () => {},
});
