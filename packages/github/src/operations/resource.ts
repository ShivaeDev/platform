import { Effect } from "effect";
import type { RateLimits } from "#rateLimits.ts";

export function resource({ apiUrl, rates }: { readonly apiUrl: string; readonly rates: RateLimits }) {
	return (path: string) => Effect.sync(() => rates.resource(new URL(path, apiUrl).pathname));
}
