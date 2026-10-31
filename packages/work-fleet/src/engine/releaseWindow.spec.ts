import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { automaticMerges, mergeLoop } from "#test/mergeLoopStory.ts";
import { watchedBranches } from "#test/watchedBranches.ts";

const CHANGESET = ".changeset/ship-one.md";
const changes = { [CHANGESET]: '---\n"@shivaedev/work-fleet": patch\n---\n\n### Fixed\n\n- Ship one.\n' };

for (const [status, conclusion, outcome] of [
	["completed", "success", "merged"],
	["completed", "success", "closed"],
	["in_progress", null, "cancelled"],
	["queued", null, "failure"],
	["in_progress", null, "waiting"],
] as const) {
	mergeLoop.it(
		`release CI ${status} holds a changeset PR across restart, names the release, lets other work merge, and releases the hold on ${outcome}`,
		[watchedBranches, automaticMerges],
		function* (fleet) {
			fleet.openReleasePr();
			fleet.releaseCiRun(status, conclusion);
			yield* fleet.preparePredictionWork("one");
			yield* fleet.dispatch("one");
			fleet.pushWorkerBranch("one", changes);
			yield* fleet.finishWorker("one");

			yield* fleet.reconcile("one");

			yield* outcomes({
				"Board wait": [
					fleet.boardFleetItems().pipe(Effect.map((data) => data.items)),
					expect.arrayContaining([
						expect.objectContaining({
							attentionOwner: "automation",
							stage: "waiting",
							waitingReason: "Waiting for release PR #99 to merge",
							workId: "one",
						}),
					]),
				],
				"Fleet status": [fleet.statusText(), expect.stringContaining("Waiting for release PR #99 to merge")],
				"queue submissions": [Effect.sync(fleet.queueRequests), []],
			});
			yield* fleet.preparePredictionWork("two");
			yield* fleet.dispatch("two");
			fleet.pushWorkerBranch("two", { "two.ts": "export const two = 2;" });
			yield* fleet.finishWorker("two");

			yield* fleet.reconcile("two");

			expect(fleet.queueRequests()?.map((request) => request.variables.pr)).toEqual(["2"]);
			fleet.mergeWatchedPr("two");
			expect((yield* fleet.reconcile("two")).value.step).toBe("done");
			yield* fleet.restart();
			yield* fleet.reconcile("one");
			expect(fleet.queueRequests()?.map((request) => request.variables.pr)).toEqual(["2"]);

			if (outcome === "merged" || outcome === "closed") {
				fleet.closeReleasePr(outcome);
			} else {
				fleet.releaseCiRun(outcome === "waiting" ? "waiting" : "completed", outcome === "waiting" ? null : outcome);
			}
			yield* fleet.reconcile("one");

			expect(fleet.queueRequests()?.map((request) => request.variables)).toEqual([
				{ head: fleet.publishedPredictionResult("two").head, pr: "2" },
				{ head: fleet.publishedPredictionResult("one").head, pr: "1" },
			]);
			expect(yield* fleet.statusText()).not.toContain("Waiting for release");
		},
	);
}

for (const [name, options, status, conclusion, head] of [
	["CI waiting for approval", {}, "waiting", null],
	["CI requiring approval", {}, "completed", "action_required"],
	["failing CI", {}, "completed", "failure"],
	["cancelled CI", {}, "completed", "cancelled"],
	["no CI run", {}, undefined, null],
	["CI for a previous head", {}, "in_progress", null, "c".repeat(40)],
	["a draft", { draft: true }, "completed", "success"],
	["another release branch", { branch: "release/other" }, "completed", "success"],
	["another base branch", { base: "maintenance" }, "completed", "success"],
] as const) {
	mergeLoop.it(`queues a changeset PR when the release has ${name}`, [watchedBranches, automaticMerges], function* (fleet) {
		fleet.openReleasePr(options);
		if (status !== undefined) {
			fleet.releaseCiRun(status, conclusion, head);
		}
		yield* fleet.preparePredictionWork("one");
		yield* fleet.dispatch("one");
		fleet.pushWorkerBranch("one", changes);
		yield* fleet.finishWorker("one");

		yield* fleet.reconcile("one");

		expect(fleet.queueRequests()?.map((request) => request.variables.pr)).toEqual(["1"]);
	});
}

for (const [path, status] of [
	[CHANGESET, "removed"],
	[".changeset/README.md", "modified"],
] as const) {
	mergeLoop.it(`queues a PR with only ${status} ${path} while the release waits`, [watchedBranches, automaticMerges], function* (fleet) {
		fleet.openReleasePr();
		fleet.releaseCiRun("completed", "success");
		yield* fleet.preparePredictionWork("one");
		yield* fleet.dispatch("one");
		fleet.pushWorkerBranch("one", { [path]: "Changeset documentation" });
		fleet.fileStatus(path, status);
		yield* fleet.finishWorker("one");

		yield* fleet.reconcile("one");

		expect(fleet.queueRequests()?.map((request) => request.variables.pr)).toEqual(["1"]);
	});
}
