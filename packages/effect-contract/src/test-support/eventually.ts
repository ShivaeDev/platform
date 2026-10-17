import { Effect } from "effect";
import { vi } from "vitest";

export function eventually(check: () => void) {
	return Effect.promise(() => vi.waitFor(check));
}
