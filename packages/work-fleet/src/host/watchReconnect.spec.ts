import { expect } from "@effect/vitest";
import { DAEMON_PORT } from "#host/daemon.ts";
import { fleetDaemon } from "#test/daemonStory.ts";

fleetDaemon.it("a follower's owned daemon stays reachable without a discovery file", [], function* (daemon) {
	yield* daemon.transition("one", "needs-human", {
		attentionOwner: "maintainer",
		id: "review-ready",
		links: [],
		reason: "Review the work",
		recommendation: "review",
	});
	yield* daemon.stop();
	yield* daemon.ownedWatchWithoutDiscovery();
	yield* daemon.awaitOutput("one needs-human (waiting on maintainer): Review the work\n");
	expect(daemon.output()).toBe("one needs-human (waiting on maintainer): Review the work\n");
	expect(daemon.errors()).toBe("");
	expect(daemon.isRunning()).toBe(true);
});

for (const ids of [[], ["done", "gone", "active", "waiting"]]) {
	fleetDaemon.it(
		`watch --follow with ${ids.length === 0 ? "all" : "explicit"} IDs keeps unchanged restarts quiet and reports gap and live transitions after reconnect`,
		[],
		function* (daemon) {
			yield* daemon.transition("done", "completed");
			yield* daemon.transition("gone", "released");
			yield* daemon.transition("active", "executing");
			yield* daemon.transition("waiting", "needs-human", {
				attentionOwner: "maintainer",
				code: "reviewed-pr-ready",
				id: "initial-review",
				links: [],
				reason: "Reviewed PR is ready to merge",
				recommendation: "merge",
			});
			const port = daemon.port();
			yield* daemon.watch(0.1, { ids, port });
			const initial = "waiting needs-human (waiting on maintainer): Reviewed PR is ready to merge\n";
			yield* daemon.awaitOutput(initial);
			yield* daemon.awaitSnapshot();
			yield* daemon.transition("active", "released");
			yield* daemon.awaitOutput("active released\n");
			yield* daemon.restart(port);
			yield* daemon.awaitSnapshot();
			yield* daemon.transition("gone", "completed");
			yield* daemon.awaitOutput("gone completed\n");
			expect(daemon.output()).toBe(`${initial}active released\ngone completed\n`);
			const errorsBeforeGap = daemon.errors().length;
			yield* daemon.stop();
			expect(yield* daemon.portFile()).toBeUndefined();
			yield* daemon.awaitError(`No Fleet daemon is running at 127.0.0.1:${port}`, errorsBeforeGap);
			yield* daemon.transition("active", "completed");
			yield* daemon.restart(port);
			yield* daemon.awaitSnapshot();
			yield* daemon.awaitOutput("active completed\n");
			yield* daemon.transition("active", "needs-human", {
				attentionOwner: "maintainer",
				code: "reviewed-pr-ready",
				id: "after-restart",
				links: [],
				reason: "Reviewed PR is ready to merge",
				recommendation: "merge",
			});
			const live = "active needs-human (waiting on maintainer): Reviewed PR is ready to merge\n";
			yield* daemon.awaitOutput(live);
			expect(daemon.output()).toBe(`${initial}active released\ngone completed\nactive completed\n${live}`);
			expect(daemon.errors()).not.toContain(`127.0.0.1:${DAEMON_PORT}`);
			expect(daemon.isRunning()).toBe(true);
		},
	);
}
