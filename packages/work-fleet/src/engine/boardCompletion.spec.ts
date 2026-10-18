import { expect } from "vitest";
import { boardEditRacesCompletion } from "#test/engineBoardTraits.ts";
import { engine } from "#test/engineStory.ts";
import { checksWithoutRepair, githubPullRequest, markdownWork, noChangeReported } from "#test/engineTraits.ts";
import { REPORT } from "#test/githubResult.ts";

for (const released of [false, true]) {
	engine.it(
		`a synthetic merge marks ${released ? "released" : "completed"} Board work done without changing other bytes or its cycle`,
		[githubPullRequest({ failed: released }), checksWithoutRepair(), markdownWork()],
		function* ({
			fleet,
			schedule,
			prepareWork,
			workerReports,
			boardBrief,
			writeBoardWork,
			mergePullRequest,
			readBoardWork,
			boardFileIdentity,
			launches,
		}) {
			const original = boardBrief().replace("kind: task", "kind: task\nstatus: planned # keep this comment\nnext_action: Implement the work.");
			writeBoardWork("one.md", original);
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			workerReports(REPORT);
			yield* schedule();
			const waiting = yield* fleet.get("one");
			expect(waiting.value.stage).toBe("needs-human");
			mergePullRequest();
			yield* schedule();
			const done = yield* fleet.get("one");
			expect(done.value.stage).toBe(released ? "released" : "completed");
			expect(readBoardWork()).toBe(original.replace("status: planned", "status: done").replace("Implement the work.", '"Done; PR #7 merged."'));
			expect(done.value.boardRevision).toBe(waiting.value.boardRevision);
			expect(done.value.boardContext).toBe(original);
			expect(done.value.history ?? []).toEqual(waiting.value.history ?? []);
			const identity = boardFileIdentity();
			yield* schedule();
			expect(yield* fleet.get("one")).toEqual(done);
			expect(boardFileIdentity()).toBe(identity);
			expect(launches()).toHaveLength(2);
		},
	);
}
{
	const setup = boardEditRacesCompletion();
	engine.it(
		"a Board edit between the scheduler read and completion write survives and is marked done on a later pass",
		[githubPullRequest({}), setup, markdownWork()],
		function* ({
			fleet,
			restart,
			schedule,
			prepareWork,
			workerReports,
			boardBrief,
			editBoardAtCompletion,
			mergePullRequest,
			readBoardWork,
			launches,
		}) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			workerReports(REPORT);
			yield* schedule();
			const waiting = yield* fleet.get("one");
			const changed = `${boardBrief()}\nA human added this note.\n`;
			editBoardAtCompletion(changed);
			mergePullRequest();
			yield* schedule();
			const done = yield* fleet.get("one");
			expect(done.value.stage).toBe("completed");
			expect(readBoardWork()).toBe(changed);
			yield* restart();
			yield* schedule();
			expect(readBoardWork()).toBe(changed.replace("fleet: approved\n", 'fleet: approved\nstatus: done\nnext_action: "Done; PR #7 merged."\n'));
			expect(yield* fleet.get("one")).toEqual(done);
			expect(done.value.boardRevision).toBe(waiting.value.boardRevision);
			expect(done.value.history ?? []).toEqual(waiting.value.history ?? []);
			expect(launches()).toHaveLength(2);
		},
	);
}
engine.it(
	"a report completion marks only Board bookkeeping fields and preserves its recorded report and cycle",
	[markdownWork()],
	function* ({ fleet, schedule, prepareWork, workerReports, boardBrief, writeBoardWork, readBoardWork }) {
		const original = boardBrief().replace("fleet: approved", "fleet: approved\nfleet-deliverable: report");
		writeBoardWork("one.md", original);
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		workerReports(REPORT);
		yield* schedule();
		const done = yield* fleet.get("one");
		expect(done.value.stage).toBe("completed");
		expect(done.value.report).toBeDefined();
		expect(readBoardWork()).toBe(
			original.replace("fleet-deliverable: report\n", 'fleet-deliverable: report\nstatus: done\nnext_action: "Done; report recorded."\n'),
		);
		yield* schedule();
		expect(yield* fleet.get("one")).toEqual(done);
		expect(done.value.history).toBeUndefined();
	},
);
engine.it(
	"no-change completion marks Board work done without a new cycle",
	[noChangeReported(), markdownWork()],
	function* ({ fleet, schedule, prepareWork, workerReports, readBoardWork, boardBrief }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		workerReports(REPORT);
		yield* schedule();
		const done = yield* fleet.get("one");
		expect(done.value.stage).toBe("completed");
		expect(readBoardWork()).toBe(
			boardBrief().replace("fleet: approved\n", 'fleet: approved\nstatus: done\nnext_action: "Done; no change needed."\n'),
		);
		yield* schedule();
		expect(yield* fleet.get("one")).toEqual(done);
		expect(done.value.history).toBeUndefined();
	},
);
