import { expect } from "@effect/vitest";
import { fleetDaemon } from "#test/daemonStory.ts";

fleetDaemon.it("a follower's owned daemon stays reachable without a discovery file", [], function* (daemon) {
	yield* daemon.transition("one", "waiting", {
		attentionOwner: "maintainer",
		id: "review-ready",
		links: [],
		reason: "Review the work",
		recommendation: "review",
	});
	yield* daemon.stop();
	yield* daemon.ownedWatchWithoutDiscovery();
	yield* daemon.awaitOutput("one waiting (waiting on you): Review the work\n");
	expect(daemon.output()).toBe("one waiting (waiting on you): Review the work\n");
	expect(daemon.errors()).toBe("");
	expect(daemon.isRunning()).toBe(true);
});

for (const ids of [[], ["done", "gone", "active", "waiting"]]) {
	fleetDaemon.it(
		`watch --follow with ${ids.length === 0 ? "all" : "explicit"} IDs keeps unchanged restarts quiet and reports gap and live transitions after reconnect`,
		[],
		function* (daemon) {
			yield* daemon.transition("done", "done");
			yield* daemon.transition("gone", "released");
			yield* daemon.transition("active", "working");
			yield* daemon.transition("waiting", "waiting", {
				attentionOwner: "maintainer",
				code: "reviewed-pr-ready",
				id: "initial-review",
				links: [],
				reason: "Reviewed PR is ready to merge",
				recommendation: "merge",
			});
			const port = daemon.port();
			yield* daemon.watch(0.1, { ids, port });
			const initial = "waiting waiting (waiting on you): Reviewed PR is ready to merge\n";
			yield* daemon.awaitOutput(initial);
			yield* daemon.awaitSnapshot();
			yield* daemon.transition("active", "released");
			yield* daemon.awaitOutput("active released\n");
			yield* daemon.restart(port);
			yield* daemon.awaitSnapshot();
			yield* daemon.transition("gone", "done");
			yield* daemon.awaitOutput("gone done\n");
			expect(daemon.output()).toBe(`${initial}active released\ngone done\n`);
			const errorsBeforeGap = daemon.errors().length;
			yield* daemon.stop();
			expect(yield* daemon.portFile()).toBeUndefined();
			yield* daemon.awaitError(`No Fleet daemon is running at 127.0.0.1:${port}`, errorsBeforeGap);
			yield* daemon.transition("active", "done");
			yield* daemon.restart(port);
			yield* daemon.awaitSnapshot();
			yield* daemon.awaitOutput("active done\n");
			yield* daemon.transition("active", "waiting", {
				attentionOwner: "maintainer",
				code: "reviewed-pr-ready",
				id: "after-restart",
				links: [],
				reason: "Reviewed PR is ready to merge",
				recommendation: "merge",
			});
			const live = "active waiting (waiting on you): Reviewed PR is ready to merge\n";
			yield* daemon.awaitOutput(live);
			expect(daemon.output()).toBe(`${initial}active released\ngone done\nactive done\n${live}`);
			expect(new Set(daemon.errors().match(/127\.0\.0\.1:\d+/gu))).toEqual(new Set([`127.0.0.1:${port}`]));
			expect(daemon.isRunning()).toBe(true);
		},
	);
}
