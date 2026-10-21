import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { ANSWER_RECORDED, waitingOwner } from "#attention.ts";
import { approvedWork, host } from "#test/hostStory.ts";

for (const release of [false, true]) {
	host.it(`saved answers survive restart and watch waits for application: release=${release}`, [approvedWork(["one"])], function* (daemon) {
		const started = yield* daemon.dispatch("one");
		daemon.finishTurn(started, "FLEET_QUESTION: Which storage should I use?");
		const stopped = yield* daemon.reconcile("one");
		const decision = stopped.decision;
		if (decision === undefined) {
			throw new Error("Expected a worker decision");
		}
		const responseId = yield* daemon.recordAnswer(decision, release ? "release" : "retry", "Use PostgreSQL.");
		yield* daemon.store("one", { ...stopped, blocker: ANSWER_RECORDED });
		yield* daemon.stop();
		yield* daemon.start();
		yield* daemon.follow("watcher", "watch", []);
		yield* daemon.awaitSnapshot();
		yield* Effect.sleep("100 millis");
		expect(daemon.followerRunning("watcher")).toBe(true);
		expect(daemon.followerOutput("watcher")).toBe("");
		expect(waitingOwner(yield* daemon.get("one"))).toBe("automation");
		const applied = yield* daemon.reconcile("one");
		expect(applied.responses).toMatchObject([{ boardAcknowledged: true, responseId }]);
		if (!release) {
			expect(applied.attempts.at(-1)?.prompt).toBe("Use PostgreSQL.");
			expect(applied.attempts).toHaveLength(2);
			daemon.finishTurn(applied, "FLEET_QUESTION: Which storage should I use?");
			yield* daemon.reconcile("one");
		}
		const result = yield* daemon.followerExit("watcher");
		expect(result.code).toBe(0);
		expect(result.stdout).toContain(release ? "one released" : "one waiting");
		expect(daemon.providerStarts()).toHaveLength(1);
	});
}
