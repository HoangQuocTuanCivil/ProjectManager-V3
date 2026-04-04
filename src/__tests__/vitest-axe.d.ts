import type { AxeResults } from "axe-core";

/*
 * Augment vitest's Assertion interface to include the toHaveNoViolations
 * matcher provided by vitest-axe. This enables type-safe usage of
 * expect(await axe(container)).toHaveNoViolations() in test files.
 */
declare module "vitest" {
  interface Assertion<T = AxeResults> {
    toHaveNoViolations(): T;
  }
}
