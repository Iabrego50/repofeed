import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type DeckSelectionValue = {
  selected: ReadonlySet<string>;
  count: number;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  clear: () => void;
};

const DeckSelectionContext = createContext<DeckSelectionValue | null>(null);

/** Tracks which insights a share/demo viewer has queued for a PowerPoint deck. */
export function DeckSelectionProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  const value = useMemo<DeckSelectionValue>(
    () => ({
      selected,
      count: selected.size,
      isSelected: (id: string) => selected.has(id),
      toggle,
      clear,
    }),
    [selected, toggle, clear],
  );

  return createElement(DeckSelectionContext.Provider, { value }, children);
}

export function useDeckSelection(): DeckSelectionValue | null {
  return useContext(DeckSelectionContext);
}

export function useRequiredDeckSelection(): DeckSelectionValue {
  const value = useDeckSelection();
  if (!value) throw new Error("useRequiredDeckSelection must be used within DeckSelectionProvider");
  return value;
}
