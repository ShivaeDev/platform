import { Effect } from "effect";
import { expect } from "vitest";
import { boss } from "#test/boss.ts";
import { connectionErrors, connectionFailure } from "#test/connectionErrors.ts";

for (const phase of ["failed stop", "pool kept open", "failed startup cleanup"] as const) {
	boss.it(`still observes idle errors after ${phase}`, [connectionErrors(phase)], function* ({ boot, events, logs }) {
		const result = yield* boot([], phase === "pool kept open" ? { stop: { close: false } } : {}).pipe(
			Effect.tap((runtime) => runtime.stop),
			Effect.exit,
		);
		expect(result._tag).toBe(phase === "failed startup cleanup" ? "Failure" : "Success");
		expect(() => events.emit("error", connectionFailure)).not.toThrow();
		expect(logs).toContainEqual({ logLevel: "Debug", message: [{ event: "pg_boss_error", message: connectionFailure.message }] });
		expect(events.listeners("error")).toEqual([expect.any(Function)]);
	});
}
