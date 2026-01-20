import { useState, useCallback } from "react";

export interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

export interface UseHistoryOptions {
  maxHistoryLength?: number;
}

export interface UseHistoryReturn<T> {
  state: T;
  setState: (newState: T | ((prev: T) => T), recordHistory?: boolean) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  clearHistory: () => void;
}

/**
 * Custom hook for managing state with undo/redo history.
 * Provides a familiar setState API while tracking history for undo/redo operations.
 *
 * @param initialState - The initial state value
 * @param options - Configuration options (maxHistoryLength)
 * @returns Object with state, setState, undo, redo, and history status
 */
export function useHistory<T>(
  initialState: T,
  options: UseHistoryOptions = {}
): UseHistoryReturn<T> {
  const { maxHistoryLength = 100 } = options;

  const [history, setHistory] = useState<HistoryState<T>>({
    past: [],
    present: initialState,
    future: [],
  });

  const setState = useCallback(
    (newState: T | ((prev: T) => T), recordHistory: boolean = true) => {
      setHistory((currentHistory) => {
        const resolvedState =
          typeof newState === "function"
            ? (newState as (prev: T) => T)(currentHistory.present)
            : newState;

        // If not recording history (e.g., during drag operations), just update present
        if (!recordHistory) {
          return {
            ...currentHistory,
            present: resolvedState,
          };
        }

        // Create new history entry
        const newPast = [...currentHistory.past, currentHistory.present];

        // Trim history if it exceeds max length
        if (newPast.length > maxHistoryLength) {
          newPast.shift();
        }

        return {
          past: newPast,
          present: resolvedState,
          future: [], // Clear future on new action
        };
      });
    },
    [maxHistoryLength]
  );

  const undo = useCallback(() => {
    setHistory((currentHistory) => {
      if (currentHistory.past.length === 0) {
        return currentHistory;
      }

      const previous = currentHistory.past[currentHistory.past.length - 1];
      const newPast = currentHistory.past.slice(0, -1);

      return {
        past: newPast,
        present: previous,
        future: [currentHistory.present, ...currentHistory.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((currentHistory) => {
      if (currentHistory.future.length === 0) {
        return currentHistory;
      }

      const next = currentHistory.future[0];
      const newFuture = currentHistory.future.slice(1);

      return {
        past: [...currentHistory.past, currentHistory.present],
        present: next,
        future: newFuture,
      };
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory((currentHistory) => ({
      past: [],
      present: currentHistory.present,
      future: [],
    }));
  }, []);

  return {
    state: history.present,
    setState,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    clearHistory,
  };
}

/**
 * A simpler history hook that tracks state externally.
 * Useful when you need more control over when to record snapshots.
 *
 * Uses a single state object to ensure atomic updates and prevent
 * race conditions during rapid undo/redo operations.
 */
export interface HistoryManager<T> {
  recordSnapshot: (state: T) => void;
  undo: (currentState: T) => T | null;
  redo: (currentState: T) => T | null;
  canUndo: boolean;
  canRedo: boolean;
  undoCount: number;
  redoCount: number;
  clear: () => void;
}

interface HistoryManagerState<T> {
  past: T[];
  future: T[];
}

export function useHistoryManager<T>(
  maxLength: number = 100
): HistoryManager<T> {
  const [historyState, setHistoryState] = useState<HistoryManagerState<T>>({
    past: [],
    future: [],
  });

  const recordSnapshot = useCallback(
    (state: T) => {
      setHistoryState((prev) => {
        const newPast = [...prev.past, state];
        if (newPast.length > maxLength) {
          newPast.shift();
        }
        return {
          past: newPast,
          future: [], // Clear redo stack on new action
        };
      });
    },
    [maxLength]
  );

  // undo and redo use refs to avoid stale closure issues
  // The actual state check happens inside the caller after receiving null/value
  const undoRef = useCallback(
    (currentState: T): T | null => {
      let result: T | null = null;

      setHistoryState((prev) => {
        if (prev.past.length === 0) {
          return prev; // No change, return same reference
        }

        const previous = prev.past[prev.past.length - 1];
        result = previous;

        return {
          past: prev.past.slice(0, -1),
          future: [currentState, ...prev.future],
        };
      });

      return result;
    },
    []
  );

  const redoRef = useCallback(
    (currentState: T): T | null => {
      let result: T | null = null;

      setHistoryState((prev) => {
        if (prev.future.length === 0) {
          return prev; // No change, return same reference
        }

        const next = prev.future[0];
        result = next;

        return {
          past: [...prev.past, currentState],
          future: prev.future.slice(1),
        };
      });

      return result;
    },
    []
  );

  const clear = useCallback(() => {
    setHistoryState({ past: [], future: [] });
  }, []);

  return {
    recordSnapshot,
    undo: undoRef,
    redo: redoRef,
    canUndo: historyState.past.length > 0,
    canRedo: historyState.future.length > 0,
    undoCount: historyState.past.length,
    redoCount: historyState.future.length,
    clear,
  };
}
