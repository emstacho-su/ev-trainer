"use client";

import { useState } from "react";
import {
  deleteSession,
  type StorageLike,
  type StorageWarning,
} from "../lib/v2/storage";

export interface DeleteSessionControlProps {
  sessionId: string;
  storage?: StorageLike;
  onDeleted?: (sessionId: string) => void;
  onWarning?: (warning: StorageWarning) => void;
  label?: string;
}

export function DeleteSessionControl({
  sessionId,
  storage,
  onDeleted,
  onWarning,
  label = "Delete session",
}: DeleteSessionControlProps) {
  const [warning, setWarning] = useState<StorageWarning | null>(null);

  const handleDelete = () => {
    const result = deleteSession(sessionId, storage);
    if (result.ok) {
      setWarning(null);
      onDeleted?.(sessionId);
      return;
    }

    setWarning(result.warning);
    onWarning?.(result.warning);
  };

  return (
    <div>
      <button type="button" onClick={handleDelete}>
        {label}
      </button>
      {warning ? (
        <p role="status">Warning: {warning.message}</p>
      ) : null}
    </div>
  );
}
