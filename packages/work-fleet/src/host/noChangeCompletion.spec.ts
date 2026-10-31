import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { NO_CHANGE } from "#test/githubResult.ts";
import { approvedWork, host } from "#test/hostStory.ts";
import { noChangeMainHistory, pendingNoChangeReview } from "#test/noChangeCompletion.ts";

host.it(
	"accepted no-change review closes the task, marks its brief done and removes it from Fleet and Board progress",
	[approvedWork(["one"]), pendingNoChangeReview],
	function* (work) {
		const launched = yield* work.approve("one");
		work.finishTurn(launched.value, NO_CHANGE);
		const reviewing = yield* work.reconcile("one");
		expect(reviewing.step).toBe("reviewing");
		yield* outcomes({
			"Board progress": [work.boardProgress(), ["one"]],
			"Fleet active work": [work.status().pipe(Effect.map((overview) => overview.active.map((item) => item.workId))), ["one"]],
		});
		expect(work.readBoard("one.md")).not.toContain("status: done");
		work.finishTurn(reviewing);

		yield* work.reconcile("one");

		const status = yield* work.status();
		expect(status.active).toEqual([]);
		expect(status.waiting).toEqual({ automation: [], maintainer: [], orchestrator: [] });
		expect(status.completed).toMatchObject([{ stage: "done", workId: "one" }]);
		expect(yield* work.boardProgress()).toEqual([]);
		expect(work.readBoard("one.md")).toContain('status: done\nnext_action: "Done; no change needed."');
	},
);

for (const ref of ["main~1", "unmerged"]) {
	host.it(
		`no-change validation ${ref === "unmerged" ? "holds a commit outside main" : "accepts the checked commit after main advances"}`,
		[approvedWork(["one"]), pendingNoChangeReview, noChangeMainHistory],
		function* (work) {
			const launched = yield* work.approve("one");
			const head = work.repositoryRevision(ref);
			work.finishTurn(launched.value, NO_CHANGE.replace(/a{40}/u, head));
			const reviewing = yield* work.reconcile("one");
			work.finishTurn(reviewing);

			const result = yield* work.reconcile("one");

			if (ref === "unmerged") {
				expect(result.step).toBe("waiting");
				expect(result.decision?.reason).toBe("The reported no-change commit is not on main");
				expect(work.readBoard("one.md")).not.toContain("status: done");
			} else {
				expect(result.step).toBe("done");
				expect(result.checks).toMatchObject({ head, passed: true });
			}
		},
	);
}
