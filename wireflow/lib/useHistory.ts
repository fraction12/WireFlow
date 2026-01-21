import { useState, useCallback, useRef } from "react";

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

  // Use a ref to track the current history state synchronously.
  // This prevents race conditions where setHistoryState's callback
  // hasn't executed yet when we try to return the undo/redo result.
  const historyRef = useRef<HistoryManagerState<T>>({
    past: [],
    future: [],
  });

  const recordSnapshot = useCallback(
    (state: T) => {
      const newPast = [...historyRef.current.past, state];
      if (newPast.length > maxLength) {
        newPast.shift();
      }
      const newState = {
        past: newPast,
        future: [], // Clear redo stack on new action
      };
      historyRef.current = newState;
      setHistoryState(newState);
    },
    [maxLength]
  );

  // undo and redo use the ref to read current state synchronously,
  // avoiding the race condition where setHistoryState's callback
  // hasn't executed yet when returning the result.
  const undo = useCallback(
    (currentState: T): T | null => {
      const current = historyRef.current;
      if (current.past.length === 0) {
        return null;
      }

      const previous = current.past[current.past.length - 1];
      const newState = {
        past: current.past.slice(0, -1),
        future: [currentState, ...current.future],
      };
      historyRef.current = newState;
      setHistoryState(newState);

      return previous;
    },
    []
  );

  const redo = useCallback(
    (currentState: T): T | null => {
      const current = historyRef.current;
      if (current.future.length === 0) {
        return null;
      }

      const next = current.future[0];
      const newState = {
        past: [...current.past, currentState],
        future: current.future.slice(1),
      };
      historyRef.current = newState;
      setHistoryState(newState);

      return next;
    },
    []
  );

  const clear = useCallback(() => {
    const newState = { past: [], future: [] };
    historyRef.current = newState;
    setHistoryState(newState);
  }, []);

  return {
    recordSnapshot,
    undo,
    redo,
    canUndo: historyState.past.length > 0,
    canRedo: historyState.future.length > 0,
    undoCount: historyState.past.length,
    redoCount: historyState.future.length,
    clear,
  };
}
