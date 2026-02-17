/**
 * Overview: Custom React hook for trainer configuration state management.
 * Interacts with: localStorage persistence (fast, local) and /api/config (cross-device sync).
 * Importance: Single entry point for config state with auto-save and optional server sync.
 *
 * Combines client-side persistence (localStorage, instant) with server-side sync
 * (/api/config, cross-device) for authenticated users. Client-side is always primary
 * for responsiveness; server sync is fire-and-forget.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { TrainerConfig } from "../config/types";
import { loadConfigFromStorage, saveConfigToStorage } from "../config/configStore";
import { validateConfig } from "../config/validation";

const DEBOUNCE_MS = 500;
const API_CONFIG_PATH = "/api/config";

/**
 * Hook for trainer configuration with localStorage persistence and optional server sync.
 *
 * @param userId - If provided, enables server-side sync for cross-device persistence.
 *                 Pass undefined/null for guest users (localStorage only).
 *
 * @returns Object with:
 *   - config: Current TrainerConfig (null during initial load)
 *   - updateConfig: Merge partial updates into current config
 *   - isLoading: True during initial config load
 */
export function useTrainerConfig(userId?: string) {
  const [config, setConfig] = useState<TrainerConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoadRef = useRef(true);

  // Load config on mount
  useEffect(() => {
    const localConfig = loadConfigFromStorage();
    setConfig(localConfig);
    setIsLoading(false);

    // If authenticated, fetch server config and merge (server takes precedence)
    if (userId) {
      void (async () => {
        try {
          const res = await fetch(API_CONFIG_PATH, {
            headers: { Authorization: `Bearer ${getAccessToken()}` },
          });
          if (res.ok) {
            const serverData = await res.json();
            const serverConfig = validateConfig(serverData);
            if (serverConfig) {
              setConfig(serverConfig);
              saveConfigToStorage(serverConfig);
            }
          }
        } catch (error) {
          // Server sync failed - local config is fine
          console.warn("Failed to fetch server config:", error);
        } finally {
          isInitialLoadRef.current = false;
        }
      })();
    } else {
      isInitialLoadRef.current = false;
    }
  }, [userId]);

  // Debounced auto-save on config changes (skip initial load)
  useEffect(() => {
    if (!config || isInitialLoadRef.current) {
      return;
    }

    // Clear existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      // Save to localStorage
      saveConfigToStorage(config);

      // Sync to server if authenticated
      if (userId) {
        void (async () => {
          try {
            await fetch(API_CONFIG_PATH, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${getAccessToken()}`,
              },
              body: JSON.stringify(config),
            });
          } catch (error) {
            console.warn("Failed to sync config to server:", error);
          }
        })();
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [config, userId]);

  const updateConfig = useCallback((updates: Partial<TrainerConfig>) => {
    setConfig((prev) => {
      if (!prev) return prev;
      return { ...prev, ...updates };
    });
  }, []);

  return { config, updateConfig, isLoading };
}

/**
 * Get the current access token from wherever it's stored.
 * This is a placeholder that integrates with the auth system.
 */
function getAccessToken(): string {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem("access_token") ?? "";
}
