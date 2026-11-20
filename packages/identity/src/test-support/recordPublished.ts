import { Effect } from "effect";
import type { Observation } from "@shivaedev/changes/observe.ts";

export function recordPublished(published: unknown[]) {
	return (event: Observation<unknown>) =>
		Effect.sync(() => {
			if (event._tag === "Published") {
				published.push(...event.changes);
			}
		});
}
