import { expect } from "vitest";
import { views } from "#engine/views.ts";
import { workClosesDuringAssessment } from "#test/engineBoardTraits.ts";
import { engine } from "#test/engineStory.ts";
import { markdownWork, noChangeReported } from "#test/engineTraits.ts";

engine.it(
	"an area waiter closed as dropped is released without starting a worker",
	[noChangeReported(), markdownWork()],
	function* ({ fleet, prepareWork, finishWorkers, restart, schedule, boardBrief, writeBoardWork, providerStarts }) {
		const planned = boardBrief().replace("kind: task", "kind: task\nstatus: draft\nareas: [shared]");
		writeBoardWork("one.md", planned);
		writeBoardWork("two.md", planned.replace("id: one", "id: two"));
		yield* prepareWork("one");
		yield* prepareWork("two");
		yield* fleet.dispatch("one");
		yield* schedule();
		expect((yield* fleet.get("two")).value.blocker).toBe("waiting for area shared held by one");
		writeBoardWork("two.md", planned.replace("id: one", "id: two").replace("status: draft", "status: dropped"));
		finishWorkers();
		expect((yield* fleet.reconcile("one")).value.step).toBe("done");
		const starts = providerStarts().length;
		yield* schedule();
		expect(providerStarts()).toHaveLength(starts);
		expect((yield* fleet.get("two")).value).toMatchObject({
			attempts: [],
			releaseReason: "Work cancelled because Board status is dropped.",
			step: "released",
		});
		const waiting = views((yield* fleet.list()).map(({ value }) => value)).waiting;
		expect(Object.values(waiting).flat()).toEqual([]);
		yield* restart();
		expect((yield* schedule()).dispatched).toEqual([]);
		expect(providerStarts()).toHaveLength(starts);
	},
);
engine.it(
	"a dependency waiter closed as deferred is dropped when its dependency completes",
	[noChangeReported()],
	function* ({ fleet, prepareWork, finishWorkers, restart, schedule, setBoardStatus, providerStarts }) {
		yield* prepareWork("one");
		yield* prepareWork("dependent");
		yield* schedule();
		expect((yield* fleet.get("dependent")).value.blocker).toContain("waiting for dependency one");
		setBoardStatus("dependent", "deferred");
		finishWorkers();
		yield* fleet.reconcile("one");
		const starts = providerStarts().length;
		yield* restart();
		yield* schedule();
		expect((yield* fleet.get("dependent")).value.step).toBe("released");
		expect(providerStarts()).toHaveLength(starts);
	},
);
for (const status of ["done", "dropped", "deferred"]) {
	engine.it(
		`launch bypasses the scheduler snapshot when Markdown status becomes ${status} during assessment`,
		[workClosesDuringAssessment(), markdownWork()],
		function* ({ fleet, prepareWork, schedule, boardBrief, writeBoardWork, editBoardDuringAssessment, providerStarts, providerCalls }) {
			const planned = boardBrief().replace("kind: task", "kind: task\nstatus: draft");
			writeBoardWork("one.md", planned);
			yield* prepareWork("one");
			editBoardDuringAssessment(planned.replace("status: draft", `status: ${status}`));
			yield* schedule();
			expect((yield* fleet.get("one")).value).toMatchObject({
				attempts: [],
				releaseReason:
					status === "dropped" ? "Work cancelled because Board status is dropped." : `Not launched because current Board status is ${status}`,
				step: "released",
			});
			expect(providerStarts()).toEqual([]);
			expect(providerCalls().filter((call) => call.call === "turn")).toEqual([]);
		},
	);
}
