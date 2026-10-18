import { expect } from "@effect/vitest";
import { daemonIsStopped, fleetDaemon } from "#test/daemonStory.ts";

fleetDaemon.it("watch without --port discovers the daemon's bound port and receives a live transition", [], function* (daemon) {
	expect(daemon.port()).not.toBe(3457);
	yield* daemon.watch();
	yield* daemon.awaitSnapshot();
	yield* daemon.transition("one", "completed");
	yield* daemon.awaitOutput("one completed\n");
	expect(daemon.output()).toBe("one completed\n");
	expect(daemon.errors()).toBe("");
});

fleetDaemon.it(
	"watch without --port repeats an error on each unreachable retry and discovers a restarted daemon on a new port",
	[daemonIsStopped()],
	function* (daemon) {
		yield* daemon.watch();
		yield* daemon.awaitError("retrying in 0.05s\n");
		const line = daemon.errors().split("\n")[0];
		expect(line).toContain(`work-fleet: ERROR No Fleet daemon is running at 127.0.0.1:${daemon.port()}`);
		yield* daemon.awaitError(`${line}\n`.repeat(3));
		expect(daemon.isRunning()).toBe(true);
		const previousPort = daemon.port();
		yield* daemon.restart();
		expect(daemon.port()).not.toBe(previousPort);
		yield* daemon.awaitSnapshot();
		yield* daemon.transition("one", "released");
		yield* daemon.awaitOutput("one released\n");
		expect(daemon.output()).toBe("one released\n");
	},
);
