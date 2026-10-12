import { Clock, Effect } from "effect";
import { afterAll, expect } from "vitest";
import { storyKit } from "#storyKit.ts";

// Vitest retries `.fails` stories in the merge queue, so every attempt records its own events.
const attempts: string[][] = [];
let events: string[] = [];
function record(event: string) {
	const current = events;
	current.push(event);
	return Effect.addFinalizer(() => Effect.sync(() => current.push(`${event} closed`)));
}
const kit = storyKit({
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
	verbs: () => ({}),
});
const resource = kit.trait("built", "a scoped resource is acquired", function* () {
	yield* record("trait");
});
kit.it.fails("closes resources after a failed story", [resource], function* () {
	events.push("body");
	expect(yield* Clock.currentTimeMillis).toBeGreaterThan(1_000_000);
	yield* Effect.fail("intentional failure");
});
kit.it("wraps creation, seeding and body and closes scoped resources", [resource], function* () {
	events.push("body");
	expect(yield* Clock.currentTimeMillis).toBeGreaterThan(1_000_000);
});
kit.it(
	"a story can override a live kit with TestClock",
	[],
	function* () {
		expect(yield* Clock.currentTimeMillis).toBe(0);
	},
	{ clock: "test" },
);
afterAll(() => {
	const scoped = attempts.filter((attempt) => attempt.includes("body"));
	expect(scoped.length).toBeGreaterThanOrEqual(2);
	for (const attempt of scoped) {
		expect(attempt).toEqual(["enter", "engine", "trait", "after", "body", "exit", "after closed", "trait closed", "engine closed"]);
	}
});
