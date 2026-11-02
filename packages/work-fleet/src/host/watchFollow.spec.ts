import { expect } from "@effect/vitest";
import { approvedWork, host } from "#test/hostStory.ts";

host.it("watch --follow restricts actionable events to explicit work IDs", [approvedWork(["one", "two"])], function* (daemon) {
	yield* daemon.follow("selected", "watch", ["one", "one"], { follow: true, json: true, prEvents: false });
	yield* daemon.awaitSnapshot();
	const other = yield* daemon.dispatch("two");
	daemon.finishTurn(other, "FLEET_QUESTION: Other question");
	yield* daemon.reconcile("two");
	const selected = yield* daemon.dispatch("one");
	daemon.finishTurn(selected, "FLEET_QUESTION: Selected question");
	yield* daemon.reconcile("one");
	yield* daemon.awaitOutput("selected", '"reason":"Selected question"');

	expect(daemon.followerEvents("selected")).toEqual([{ kind: "waiting-on-orchestrator", reason: "Selected question", workId: "one" }]);
	expect(daemon.followerRunning("selected")).toBe(true);
});
