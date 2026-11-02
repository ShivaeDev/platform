import { expect } from "@effect/vitest";
import { task } from "#test/fleetHost.ts";
import { boardWork, host, storedWork } from "#test/hostStory.ts";
import { independentScheduler } from "#test/independentScheduler.ts";

for (const paused of [false, true]) {
	host.it(
		`already connected all-item and explicit-item follow watches see an independent scheduler's review completion with approval wait=${paused}`,
		[
			boardWork({ "connected.md": task("connected", "approved") }, { intervalSeconds: 0.05 }),
			storedWork("connected", "waiting", {
				decision: { attentionOwner: "orchestrator", id: "connected", links: [], reason: "Watch connected", recommendation: "retry" },
			}),
			independentScheduler,
		],
		function* (daemon) {
			const port = yield* daemon.startReader();
			yield* daemon.follow("all", "watch", [], { follow: true, port, prEvents: false });
			yield* daemon.follow("explicit", "watch", ["connected", "one"], { follow: true, port, prEvents: false });
			yield* daemon.awaitOutput("all", 'waiting-on-orchestrator workId="connected" reason="Watch connected"\n');
			yield* daemon.awaitOutput("explicit", 'waiting-on-orchestrator workId="connected" reason="Watch connected"\n');
			expect(daemon.providerStarts()).toEqual([]);
			daemon.writeBoard("one.md", task("one", "approved"));
			yield* daemon.waitForRecord("one", (record) => record.attempts.some((attempt) => attempt.role === "worker" && attempt.receipt !== undefined));
			daemon.finishWorkers();
			yield* daemon.waitForRecord("one", (record) => record.attempts.some((attempt) => attempt.role === "reviewer" && attempt.receipt !== undefined));
			expect([
				daemon.followerOutput("all").includes('reason="Reviewed PR is ready to merge"'),
				daemon.followerOutput("explicit").includes('reason="Reviewed PR is ready to merge"'),
			]).toEqual([false, false]);
			if (paused) {
				daemon.writeBoard("one.md", task("one", "held"));
				yield* daemon.waitForRecord("one", (record) => record.decision?.published !== undefined);
				yield* daemon.awaitOutput("all", 'reason="Work is no longer approved"');
				yield* daemon.awaitOutput("explicit", 'reason="Work is no longer approved"');
			}
			daemon.finishWorkers();
			if (paused) {
				const waiting = yield* daemon.waitForRecord("one", (record) => record.attempts.at(-1)?.status === "completed");
				expect(waiting.step).toBe("waiting");
				expect(waiting.review).toBeUndefined();
				const decision = waiting.decision?.published;
				if (decision === undefined) {
					throw new Error("Missing approval decision");
				}
				daemon.writeBoard("one.md", task("one", "approved"));
				daemon.answerReport(decision, "retry");
			}
			const ready = yield* daemon.waitForRecord("one", (record) => record.decision?.code === "reviewed-pr-ready");
			expect(ready.step).toBe("waiting");
			expect((yield* daemon.readerRecord("one")).decision?.code).toBe("reviewed-pr-ready");
			const line = 'reason="Reviewed PR is ready to merge"';
			yield* daemon.awaitOutput("all", line);
			yield* daemon.awaitOutput("explicit", line);
			expect([daemon.followerRunning("all"), daemon.followerRunning("explicit")]).toEqual([true, true]);
			expect(daemon.reviewHeads()).toEqual(["head-one-0"]);
			expect(ready.review).toMatchObject({ head: "head-one-0", verdict: "approved" });
		},
	);
}
