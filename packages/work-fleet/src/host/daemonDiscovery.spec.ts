import { expect } from "@effect/vitest";
import { daemonPortIsUnreachable, fleetDaemon, unreadablePortFile } from "#test/daemonStory.ts";

fleetDaemon.it("watch without --port discovers the daemon's bound port and receives a live transition", [], function* (daemon) {
	yield* daemon.watch(0.05);
	yield* daemon.awaitSnapshot();
	yield* daemon.transition("one", "completed");
	yield* daemon.awaitOutput("one completed\n");
	expect(daemon.output()).toBe("one completed\n");
	expect(daemon.errors()).toBe("");
});

fleetDaemon.it("an explicit watch port overrides a dead port file for snapshots and transitions", [], function* (daemon) {
	const deadPort = daemon.port();
	yield* daemon.restart();
	yield* daemon.replacePort(deadPort);
	yield* daemon.transition("one", "needs-human", {
		attentionOwner: "orchestrator",
		id: "choose-next-step",
		links: [],
		reason: "Choose the next step",
		recommendation: "retry",
	});
	yield* daemon.watch(0.05, { port: daemon.port() });
	yield* daemon.awaitSnapshot();
	const snapshot = "one needs-human (waiting on orchestrator): Choose the next step\n";
	yield* daemon.awaitOutput(snapshot);
	yield* daemon.transition("one", "completed");
	yield* daemon.awaitOutput(`${snapshot}one completed\n`);
	expect(daemon.output()).toBe(`${snapshot}one completed\n`);
	expect(daemon.errors()).toBe("");
});

fleetDaemon.it("stopping a daemon removes its published port file", [], function* (daemon) {
	expect(yield* daemon.portFile()).toBe(String(daemon.port()));
	yield* daemon.stop();
	expect(yield* daemon.portFile()).toBeUndefined();
});

fleetDaemon.it("stopping a daemon preserves a port file replaced by another writer", [], function* (daemon) {
	const replacement = daemon.port() === 65_535 ? 65_534 : daemon.port() + 1;
	yield* daemon.replacePort(replacement);
	yield* daemon.stop();
	expect(yield* daemon.portFile()).toBe(String(replacement));
});

fleetDaemon.it(
	"watch without --port repeats an error on each unreachable retry and discovers a restarted daemon on a new port",
	[daemonPortIsUnreachable()],
	function* (daemon) {
		const interval = 0.08;
		yield* daemon.watch(interval);
		yield* daemon.awaitError(`retrying in ${interval}s\n`);
		const line = daemon.errors().split("\n")[0];
		expect(line).toContain(`work-fleet: ERROR No Fleet daemon is running at 127.0.0.1:${daemon.port()}`);
		yield* daemon.awaitError(`${line}\n`.repeat(20));
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

fleetDaemon.it("an explicit watch timeout ends initial unreachable retries with exit 4", [daemonPortIsUnreachable()], function* (daemon) {
	yield* daemon.watch(5, { timeout: 1 });
	const result = yield* daemon.exit();
	expect(result.code).toBe(4);
	expect(result.stdout).toBe("");
	expect(result.stderr).toContain(`No Fleet daemon is running at 127.0.0.1:${daemon.port()}`);
	expect(result.stderr).toContain("watch: timed out waiting for Fleet work");
});

fleetDaemon.it("watch reports an unreadable port file without inventing a daemon endpoint", [unreadablePortFile()], function* (daemon) {
	yield* daemon.watch(0.05);
	const result = yield* daemon.exit();
	expect(result.code).toBe(1);
	expect(result.stdout).toBe("");
	expect(result.stderr).toContain("Cannot read Fleet daemon port from ");
	expect(result.stderr).toContain(".fleet-port");
	expect(result.stderr).not.toContain("127.0.0.1:0");
	expect(result.stderr).not.toContain("retrying");
});

for (const args of [
	["status"],
	["dispatch", "one"],
	["answer", "one", "Use PostgreSQL"],
	["continue", "one", "Proceed"],
	["release", "one"],
	["wait", "one"],
	["reassign", "one", "decision", "maintainer"],
	["name-threads"],
] as const) {
	fleetDaemon.it(`${args[0]} reports the unreadable Board port file`, [unreadablePortFile()], function* (daemon) {
		const result = yield* daemon.client(args);
		expect(result.code).toBe(1);
		expect(result.stdout).toBe("");
		expect(result.stderr).toContain("Cannot read Fleet daemon port from ");
		expect(result.stderr).toContain(".fleet-port");
		expect(result.stderr).not.toContain("127.0.0.1:0");
	});
}
