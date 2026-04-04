import '@testing-library/jest-dom/vitest';
import 'vitest-axe/extend-expect';
import { expect } from 'vitest';
import * as matchers from 'vitest-axe/matchers';

/* Register the toHaveNoViolations matcher from vitest-axe so all test
   files can use expect(await axe(container)).toHaveNoViolations() */
expect.extend(matchers);
