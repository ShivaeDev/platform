import { Effect } from "effect";
import { storyKit } from "#storyKit.ts";

// Vitest retries `.fails` stories in the merge queue, so every attempt records its own events.
const attempts: string[][] = [];
let events: string[] = [];
function record(event: string) {
	const current = events;
	current.push(event);
	return Effect.addFinalizer(() => Effect.sync(() => current.push(`${event} closed`)));
}
export const lifetime = storyKit({
	after: {
		*built() {
			yield* record("after");
		},
	},
	around: (effect) =>
		Effect.gen(function* () {
			const current: string[] = [];
			events = current;
			attempts.push(current);
			current.push("enter");
			return yield* effect.pipe(Effect.ensuring(Effect.sync(() => current.push("exit"))));
		}),
	clock: "live",
	*create() {
		yield* record("engine");
		return {};
	},
	name: "lifetime",
	stages: ["built"],
	verbs: () => ({ recordsBody: () => events.push("body") }),
});
export const resource = lifetime.trait("built", "a scoped resource is acquired", function* () {
	yield* record("trait");
});

export function scopedAttempts() {
	return attempts.filter((attempt) => attempt.includes("body"));
}
