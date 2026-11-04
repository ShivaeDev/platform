import { Effect } from "effect";
import type { RateLimits } from "#rateLimits.ts";

export function observations({ rates }: { readonly apiUrl: string; readonly rates: RateLimits }) {
	return () => Effect.sync(() => [...rates.observations.values()]);
}
