import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { automaticMerges, mergeLoop } from "#test/mergeLoopStory.ts";
import { watchedBranches } from "#test/watchedBranches.ts";

const CHANGESET = ".changeset/ship-one.md";
const changes = { [CHANGESET]: '---\n"@shivaedev/work-fleet": patch\n---\n\n### Fixed\n\n- Ship one.\n' };

for (const outcome of ["merged", "closed"] as const) {
	mergeLoop.it(
		`holds a green changeset PR across restart, names the release, queues other work, and resumes after the release is ${outcome}`,
		[watchedBranches, automaticMerges],
		function* (fleet) {
			fleet.openReleasePr();
			fleet.releaseCheck("success");
			yield* fleet.preparePredictionWork("one");
			yield* fleet.dispatch("one");
			fleet.pushWorkerBranch("one", changes);
			yield* fleet.finishWorker("one");

			yield* fleet.reconcile("one");

			yield* outcomes([
				[
					"Board wait",
					() => fleet.boardFleetItems().pipe(Effect.map((data) => data.items)),
					expect.arrayContaining([
						expect.objectContaining({
							attentionOwner: "automation",
							stage: "waiting",
							waitingReason: "Waiting for release PR #99 to merge",
							workId: "one",
						}),
					]),
				],
				["Fleet status", () => fleet.statusText(), expect.stringContaining("Waiting for release PR #99 to merge")],
				["queue submissions", () => Effect.sync(fleet.queueRequests), []],
			]);
			yield* fleet.preparePredictionWork("two");
			yield* fleet.dispatch("two");
			fleet.pushWorkerBranch("two", { "two.ts": "export const two = 2;" });
			yield* fleet.finishWorker("two");

			yield* fleet.reconcile("two");

			expect(fleet.queueRequests()?.map((request) => request.variables.pr)).toEqual(["2"]);
			yield* fleet.restart();
			yield* fleet.reconcile("one");
			expect(fleet.queueRequests()?.map((request) => request.variables.pr)).toEqual(["2"]);

			fleet.closeReleasePr(outcome);
			yield* fleet.reconcile("one");

			expect(fleet.queueRequests()?.map((request) => request.variables)).toEqual([
				{ head: fleet.publishedPredictionResult("two").head, pr: "2" },
				{ head: fleet.publishedPredictionResult("one").head, pr: "1" },
			]);
			expect(yield* fleet.statusText()).not.toContain("Waiting for release");
		},
	);
}

for (const [name, options, conclusion] of [
	["pending CI", {}, null],
	["failing CI", {}, "failure"],
	["a draft", { draft: true }, "success"],
	["another release branch", { branch: "release/other" }, "success"],
	["another base branch", { base: "maintenance" }, "success"],
] as const) {
	mergeLoop.it(`queues a changeset PR when the release has ${name}`, [watchedBranches, automaticMerges], function* (fleet) {
		fleet.openReleasePr(options);
		fleet.releaseCheck(conclusion);
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
		fleet.releaseCheck("success");
		yield* fleet.preparePredictionWork("one");
		yield* fleet.dispatch("one");
		fleet.pushWorkerBranch("one", { [path]: "Changeset documentation" });
		fleet.fileStatus(path, status);
		yield* fleet.finishWorker("one");

		yield* fleet.reconcile("one");

		expect(fleet.queueRequests()?.map((request) => request.variables.pr)).toEqual(["1"]);
	});
}
