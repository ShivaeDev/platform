import { Effect } from "effect";
import { expect } from "vitest";
import { doneDependencySource } from "#test/dependencyBoard.ts";
import { dependencyMarkdown } from "#test/dependencyMarkdown.ts";
import { engine } from "#test/engineStory.ts";
import { markdownWork, noChangeReported, requiredChecksFailOnce } from "#test/engineTraits.ts";

for (const noChange of [false, true]) {
	engine.it(
		`editing status and next_action on ${noChange ? "validated no-change" : "observed merge"} preserves dependency admission after restart`,
		[markdownWork(), dependencyMarkdown(), noChangeReported(noChange)],
		function* ({ fleet, prepareWork, finishWorkers, writeBoardWork, restart }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			expect((yield* fleet.reconcile("one")).value.step).toBe("done");
			writeBoardWork("one.md", doneDependencySource);
			yield* prepareWork("dependent");
			yield* restart();
			expect((yield* fleet.dispatch("dependent")).value.step).toBe("working");
		},
	);
}

engine.it(
	"editing target status and next_action while its dependent executes still admits review",
	[markdownWork(), dependencyMarkdown(), noChangeReported()],
	function* ({ fleet, prepareWork, finishWorkers, writeBoardWork, restart, reviewedHeads }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		finishWorkers();
		yield* fleet.reconcile("one");
		yield* prepareWork("dependent");
		expect((yield* fleet.dispatch("dependent")).value.step).toBe("working");
		writeBoardWork("one.md", doneDependencySource);
		finishWorkers();
		yield* restart();
		expect((yield* fleet.reconcile("dependent")).value.step).toBe("done");
		expect(reviewedHeads()).toEqual(["current-main", "current-main"]);
	},
);

for (const [edit, source] of [
	["criteria", doneDependencySource.replace("The behavior works.", "The changed behavior works.")],
	["body", doneDependencySource.replace("Implement the behavior.", "Implement different behavior.")],
] as const) {
	engine.it(
		`done Board work remains satisfied after editing ${edit}`,
		[markdownWork(), dependencyMarkdown(), noChangeReported()],
		function* ({ fleet, prepareWork, finishWorkers, writeBoardWork, restart }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			expect((yield* fleet.reconcile("one")).value.step).toBe("done");
			writeBoardWork("one.md", source);
			yield* prepareWork("dependent");
			yield* restart();
			expect((yield* fleet.dispatch("dependent")).value.step).toBe("working");
		},
	);
}

for (const done of [false, true]) {
	engine.it(
		`released work without a merge ${done ? "unblocks when done on the Board" : "keeps its dependent blocked"}`,
		[noChangeReported(), requiredChecksFailOnce()],
		function* ({ fleet, prepareWork, finishWorkers, respond, setBoardStatus, editWork, restart }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			const failed = yield* fleet.reconcile("one");
			expect(failed.value.step).toBe("waiting");
			const decisionId = failed.value.decision?.id ?? "missing";
			const responseId = respond(decisionId, "release");
			expect((yield* fleet.resolve("one", decisionId, responseId)).value.step).toBe("released");
			setBoardStatus("one", done ? "done" : "planned");
			editWork("one", "edited-brief");
			yield* prepareWork("dependent");
			yield* restart();
			if (done) {
				expect((yield* fleet.dispatch("dependent")).value.step).toBe("working");
			} else {
				expect(yield* fleet.dispatch("dependent").pipe(Effect.flip)).toMatchObject({ _tag: "Forbidden" });
				expect((yield* fleet.get("dependent")).value.blocker).toContain("released without a merged delivery");
			}
		},
	);
}

engine.it(
	"done Board work with no Fleet record unblocks its dependent after brief edits",
	[],
	function* ({ fleet, prepareWork, setBoardStatus, editWork }) {
		setBoardStatus("one", "done");
		editWork("one", "edited-brief");
		yield* prepareWork("dependent");
		expect((yield* fleet.dispatch("dependent")).value.step).toBe("working");
	},
);

engine.it("done Board work with active Fleet work keeps its dependent blocked", [], function* ({ fleet, prepareWork, setBoardStatus }) {
	yield* prepareWork("one");
	yield* fleet.dispatch("one");
	setBoardStatus("one", "done");
	yield* prepareWork("dependent");
	expect(yield* fleet.dispatch("dependent").pipe(Effect.flip)).toMatchObject({ _tag: "Forbidden" });
	expect((yield* fleet.get("dependent")).value.blocker).toContain("Fleet work is still active");
});
