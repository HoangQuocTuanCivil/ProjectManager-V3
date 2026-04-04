import { useState, useEffect } from "react";

/**
 * Debounce a value by the given delay (ms).
 * Returns the debounced value that updates only after the delay has passed
 * since the last change to the input value.
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
