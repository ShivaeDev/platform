import { Effect } from "effect";
import { expect } from "vitest";
import { boss } from "#test/boss.ts";
import { connectionErrors, connectionFailure } from "#test/connectionErrors.ts";

for (const phase of ["start", "stop", "failed start"] as const) {
	boss.it(`observes connection termination during ${phase} and after shutdown`, [connectionErrors(phase)], function* ({ boot, events, logs }) {
		const result = yield* boot([]).pipe(
			Effect.tap((runtime) => runtime.stop),
			Effect.exit,
		);
		expect(result._tag).toBe(phase === "failed start" ? "Failure" : "Success");
		expect(logs).toContainEqual({
			logLevel: "Debug",
			message: [{ event: "pg_boss_error", message: "terminating connection due to administrator command: password=<redacted>" }],
		});
		expect(() => events.emit("error", connectionFailure)).not.toThrow();
	});
}
