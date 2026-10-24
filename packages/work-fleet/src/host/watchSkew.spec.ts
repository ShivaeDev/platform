import { expect } from "@effect/vitest";
import { fleetDaemon } from "#test/daemonStory.ts";

fleetDaemon.it("follow prints unfamiliar codes, stages and malformed entries beside known ones and continues", [], function* (daemon) {
	const port = yield* daemon.wireServer();
	yield* daemon.follow("watch", [], { follow: true, port });
	yield* daemon.awaitWire();
	daemon.sendWire([
		{ decision: { code: "future-decision", reason: "New decision" }, futureField: { value: true }, stage: "waiting", workId: "new" },
		{ decision: { code: "worker-question", reason: "Known decision" }, stage: "waiting", workId: "known" },
		{ futureField: true, stage: "future-step", workId: "future" },
		{ decision: { reason: 42 }, stage: "waiting", workId: "malformed" },
	]);
	yield* daemon.awaitOutput("known waiting (waiting on orchestrator): Known decision\n");
	yield* daemon.awaitOutput("new waiting (waiting on orchestrator): New decision: future-decision\n");
	yield* daemon.awaitOutput("future future-step\n");
	yield* daemon.awaitOutput('malformed waiting: {"decision":{"reason":42},"stage":"waiting","workId":"malformed"}\n');
	daemon.sendWire([{ stage: "done", workId: "later" }]);
	yield* daemon.awaitOutput("later done\n");
	expect(daemon.isRunning()).toBe(true);
});

fleetDaemon.it("a fatal follow error exits non-zero with one cause line", [], function* (daemon) {
	const port = yield* daemon.wireServer();
	yield* daemon.follow("watch", [], { follow: true, port });
	yield* daemon.awaitWire();
	daemon.failWire("Synthetic subscription failure\nInspect the daemon");
	expect(yield* daemon.exit()).toEqual({
		code: 1,
		stderr: "work-fleet: Synthetic subscription failure Inspect the daemon",
		stdout: "",
	});
});
