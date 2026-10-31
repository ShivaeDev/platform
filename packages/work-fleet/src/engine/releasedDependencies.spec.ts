import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { reviewedPullRequestIsOpen } from "#test/engineDeliveryTraits.ts";
import { engine } from "#test/engineStory.ts";

const LATER_MERGE = { head: "later-head", revision: "later-merge-commit", url: "https://github.com/example/repository/pull/42" };

for (const merged of [false, true]) {
	engine.it(
		`a released delivery ${merged ? "merged later unblocks its dependent across restart" : "left unmerged keeps its dependent blocked"}`,
		[reviewedPullRequestIsOpen()],
		function* ({ fleet, prepareWork, finishWorkers, respond, mergePullRequest, restart, schedule, setBoardStatus, boardWork, stepOf }) {
			setBoardStatus("one", "planned");
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			const ready = yield* fleet.reconcile("one");
			const decisionId = ready.value.decision?.id ?? "missing";
			const responseId = respond(decisionId, "release");
			const released = yield* fleet.resolve("one", decisionId, responseId);
			expect(released.value.step).toBe("released");
			expect(released.value.mergedDelivery).toBeUndefined();
			yield* prepareWork("dependent");
			yield* restart();
			yield* schedule();
			expect((yield* fleet.get("dependent")).value.step).toBe("queued");
			if (merged) {
				mergePullRequest("later-head", "later-merge-commit");
			}
			yield* restart();
			yield* schedule();
			yield* schedule();
			const observed = yield* fleet.get("one");
			expect(observed.value.step).toBe("released");
			expect(observed.value.outcome).toBeUndefined();
			expect(observed.value.releaseReason).toBe(released.value.releaseReason);
			expect(boardWork("one").status).toBe("planned");
			yield* restart();
			if (merged) {
				yield* outcomes([
					["one", () => fleet.get("one"), { value: { mergedDelivery: LATER_MERGE } }],
					["dependent", () => stepOf("dependent"), "working"],
				]);
			} else {
				yield* outcomes([
					["one merged delivery", () => fleet.get("one").pipe(Effect.map((current) => current.value.mergedDelivery)), undefined],
					["dependent", () => stepOf("dependent"), "queued"],
					["dependent blocker", () => fleet.get("dependent"), { value: { blocker: expect.stringContaining("released without a merged delivery") } }],
				]);
			}
		},
	);
}

engine.it(
	"a released delivery archived by later preparation still unblocks its dependent when merged",
	[reviewedPullRequestIsOpen()],
	function* ({ fleet, prepareWork, finishWorkers, respond, mergePullRequest, restart, setBoardStatus, setDependencies, schedule }) {
		setBoardStatus("one", "planned");
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		finishWorkers();
		const ready = yield* fleet.reconcile("one");
		const decisionId = ready.value.decision?.id ?? "missing";
		yield* fleet.resolve("one", decisionId, respond(decisionId, "release"));
		setDependencies("one", ["unfinished"]);
		const renewed = yield* prepareWork("one");
		expect(renewed.value.history?.[0]?.step).toBe("released");
		yield* prepareWork("dependent");
		mergePullRequest("later-head", "later-merge-commit");
		yield* restart();
		yield* schedule();
		yield* schedule();
		const observed = yield* fleet.get("one");
		expect(observed.value.step).toBe("queued");
		expect(observed.value.mergedDelivery).toBeUndefined();
		expect(observed.value.history?.[0]?.mergedDelivery).toEqual({
			head: "later-head",
			revision: "later-merge-commit",
			url: "https://github.com/example/repository/pull/42",
		});
		yield* restart();
		expect((yield* fleet.get("dependent")).value.step).toBe("working");
	},
);
