import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { foreignPullRequest } from "#test/engineLifecycleTraits.ts";
import { engine } from "#test/engineStory.ts";
import { humanMergeRequired } from "#test/engineTraits.ts";
import { savedDecision } from "#test/savedDecision.ts";

describe("stable decision codes", () => {
	engine.it(
		"reworded merge readiness sends requested changes to the existing worker after restart",
		[humanMergeRequired()],
		function* ({ fleet, prepareWork, finishWorkers, afterRestart, respond, replaceStoredRecord }) {
			yield* prepareWork("one");

			yield* fleet.dispatch("one");
			finishWorkers();
			const stopped = yield* fleet.reconcile("one");
			const decision = stopped.value.decision;
			if (decision === undefined) {
				return yield* Effect.die("Expected merge-ready decision");
			}
			expect(decision.code).toBe("reviewed-pr-ready");
			yield* replaceStoredRecord({ ...stopped.value, decision: { ...decision, reason: "A human can merge this reviewed change now." } });
			const repaired = yield* afterRestart(
				Fleet.pipe(Effect.flatMap((current) => current.resolve("one", decision.id, respond(decision.id, "retry")))),
			);
			expect(repaired.value.step).toBe("repairing");
			expect(repaired.value.prompt).toContain("Requested changes to the existing PR:");
			expect(repaired.value.result).toEqual(stopped.value.result);
			expect(repaired.value.review).toBeUndefined();
			expect(repaired.value.checks).toBeUndefined();
		},
	);
	engine.it(
		"reworded saved release-only reason rejects retry after restart without republishing",
		[foreignPullRequest()],
		function* ({ fleet, prepareWork, finishWorkers, afterRestart, respond, replaceStoredRecord }) {
			yield* prepareWork("one");

			yield* fleet.dispatch("one");
			finishWorkers();
			const stopped = yield* fleet.reconcile("one");
			const decision = stopped.value.decision;
			if (decision === undefined) {
				return yield* Effect.die("Expected release-only decision");
			}
			expect(decision.code).toBe("foreign-pr");
			const reworded = { ...decision, reason: "This pull request belongs to another repository." };
			yield* replaceStoredRecord({ ...stopped.value, decision: reworded });
			const resumed = yield* afterRestart(Fleet.pipe(Effect.flatMap((current) => current.reconcile("one"))));
			expect(resumed.value.decision).toEqual(reworded);
			const failure = yield* afterRestart(
				Fleet.pipe(
					Effect.flatMap((current) => current.resolve("one", decision.id, respond(decision.id, "retry"))),
					Effect.flip,
				),
			);
			expect(failure).toMatchObject({
				_tag: "BadRequest",
				message: "This decision only permits release; choose release to stop and hand back",
			});
		},
	);
});

engine.it(
	"a worker question reaches its Board card without guided actions",
	[savedDecision({ code: "foreign-pr", reason: "Which fixture should I use?", worker: { sessionId: "session", turnId: "turn" } })],
	function* ({ fleet, readBoardWork }) {
		const published = (yield* fleet.reconcile("one")).value.decision?.published;
		if (published === undefined) {
			return yield* Effect.die("Missing published worker question");
		}
		const card = readBoardWork(published.sourcePath);
		expect(card).toContain("Which fixture should I use?");
		expect(card).not.toContain(":::option{");
	},
);

for (const reason of ["Reported PR must belong to the host repository", "This pull request belongs to another repository."]) {
	engine.it(
		`a saved release-only code keeps its Board actions despite wording: ${reason}`,
		[savedDecision({ code: "foreign-pr", reason })],
		function* ({ fleet, readBoardWork }) {
			const published = (yield* fleet.reconcile("one")).value.decision?.published;
			if (published === undefined) {
				return yield* Effect.die("Missing published release-only decision");
			}
			const card = readBoardWork(published.sourcePath);
			expect(card).toContain("The reported PR belongs to another repository.");
			expect(card).toContain(':::option{id="release"}');
			expect(card).not.toContain(':::option{id="retry"}');
		},
	);
}

engine.it(
	"an uncoded saved decision reaches the Board with its details and a retry",
	[savedDecision({ reason: "Reported PR must belong to the host repository" })],
	function* ({ fleet, readBoardWork }) {
		const published = (yield* fleet.reconcile("one")).value.decision?.published;
		if (published === undefined) {
			return yield* Effect.die("Missing published uncoded decision");
		}
		const card = readBoardWork(published.sourcePath);
		expect(card).toContain("Fleet stopped and needs your decision.\n\nDetails: Reported PR must belong to the host repository");
		expect(card).toContain(':::option{id="retry"}');
	},
);

for (const [reason, explanation] of [
	["incomplete-context", "The main branch moved after this task was prepared, and Fleet cannot carry this preparation forward by itself."],
	[
		'Criteria "evidence" reference private/board',
		'The task needs information the worker cannot reach.\n\nDetails: Criteria "evidence" reference private/board',
	],
] as const) {
	engine.it(
		`the Board explains why a saved preparation cannot proceed: ${reason}`,
		[savedDecision({ code: "incomplete-context", reason })],
		function* ({ fleet, readBoardWork }) {
			const published = (yield* fleet.reconcile("one")).value.decision?.published;
			if (published === undefined) {
				return yield* Effect.die("Missing published preparation decision");
			}
			expect(readBoardWork(published.sourcePath)).toContain(explanation);
		},
	);
}

engine.it(
	"release-only wording cannot remove retry from an integration decision on the Board",
	[savedDecision({ code: "fleet-integration", reason: "Reported PR must belong to the host repository" })],
	function* ({ fleet, readBoardWork }) {
		const published = (yield* fleet.reconcile("one")).value.decision?.published;
		if (published === undefined) {
			return yield* Effect.die("Missing published integration decision");
		}
		expect(readBoardWork(published.sourcePath)).toContain(':::option{id="retry"}');
	},
);
