import { expect } from "@effect/vitest";
import { task } from "#test/fleetHost.ts";
import { boardWork, host, storedWork } from "#test/hostStory.ts";

host.it(
	"HTTP dispatch prepares approved work, rejects unapproved work and re-approves edited revisions",
	[
		boardWork({
			"denied.md": task("denied"),
			"one.md": task("one", "approved"),
		}),
	],
	function* (daemon) {
		yield* daemon.admit();
		daemon.writeBoard("one.md", task("one", "approved", "Edited approved revision."));
		daemon.writeBoard("unused.json", JSON.stringify({ database: { url: "postgresql://unavailable" }, provider: "local" }));
		const flags = ["--config", daemon.boardPath("unused.json")];
		expect(yield* daemon.cli(["dispatch", "one", ...flags])).toMatchObject({
			code: 0,
			stdout: "one: dispatch recorded; preparing and launching in the background",
		});
		yield* daemon.waitForRecord("one", (record) => record.attempts.at(-1)?.receipt !== undefined);
		expect(daemon.providerStarts()).toMatchObject([{ prompt: expect.stringContaining("Edited approved revision.") }]);
		expect((yield* daemon.cli(["dispatch", "denied", ...flags])).code).toBe(1);
		expect(daemon.providerStarts().map(({ operationId }) => operationId)).toEqual([(yield* daemon.get("one")).attempts[0]?.operationId]);
	},
	30_000,
);

for (const continuous of [false, true]) {
	host.it(
		continuous
			? "watch --follow resyncs all work after an HTTP restart without repeating outcomes"
			: "watch resyncs after the HTTP daemon restarts, preserving the selected set and printed outcomes",
		[storedWork("a", "working"), storedWork("b", "working")],
		function* (daemon) {
			const port = daemon.port();
			yield* daemon.follow("watcher", "watch", [], { follow: continuous, interval: 0.1 });
			yield* daemon.awaitSnapshot();
			yield* daemon.store("a", { stage: "released", step: "released" });
			yield* daemon.awaitOutput("watcher", "a released\n");
			yield* daemon.stop();
			yield* daemon.store("b", { stage: "done", step: "done" });
			yield* daemon.store("new", { stage: "working", step: "working" });
			yield* daemon.start(port);
			if (continuous) {
				yield* daemon.awaitOutput("watcher", "b done\n");
				yield* daemon.store("new", { stage: "released", step: "released" });
				yield* daemon.awaitOutput("watcher", "new released\n");
				expect(daemon.followerOutput("watcher")).toBe("a released\nb done\nnew released\n");
				expect(daemon.followerRunning("watcher")).toBe(true);
			} else {
				expect(yield* daemon.followerExit("watcher")).toEqual({ code: 0, stderr: "", stdout: "a released\nb done" });
			}
		},
		30_000,
	);
}
