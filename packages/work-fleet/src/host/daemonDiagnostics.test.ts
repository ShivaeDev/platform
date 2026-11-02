import { Effect } from "effect";
import { expect } from "vitest";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { fleetDaemon } from "#test/daemonStory.ts";
import { approvedWork, storedWork } from "#test/hostStory.ts";

fleetDaemon.it("Fleet store failures reach HTTP RPC clients as ServiceUnavailable", [], function* (daemon) {
	const failure = yield* daemon.unavailableFleetItems();
	expect(failure).toBeInstanceOf(ServiceUnavailable);
	expect(failure.message).toBe("The integration is unavailable; inspect runtime diagnostics");
});

fleetDaemon.it("a brief the engine cannot read is unavailable through diagnostics", [], function* (daemon) {
	const failure = yield* daemon.briefDiagnostics("missing", daemon.boardPath("missing.md")).pipe(Effect.flip);
	expect(failure).toBeInstanceOf(ServiceUnavailable);
});

fleetDaemon.it("an accepted brief has no refusal through diagnostics", [approvedWork(["one"])], function* (daemon) {
	expect(yield* daemon.briefDiagnostics("one", daemon.boardPath("one.md"))).toEqual([]);
});

fleetDaemon.it(
	"a delivered id still returns its refusal through diagnostics",
	[approvedWork(["one"]), storedWork("one", "done")],
	function* (daemon) {
		const sourcePath = daemon.boardPath("one.md");
		expect(yield* daemon.briefDiagnostics("one", sourcePath)).toEqual([
			{ message: "id one was delivered in the done record for one; give this brief a new id", sourcePath, workId: "one" },
		]);
	},
);
