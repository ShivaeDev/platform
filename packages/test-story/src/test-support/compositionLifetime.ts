import { Effect } from "effect";

export const compositionEvents: string[] = [];

export function recordComposition(event: string) {
	compositionEvents.push(event);
	return Effect.addFinalizer(() => Effect.sync(() => compositionEvents.push(`${event} closed`)));
}
