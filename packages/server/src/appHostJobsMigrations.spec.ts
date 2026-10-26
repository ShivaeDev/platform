import { Cause, Exit, Result } from "effect";
import { expect } from "vitest";
import { migrationHost } from "#test/app-host/migrationStory.ts";
import { withJobsSchema } from "#test/app-host/withJobsSchema.ts";

for (const version of ["missing", "older"] as const) {
	migrationHost.it(
		`waits with a current ledger and ${version} pg-boss until another process migrates`,
		[withJobsSchema(version)],
		function* ({ start, migrate, lifecycle }) {
			const host = yield* start();
			expect(yield* host.next).toEqual({ _tag: "Sleeping", millis: 10 });
			expect(lifecycle()).toEqual([]);
			yield* host.advance("10 millis");
			expect(yield* host.next).toEqual({ _tag: "Sleeping", millis: 10 });
			const exitCode = yield* migrate();
			expect(exitCode).toBe(0);
			yield* host.advance("10 millis");
			expect(yield* host.ping).toBe("pong");
			expect(lifecycle()).toEqual(["started"]);
		},
	);
}

migrationHost.it(
	"check names the pending pg-boss component and its installed and required versions",
	[withJobsSchema("older")],
	function* ({ start }) {
		const host = yield* start({ mode: "check" });
		const exit = yield* host.exit;
		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isFailure(exit)) {
			const error = Cause.findError(exit.cause);
			expect(Result.isSuccess(error) && error.success).toMatchObject({
				_tag: "MigrationError",
				kind: "BadState",
				message: expect.stringMatching(/component pg-boss:.*installed version 45, required version 46/u),
			});
		}
	},
);

migrationHost.it(
	"starts the host and jobs immediately when the ledger and pg-boss are current",
	[withJobsSchema("current")],
	function* ({ start, lifecycle }) {
		const host = yield* start();
		expect(yield* host.next).toEqual({ _tag: "Ready" });
		expect(yield* host.ping).toBe("pong");
		expect(lifecycle()).toEqual(["started"]);
	},
);
