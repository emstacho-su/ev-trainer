export interface StorageLike {
  readonly length: number;
  clear(): void;
  getItem(key: string): string | null;
  key(index: number): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

export function getBrowserStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  if (!window.localStorage) return null;
  return window.localStorage;
}
