import { useState, useCallback, useRef } from "react";

export function useMultiSelect<T extends { id: string }>(items: T[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const lastClickedRef = useRef<number>(-1);

  const toggle = useCallback(
    (id: string, index: number, shiftKey: boolean) => {
      setSelected((prev) => {
        const next = new Set(prev);

        if (shiftKey && lastClickedRef.current >= 0) {
          const start = Math.min(lastClickedRef.current, index);
          const end = Math.max(lastClickedRef.current, index);
          for (let i = start; i <= end; i++) {
            next.add(items[i].id);
          }
        } else {
          if (next.has(id)) next.delete(id);
          else next.add(id);
        }

        lastClickedRef.current = index;
        return next;
      });
    },
    [items],
  );

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      if (prev.size === items.length) return new Set();
      return new Set(items.map((i) => i.id));
    });
  }, [items]);

  const clear = useCallback(() => {
    setSelected(new Set());
    lastClickedRef.current = -1;
  }, []);

  const isAllSelected = items.length > 0 && selected.size === items.length;
  const isPartial = selected.size > 0 && selected.size < items.length;

  return { selected, toggle, toggleAll, clear, isAllSelected, isPartial };
}
