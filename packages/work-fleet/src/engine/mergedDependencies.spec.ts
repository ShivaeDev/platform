import { Effect } from "effect";
import { expect } from "vitest";
import { reviewedPullRequestIsOpen } from "#test/engineDeliveryTraits.ts";
import { engine } from "#test/engineStory.ts";

for (const head of ["reviewed-head", "unreviewed-head"]) {
	engine.it(
		`a human merge of ${head} unblocks its dependent after restart and brief edits`,
		[reviewedPullRequestIsOpen()],
		function* ({ fleet, prepareWork, finishWorkers, mergePullRequest, restart, editWork }) {
			yield* prepareWork("one");
			yield* prepareWork("dependent");
			expect(yield* fleet.dispatch("dependent").pipe(Effect.flip)).toMatchObject({ _tag: "Forbidden" });
			yield* fleet.dispatch("one");
			finishWorkers();
			expect((yield* fleet.reconcile("one")).value.stage).toBe("needs-human");
			mergePullRequest(head);
			const merged = yield* fleet.reconcile("one");
			expect(merged.value.stage).toBe(head === "reviewed-head" ? "completed" : "released");
			expect(merged.value.mergedDelivery).toEqual({
				head,
				revision: "merged-revision",
				url: "https://github.com/example/repository/pull/42",
			});
			if (head === "unreviewed-head") {
				expect(merged.value.outcome).toBeUndefined();
			}
			editWork("one", "changed-brief");
			yield* restart();
			expect((yield* fleet.get("one")).value.mergedDelivery).toEqual(merged.value.mergedDelivery);
			expect((yield* fleet.dispatch("dependent")).value.stage).toBe("executing");
		},
	);
}

engine.it("a dependent lists every unmet dependency and the missing evidence", [], function* ({ fleet, prepareWork, setDependencies }) {
	setDependencies("dependent", ["one", "two", "other#criterion"]);
	yield* prepareWork("one");
	yield* fleet.dispatch("one");
	yield* prepareWork("dependent");
	expect(yield* fleet.dispatch("dependent").pipe(Effect.flip)).toMatchObject({ _tag: "Forbidden" });
	const blocker = (yield* fleet.get("dependent")).value.blocker;
	expect(blocker).toContain("dependency one: Fleet work is still active");
	expect(blocker).toContain("dependency two: not done on the Board");
	expect(blocker).toContain("Dependency other#criterion needs criterion-specific accepted evidence");
	expect(blocker).not.toContain("needs an accepted outcome for current Board revision");
});
