"use client";

import { useState } from "react";
import {
  clearAllSessions,
  type StorageLike,
  type StorageWarning,
} from "../lib/v2/storage";

export interface ClearAllSessionsControlProps {
  storage?: StorageLike;
  onCleared?: () => void;
  onWarning?: (warning: StorageWarning) => void;
  label?: string;
}

export function ClearAllSessionsControl({
  storage,
  onCleared,
  onWarning,
  label = "Clear all sessions",
}: ClearAllSessionsControlProps) {
  const [warning, setWarning] = useState<StorageWarning | null>(null);

  const handleClearAll = () => {
    const result = clearAllSessions(storage);
    if (result.ok) {
      setWarning(null);
      onCleared?.();
      return;
    }

    setWarning(result.warning);
    onWarning?.(result.warning);
  };

  return (
    <div>
      <button type="button" onClick={handleClearAll}>
        {label}
      </button>
      {warning ? (
        <p role="status">Warning: {warning.message}</p>
      ) : null}
    </div>
  );
}
