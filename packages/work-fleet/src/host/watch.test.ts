import { expect } from "@effect/vitest";
import { fleetDaemon } from "#test/daemonStory.ts";

fleetDaemon.it("streams each selected outcome once, including late records and multiline details", [], function* (daemon) {
	yield* daemon.follow("watch", ["a", "b", "c", "a"]);
	yield* daemon.awaitSnapshot();
	yield* daemon.store("a", { outcome: { evidence: ["All checks passed"] }, stage: "done", step: "done" });
	yield* daemon.awaitOutput("a done: All checks passed\n");
	expect(daemon.output().trim().split("\n")).toEqual(["a done: All checks passed"]);
	yield* daemon.store("b", { decision: { reason: "Review failed\nPlease inspect\r\nthe diff" }, stage: "waiting", step: "waiting" });
	yield* daemon.awaitOutput("b waiting (waiting on orchestrator): Review failed Please inspect the diff\n");
	yield* daemon.transition("c", "released");
	expect(yield* daemon.exit()).toMatchObject({
		code: 0,
		stderr: "",
		stdout: "a done: All checks passed\nb waiting (waiting on orchestrator): Review failed Please inspect the diff\nc released",
	});
});
fleetDaemon.it("without IDs snapshots only active work", [], function* (daemon) {
	for (const [id, step] of [
		["old", "done"],
		["stuck", "waiting"],
		["gone", "released"],
		["a", "working"],
		["b", "queued"],
	] as const) {
		yield* daemon.transition(id, step);
	}
	yield* daemon.follow("watch", []);
	yield* daemon.awaitSnapshot();
	expect(daemon.output()).toBe("");
	yield* daemon.transition("a", "released");
	yield* daemon.awaitOutput("a released\n");
	yield* daemon.transition("new", "working");
	yield* daemon.transition("b", "done");
	expect(yield* daemon.exit()).toMatchObject({ code: 0, stdout: "a released\nb done" });
});
fleetDaemon.it("timeout preserves printed outcomes", [], function* (daemon) {
	yield* daemon.transition("a", "released");
	yield* daemon.follow("watch", ["a", "unknown"], { timeout: 0.2 });
	expect(yield* daemon.exit()).toMatchObject({ code: 4, stderr: "watch: timed out waiting for Fleet work", stdout: "a released" });
});
fleetDaemon.it("an empty active set exits without printing terminal records", [], function* (daemon) {
	yield* daemon.transition("new", "released");
	yield* daemon.follow("watch", []);
	expect(yield* daemon.exit()).toMatchObject({ code: 0, stdout: "" });
});
