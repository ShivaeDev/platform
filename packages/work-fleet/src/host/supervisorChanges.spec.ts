import { expect } from "@effect/vitest";
import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { fleetSupervisor, loadedCodeFixture } from "#test/supervisorStory.ts";

fleetSupervisor.it(
	"changing an unimported dependency leaves both supervised processes running",
	[loadedCodeFixture],
	function* (fleet) {
		yield* fleet.start();
		yield* fleet.ready("daemon");
		yield* fleet.ready("board");
		yield* fleet.codeSettled("daemon");
		yield* fleet.codeSettled("board");
		const before = yield* fleet.running();
		expect(before.daemon.restarts).toBe(0);

		yield* fleet.editCode("unrelated");
		yield* fleet.codeSettled("daemon");
		yield* fleet.codeSettled("board");

		expect(yield* fleet.state()).toEqual(before);
	},
	60_000,
);

for (const kind of ["loaded", "burst"] as const) {
	fleetSupervisor.it(
		kind === "loaded"
			? "changing a loaded response module restarts only the daemon exactly once and serves the new response"
			: "a merge replacing many loaded modules restarts only the daemon exactly once and serves the new response",
		[loadedCodeFixture],
		function* (fleet) {
			yield* fleet.start();
			yield* fleet.ready("daemon");
			yield* fleet.ready("board");
			yield* fleet.codeSettled("daemon");
			const before = yield* fleet.running();
			expect((yield* fleet.request(before, "daemon")).status).toBe(HttpStatus.fromLiteral("NoContent"));

			yield* fleet.editCode(kind);
			yield* fleet.ready("daemon", before.daemon.pid);
			yield* fleet.codeSettled("daemon");

			const after = yield* fleet.running();
			yield* outcomes([
				["board process", () => fleet.state().pipe(Effect.map((state) => state?.board)), before.board],
				["daemon response", () => fleet.request(after, "daemon").pipe(Effect.map(({ status }) => status)), HttpStatus.fromLiteral("Created")],
				["daemon restarts", () => fleet.state().pipe(Effect.map((state) => state?.daemon.restarts)), before.daemon.restarts + 1],
				["replacement daemon", () => fleet.runningPid("daemon").pipe(Effect.map((pid) => pid !== before.daemon.pid)), true],
			]);
		},
		60_000,
	);
}
