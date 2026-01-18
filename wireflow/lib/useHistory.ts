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

  // Track if we're in the middle of an undo/redo operation
  const isUndoRedoRef = useRef(false);

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

export function useHistoryManager<T>(
  maxLength: number = 100
): HistoryManager<T> {
  const [past, setPast] = useState<T[]>([]);
  const [future, setFuture] = useState<T[]>([]);

  const recordSnapshot = useCallback(
    (state: T) => {
      setPast((prev) => {
        const newPast = [...prev, state];
        if (newPast.length > maxLength) {
          newPast.shift();
        }
        return newPast;
      });
      setFuture([]); // Clear redo stack on new action
    },
    [maxLength]
  );

  const undo = useCallback(
    (currentState: T): T | null => {
      if (past.length === 0) return null;

      const previous = past[past.length - 1];
      setPast((prev) => prev.slice(0, -1));
      setFuture((prev) => [currentState, ...prev]);

      return previous;
    },
    [past]
  );

  const redo = useCallback(
    (currentState: T): T | null => {
      if (future.length === 0) return null;

      const next = future[0];
      setPast((prev) => [...prev, currentState]);
      setFuture((prev) => prev.slice(1));

      return next;
    },
    [future]
  );

  const clear = useCallback(() => {
    setPast([]);
    setFuture([]);
  }, []);

  return {
    recordSnapshot,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    undoCount: past.length,
    redoCount: future.length,
    clear,
  };
}
