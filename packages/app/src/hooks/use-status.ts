/**
 * useStatus — Transient status message lifecycle.
 *
 * Exposes setStatus/clearStatus for React-side callers and owns the
 * auto-clear timer that wipes the message after a short delay. Mount it
 * once near the app root so a single timer governs the status.
 *
 * Command-context callers (which run outside React) dispatch SET_STATUS
 * directly — see utils/clipboard.ts.
 */

import { useCallback, useEffect } from 'react';
import { useAppState, useAppDispatch } from '../state/index.js';

/** How long a status message stays visible before auto-clearing. */
const AUTO_CLEAR_MS = 2000;

interface UseStatusReturn {
  statusMessage: string | null;
  setStatus: (message: string) => void;
  clearStatus: () => void;
}

export function useStatus(): UseStatusReturn {
  const { statusMessage } = useAppState();
  const dispatch = useAppDispatch();

  const setStatus = useCallback(
    (message: string) => dispatch({ type: 'SET_STATUS', message }),
    [dispatch],
  );
  const clearStatus = useCallback(() => dispatch({ type: 'SET_STATUS', message: null }), [dispatch]);

  useEffect(() => {
    if (!statusMessage) return;
    const timer = setTimeout(clearStatus, AUTO_CLEAR_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [statusMessage, clearStatus]);

  return { statusMessage, setStatus, clearStatus };
}
