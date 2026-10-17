import { Effect } from "effect";
import { vi } from "vitest";

export function eventually(check: () => void, timeout?: number) {
	return Effect.promise(() => vi.waitFor(check, timeout));
}
