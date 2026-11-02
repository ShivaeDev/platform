import { expect } from "@effect/vitest";
import { daemonPortIsUnreachable, fleetDaemon, unreadablePortFile } from "#test/daemonStory.ts";

fleetDaemon.it("watch without --port discovers the daemon's bound port and receives a live transition", [], function* (daemon) {
	yield* daemon.watch(0.05);
	yield* daemon.awaitSnapshot();
	yield* daemon.transition("one", "waiting", {
		attentionOwner: "orchestrator",
		id: "next",
		links: [],
		reason: "Choose the next step",
		recommendation: "retry",
	});
	yield* daemon.awaitOutput('waiting-on-orchestrator workId="one" reason="Choose the next step"\n');
	expect(daemon.output()).toBe('waiting-on-orchestrator workId="one" reason="Choose the next step"\n');
	expect(daemon.errors()).toBe("");
});

fleetDaemon.it("an explicit watch port overrides a dead port file for snapshots and transitions", [], function* (daemon) {
	const deadPort = daemon.port();
	yield* daemon.restart();
	yield* daemon.replacePort(deadPort);
	yield* daemon.transition("one", "waiting", {
		attentionOwner: "orchestrator",
		id: "choose-next-step",
		links: [],
		reason: "Choose the next step",
		recommendation: "retry",
	});
	yield* daemon.watch(0.05, { port: daemon.port() });
	yield* daemon.awaitSnapshot();
	const snapshot = 'waiting-on-orchestrator workId="one" reason="Choose the next step"\n';
	yield* daemon.awaitOutput(snapshot);
	yield* daemon.transition("one", "waiting", {
		attentionOwner: "maintainer",
		id: "second",
		links: [],
		reason: "Confirm scope",
		recommendation: "retry",
	});
	const next = 'waiting-on-you workId="one" reason="Confirm scope"\n';
	yield* daemon.awaitOutput(next);
	expect(daemon.output()).toBe(`${snapshot}${next}`);
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

fleetDaemon.it("watch discovers a daemon that restarts on a new port", [daemonPortIsUnreachable()], function* (daemon) {
	yield* daemon.watch(0.05);
	const previousPort = daemon.port();
	yield* daemon.restart();
	expect(daemon.port()).not.toBe(previousPort);
	yield* daemon.awaitSnapshot();
	yield* daemon.transition("one", "waiting", {
		attentionOwner: "orchestrator",
		id: "next",
		links: [],
		reason: "Choose the next step",
		recommendation: "retry",
	});
	const line = 'waiting-on-orchestrator workId="one" reason="Choose the next step"\n';
	yield* daemon.awaitOutput(line);
	expect(daemon.output()).toBe(line);
});

fleetDaemon.it("an explicit watch timeout ends initial unreachable retries with exit 4", [daemonPortIsUnreachable()], function* (daemon) {
	yield* daemon.watch(5, { timeout: 1 });
	const result = yield* daemon.exit();
	const exitCode = result.code;
	expect(exitCode).toBe(4);
	expect(result.stdout).toBe("");
	expect(result.stderr).toBe("");
});

fleetDaemon.it("watch reports an unreadable port file without inventing a daemon endpoint", [unreadablePortFile()], function* (daemon) {
	yield* daemon.watch(0.05);
	const result = yield* daemon.exit();
	const exitCode = result.code;
	expect(exitCode).toBe(1);
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
		const exitCode = result.code;
		expect(exitCode).toBe(1);
		expect(result.stdout).toBe("");
		expect(result.stderr).toContain("Cannot read Fleet daemon port from ");
		expect(result.stderr).toContain(".fleet-port");
		expect(result.stderr).not.toContain("127.0.0.1:0");
	});
}
