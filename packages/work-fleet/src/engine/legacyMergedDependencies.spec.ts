import { Effect } from "effect";
import { expect } from "vitest";
import { reviewedPullRequestIsOpen } from "#test/engineDeliveryTraits.ts";
import { isolatedEngine } from "#test/engineStory.ts";

for (const archived of [false, true]) {
	isolatedEngine.it(
		`migration recognizes a human merge in ${archived ? "an archived cycle" : "a released record"}`,
		[reviewedPullRequestIsOpen()],
		function* ({ fleet, prepareWork, finishWorkers, mergePullRequest, replaceStoredRecord, upgradeMergedDeliveries, restart, editWork }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			yield* fleet.reconcile("one");
			mergePullRequest("unreviewed-head");
			const released = (yield* fleet.reconcile("one")).value;
			expect(released.step).toBe("released");
			if (archived) {
				yield* replaceStoredRecord({
					...released,
					history: [{ ...released, archivedAt: 1, mergedDelivery: undefined }],
					mergedDelivery: undefined,
					releaseReason: undefined,
					step: "queued",
				});
			}
			yield* upgradeMergedDeliveries();
			yield* restart();
			const recovered = (yield* fleet.get("one")).value;
			expect(archived ? recovered.history?.[0]?.mergedDelivery : recovered.mergedDelivery).toEqual({
				head: "unreviewed-head",
				url: "https://github.com/example/repository/pull/42",
			});
			editWork("one", "later-brief");
			yield* prepareWork("dependent");
			expect((yield* fleet.dispatch("dependent")).value.step).toBe("working");
		},
	);
}

isolatedEngine.it(
	"migration leaves a released unmerged PR blocking its dependent",
	[reviewedPullRequestIsOpen()],
	function* ({ fleet, prepareWork, finishWorkers, respond, upgradeMergedDeliveries, restart }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		finishWorkers();
		const ready = yield* fleet.reconcile("one");
		const decisionId = ready.value.decision?.id ?? "missing";
		const responseId = respond(decisionId, "release");
		expect((yield* fleet.resolve("one", decisionId, responseId)).value.step).toBe("released");
		yield* upgradeMergedDeliveries();
		yield* restart();
		expect((yield* fleet.get("one")).value.mergedDelivery).toBeUndefined();
		yield* prepareWork("dependent");
		expect(yield* fleet.dispatch("dependent").pipe(Effect.flip)).toMatchObject({ _tag: "Forbidden" });
		expect((yield* fleet.get("dependent")).value.blocker).toContain("released without a merged delivery");
	},
);
