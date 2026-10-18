import { Effect } from "effect";
import { expect } from "vitest";
import { poolRecovery } from "#test-support/poolRecovery.ts";

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

poolRecovery.it(
	"keeps the host SQL client usable after idle termination and preserves active query failures",
	[],
	function* ({ nativeBackend, nativeQueryFailure, terminate }) {
		const previous = yield* nativeBackend();
		yield* terminate(previous);
		expect(yield* nativeBackend()).not.toBe(previous);
		expect(yield* nativeQueryFailure()).toMatchObject({ _tag: "SqlError" });
		expect(yield* nativeBackend()).toBeTypeOf("number");
	},
);
