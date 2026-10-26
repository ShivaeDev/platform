import { Effect } from "effect";
import { expect } from "vitest";
import { poolRecovery } from "#test/poolRecovery.ts";

poolRecovery.it("replaces a terminated idle pg-boss connection and logs it at debug", [], function* ({ bossBackend, terminate, logs }) {
	const previous = yield* bossBackend();
	yield* terminate(previous);
	yield* Effect.promise(() =>
		expect
			.poll(logs)
			.toContainEqual({ level: "Debug", message: [{ event: "pg_boss_error", message: "terminating connection due to administrator command" }] }),
	);
	expect(yield* bossBackend()).not.toBe(previous);
	expect(logs().every(({ level }) => level === "Debug")).toBe(true);
});
