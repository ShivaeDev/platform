import { expect } from "@effect/vitest";
import { fleetDaemon } from "#test/daemonStory.ts";
import { approvedWork, host } from "#test/hostStory.ts";
import { statusRecord } from "#test/status.ts";

host.it("watch --follow stays alive for new launches and repeated human decisions over HTTP", [approvedWork(["b"])], function* (daemon) {
	yield* daemon.follow("all", "watch", [], { follow: true });
	yield* daemon.awaitSnapshot();
	expect(daemon.followerRunning("all")).toBe(true);
	expect(daemon.followerOutput("all")).toBe("");
	yield* daemon.store("a", {
		...statusRecord("a", "waiting"),
		decision: { attentionOwner: "orchestrator", id: "first", links: [], reason: "Choose the next step", recommendation: "retry" },
	});
	yield* daemon.awaitOutput("all", "a waiting (waiting on orchestrator): Choose the next step\n");
	expect((yield* daemon.dispatch("b")).step).toBe("working");
	expect(daemon.providerLaunches()).toEqual([(yield* daemon.get("b")).attempts[0]?.operationId]);
	yield* daemon.store("b", { stage: "done", step: "done" });
	yield* daemon.awaitOutput("all", "b done\n");
	yield* daemon.store("a", {
		decision: { attentionOwner: "maintainer", code: "reviewed-pr-ready", id: "second", reason: "Ready to merge" },
		stage: "waiting",
		step: "waiting",
	});
	yield* daemon.awaitOutput("all", "a waiting (waiting on you): Ready to merge\n");
	expect(daemon.followerOutput("all").trim().split("\n")).toEqual([
		"a waiting (waiting on orchestrator): Choose the next step",
		"b done",
		"a waiting (waiting on you): Ready to merge",
	]);
	expect(daemon.followerRunning("all")).toBe(true);
});

fleetDaemon.it("watch --follow keeps explicit IDs and reports new decisions with identical text and repeated releases", [], function* (daemon) {
	yield* daemon.follow("watch", ["a", "a"], { follow: true });
	yield* daemon.awaitSnapshot();
	const decision = { attentionOwner: "orchestrator", reason: "Choose the next step" };
	const line = "a waiting (waiting on orchestrator): Choose the next step\n";
	yield* daemon.store("a", { decision: { ...decision, id: "first" }, stage: "waiting", step: "waiting" });
	yield* daemon.awaitOutput(line);
	yield* daemon.transition("other", "released");
	yield* daemon.store("a", { decision: { ...decision, id: "second" }, stage: "waiting", step: "waiting" });
	yield* daemon.awaitOutput(line.repeat(2));
	yield* daemon.transition("a", "released");
	yield* daemon.awaitOutput(`${line.repeat(2)}a released\n`);
	const previous = daemon.snapshotCount();
	yield* daemon.transition("a", "working");
	yield* daemon.awaitSnapshotAfter(previous);
	yield* daemon.transition("a", "released");
	yield* daemon.awaitOutput(`${line.repeat(2)}a released\na released\n`);
	expect(daemon.output()).toBe(`${line.repeat(2)}a released\na released\n`);
	expect(daemon.isRunning()).toBe(true);
});
for (const ids of [[], ["a"]]) {
	fleetDaemon.it(
		`watch --follow with ${ids.length === 0 ? "all" : "explicit"} IDs reports the same ready decision again after repair`,
		[],
		function* (daemon) {
			yield* daemon.follow("watch", ids, { follow: true });
			yield* daemon.awaitSnapshot();
			const decision = { attentionOwner: "maintainer", code: "reviewed-pr-ready", reason: "Reviewed PR is ready to merge" };
			const line = "a waiting (waiting on you): Reviewed PR is ready to merge\n";
			yield* daemon.store("a", { decision, stage: "waiting", step: "waiting" });
			yield* daemon.awaitOutput(line);
			const previous = daemon.snapshotCount();
			yield* daemon.store("a", { decision, stage: "working", step: "repairing" });
			yield* daemon.awaitSnapshotAfter(previous);
			yield* daemon.store("a", { decision, stage: "waiting", step: "waiting" });
			yield* daemon.awaitOutput(line.repeat(2));
			expect(daemon.output()).toBe(line.repeat(2));
			expect(daemon.isRunning()).toBe(true);
		},
	);
}
