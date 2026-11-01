import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { automaticMerges, mergeLoop } from "#test/mergeLoopStory.ts";
import { watchedBranches } from "#test/watchedBranches.ts";

const CHANGESET = '---\n"@shivaedev/work-fleet": patch\n---\n\n### Fixed\n\n- Ship.\n';

for (const [removal, status] of [
	[false, "completed"],
	[true, "completed"],
	[false, "queued"],
] as const) {
	mergeLoop.it(
		`a release ${removal ? "dropped for failed checks" : `outside the queue with ${status} CI`} raises one wait after five minutes across restart and new holds, and clears when CI runs, it requeues or merges`,
		[watchedBranches, automaticMerges],
		function* (fleet) {
			fleet.openReleasePr();
			fleet.releaseCiRun(status, status === "completed" ? "success" : null);
			if (removal) {
				fleet.dequeue("99", "failed_checks");
			}
			for (const id of ["one", "two"]) {
				if (id === "two") {
					fleet.advanceTime(4 * 60_000);
				}
				yield* fleet.preparePredictionWork(id);
				yield* fleet.dispatch(id);
				fleet.pushWorkerBranch(id, { [`.changeset/${id}.md`]: CHANGESET });
				yield* fleet.finishWorker(id);
				yield* fleet.reconcile(id);
			}
			expect((yield* fleet.boardFleetItems()).items.filter((item) => item.attentionOwner === "orchestrator")).toEqual([]);
			yield* fleet.restart();
			fleet.advanceTime(60_000);

			yield* fleet.reconcile("two");

			const reason = removal ? "Removed from the merge queue for failed checks" : "Not in the merge queue and no running CI";
			const waiting = `Release PR #99 (https://github.com/example/project/pull/99) is stuck: ${reason}; holds 2 PRs`;
			yield* outcomes([
				[
					"Board wait",
					() => fleet.boardFleetItems().pipe(Effect.map(({ items }) => items.filter((item) => item.attentionOwner === "orchestrator"))),
					[{ waitingReason: waiting, workId: "one" }],
				],
				[
					"watch snapshot",
					() => fleet.storedSnapshot().pipe(Effect.map((items) => items.filter((item) => item.attentionOwner === "orchestrator"))),
					[{ blocker: waiting, workId: "one" }],
				],
				["status", () => fleet.status(), expect.stringContaining(`one  waiting  ${waiting}`)],
				["queue submissions", () => Effect.sync(fleet.queueRequests), []],
			]);
			yield* fleet.reconcile("one");
			expect((yield* fleet.boardFleetItems()).items.filter((item) => item.attentionOwner === "orchestrator")).toMatchObject([{ workId: "one" }]);

			fleet.advanceTime(1);
			fleet.releaseCiRun("in_progress");
			yield* fleet.reconcile("one");

			expect((yield* fleet.storedSnapshot()).filter((item) => item.attentionOwner === "orchestrator")).toEqual([]);
			fleet.releaseCiRun("completed", "success");
			yield* fleet.reconcile("one");
			fleet.advanceTime(5 * 60_000);
			yield* fleet.reconcile("one");
			expect((yield* fleet.boardFleetItems()).items.filter((item) => item.attentionOwner === "orchestrator")).toMatchObject([{ workId: "one" }]);

			fleet.advanceTime(1);
			fleet.queueObservation("99", { mergeQueueEntry: { id: "99" } });
			yield* fleet.reconcile("one");

			expect((yield* fleet.storedSnapshot()).filter((item) => item.attentionOwner === "orchestrator")).toEqual([]);
			fleet.queueObservation("99", { mergeQueueEntry: null });
			yield* fleet.reconcile("one");
			fleet.advanceTime(5 * 60_000);
			yield* fleet.reconcile("one");
			expect((yield* fleet.boardFleetItems()).items.filter((item) => item.attentionOwner === "orchestrator")).toMatchObject([{ workId: "one" }]);

			fleet.closeReleasePr("merged");
			for (const id of ["one", "two"]) {
				yield* fleet.reconcile(id);
			}

			yield* outcomes([
				[
					"Board waits",
					() => fleet.boardFleetItems().pipe(Effect.map(({ items }) => items.filter((item) => item.attentionOwner === "orchestrator"))),
					[],
				],
				["status", () => fleet.status(), expect.not.stringContaining("Release PR #99")],
				["queue submissions", () => Effect.sync(() => fleet.queueRequests()?.map((request) => request.variables.pr)), ["1", "2"]],
			]);
		},
	);
}
