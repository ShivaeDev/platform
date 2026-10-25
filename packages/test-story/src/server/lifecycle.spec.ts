import { Clock, Effect } from "effect";
import { afterAll, expect } from "vitest";
import { lifetime, resource, scopedAttempts } from "#test/lifetime.ts";

lifetime.it.fails("closes resources after a failed story", [resource], function* ({ recordsBody }) {
	recordsBody();
	expect(yield* Clock.currentTimeMillis).toBeGreaterThan(1_000_000);
	yield* Effect.fail("intentional failure");
});
lifetime.it("wraps creation, seeding and body and closes scoped resources", [resource], function* ({ recordsBody }) {
	recordsBody();
	expect(yield* Clock.currentTimeMillis).toBeGreaterThan(1_000_000);
});
lifetime.it(
	"a story can override a live kit with TestClock",
	[],
	function* () {
		expect(yield* Clock.currentTimeMillis).toBe(0);
	},
	{ clock: "test" },
);
afterAll(() => {
	const scoped = scopedAttempts();
	expect(scoped.length).toBeGreaterThanOrEqual(2);
	for (const attempt of scoped) {
		expect(attempt).toEqual(["enter", "engine", "trait", "after", "body", "exit", "after closed", "trait closed", "engine closed"]);
	}
});
