import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { automaticMerges, mergeLoop } from "#test/mergeLoopStory.ts";
import { watchedBranches } from "#test/watchedBranches.ts";

const ciFiles = { ".github/actions/setup/action.yml": "name: Setup", ".github/workflows/ci.yml": "name: Checks" };

mergeLoop.it(
	"a first-push CI change waits on the orchestrator naming its files without enabling auto-merge",
	[watchedBranches, automaticMerges],
	function* (fleet) {
		yield* fleet.preparePredictionWork("one");
		yield* fleet.dispatch("one");
		fleet.pushWorkerBranch("one", ciFiles);
		yield* fleet.finishWorker("one");

		yield* fleet.reconcile("one");

		yield* outcomes([
			[
				"orchestrator wait",
				() => fleet.rpcViews(),
				{ waiting: { orchestrator: [{ blocker: expect.stringContaining(".github/actions/setup/action.yml, .github/workflows/ci.yml") }] } },
			],
			["GitHub mutations", () => Effect.sync(fleet.queueRequests), []],
		]);
	},
);

mergeLoop.it(
	"a queued PR that gains CI changes loses its queue entry and auto-merge and waits on the orchestrator",
	[watchedBranches, automaticMerges],
	function* (fleet) {
		yield* fleet.preparePredictionWork("one");
		yield* fleet.dispatch("one");
		fleet.pushWorkerBranch("one", { "one.ts": "export const one = 1;" });
		yield* fleet.finishWorker("one");
		const queued = yield* fleet.reconcile("one");
		expect(fleet.queuedPullRequests()).toEqual([["1", queued.value.result?.head]]);

		fleet.pushWorkerBranch("one", ciFiles);
		yield* fleet.reconcile("one");

		yield* outcomes([
			["GitHub queue", () => Effect.sync(fleet.queuedPullRequests), []],
			["GitHub auto-merge", () => Effect.sync(fleet.autoMergePullRequests), []],
			[
				"GitHub mutations",
				() => Effect.sync(fleet.queueRequests),
				[
					{ query: expect.stringContaining("enablePullRequestAutoMerge") },
					{ query: expect.stringContaining("dequeuePullRequest") },
					{ query: expect.stringContaining("disablePullRequestAutoMerge") },
				],
			],
			[
				"orchestrator wait",
				() => fleet.rpcViews(),
				{ waiting: { orchestrator: [{ blocker: expect.stringContaining(".github/workflows/ci.yml") }] } },
			],
		]);
	},
);

mergeLoop.it(
	"releasing a CI hold queues only that head across restart and a later push holds it again",
	[watchedBranches, automaticMerges],
	function* (fleet) {
		yield* fleet.preparePredictionWork("one");
		yield* fleet.dispatch("one");
		fleet.pushWorkerBranch("one", ciFiles);
		yield* fleet.finishWorker("one");
		const held = yield* fleet.reconcile("one");
		const head = held.value.result?.head ?? "missing";
		expect(fleet.queuedPullRequests()).toEqual([]);

		yield* fleet.rpcReleaseCi("one", head);
		yield* fleet.restart();
		yield* fleet.reconcile("one");

		expect(fleet.queuedPullRequests()).toEqual([["1", head]]);

		fleet.pushWorkerBranch("one", { ".github/workflows/ci.yml": "name: Revised checks" });
		yield* fleet.reconcile("one");

		yield* outcomes([
			["GitHub queue", () => Effect.sync(fleet.queuedPullRequests), []],
			["GitHub auto-merge", () => Effect.sync(fleet.autoMergePullRequests), []],
			[
				"orchestrator wait",
				() => fleet.rpcViews(),
				{ waiting: { orchestrator: [{ blocker: expect.stringContaining(".github/workflows/ci.yml") }] } },
			],
		]);
	},
);

for (const change of ["delete", "move out of .github"] as const) {
	mergeLoop.it(
		`a queued PR that ${change === "delete" ? "deletes a workflow" : "moves a workflow out of .github"} is held naming the old CI path`,
		[watchedBranches, automaticMerges],
		function* (fleet) {
			yield* fleet.preparePredictionWork("one");
			yield* fleet.dispatch("one");
			fleet.pushWorkerBranch("one", { "one.ts": "export const one = 1;" });
			yield* fleet.finishWorker("one");
			yield* fleet.reconcile("one");
			expect(fleet.queuedPullRequests()?.map(([number]) => number)).toEqual(["1"]);

			if (change === "delete") {
				fleet.removeWorkerPath("one", ".github/workflows/base.yml");
			} else {
				fleet.moveWorkerPath("one", ".github/workflows/base.yml", "former-workflow.yml");
			}
			yield* fleet.reconcile("one");

			yield* outcomes([
				["GitHub queue", () => Effect.sync(fleet.queuedPullRequests), []],
				["GitHub auto-merge", () => Effect.sync(fleet.autoMergePullRequests), []],
				[
					"orchestrator wait",
					() => fleet.rpcViews(),
					{ waiting: { orchestrator: [{ blocker: expect.stringContaining(".github/workflows/base.yml") }] } },
				],
			]);
		},
	);
}

mergeLoop.it("releasing a post-queue CI hold reviews and queues the changed head", [watchedBranches, automaticMerges], function* (fleet) {
	yield* fleet.preparePredictionWork("one");
	yield* fleet.dispatch("one");
	fleet.pushWorkerBranch("one", { "one.ts": "export const one = 1;" });
	yield* fleet.finishWorker("one");
	const original = yield* fleet.reconcile("one");
	fleet.pushWorkerBranch("one", ciFiles);
	yield* fleet.reconcile("one");
	const head = fleet.publishedPredictionResult("one").head;
	expect(head).not.toBe(original.value.review?.head);
	expect(fleet.queuedPullRequests()).toEqual([]);

	yield* fleet.rpcReleaseCi("one", head);
	const queued = yield* fleet.reconcile("one");

	expect(queued.value.review?.head).toBe(head);
	expect(fleet.queuedPullRequests()).toEqual([["1", head]]);
});
