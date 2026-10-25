import { expect } from "vitest";
import { boardEditRacesCompletion } from "#test/engineBoardTraits.ts";
import { engine } from "#test/engineStory.ts";
import { checksWithoutRepair, githubPullRequest, markdownWork, noChangeReported } from "#test/engineTraits.ts";
import { HEAD, REPORT } from "#test/githubResult.ts";
import { reportMain } from "#test/reportMain.ts";

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
			const original = boardBrief().replace("kind: task", "kind: task\nstatus: draft # keep this comment\nnext_action: Implement the work.");
			writeBoardWork("one.md", original);
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			workerReports(REPORT);
			yield* schedule();
			const waiting = yield* fleet.get("one");
			expect(waiting.value.step).toBe("waiting");
			mergePullRequest();
			yield* schedule();
			const done = yield* fleet.get("one");
			expect(done.value.step).toBe(released ? "released" : "done");
			expect(readBoardWork()).toBe(original.replace("status: draft", "status: done").replace("Implement the work.", '"Done; PR #7 merged."'));
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
engine.it(
	"a Board edit between the scheduler read and completion write survives and is marked done on a later pass",
	[githubPullRequest({}), boardEditRacesCompletion(), markdownWork()],
	function* ({ fleet, restart, schedule, prepareWork, workerReports, boardBrief, editBoardAtCompletion, mergePullRequest, readBoardWork, launches }) {
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
		expect(done.value.step).toBe("done");
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
engine.it(
	"a report completion marks only Board bookkeeping fields and preserves its recorded report and cycle",
	[markdownWork(), reportMain],
	function* ({ fleet, schedule, prepareWork, workerReports, boardBrief, writeBoardWork, readBoardWork }) {
		const original = boardBrief().replace("fleet: approved", "fleet: approved\ndelivers: report");
		writeBoardWork("one.md", original);
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		workerReports(`Findings.\nFLEET_HEAD: ${HEAD}`);
		yield* schedule();
		const done = yield* fleet.get("one");
		expect(done.value.step).toBe("done");
		expect(done.value.report).toBeDefined();
		expect(readBoardWork()).toBe(original.replace("delivers: report\n", 'delivers: report\nstatus: done\nnext_action: "Done; report recorded."\n'));
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
		expect(done.value.step).toBe("done");
		expect(readBoardWork()).toBe(
			boardBrief().replace("fleet: approved\n", 'fleet: approved\nstatus: done\nnext_action: "Done; no change needed."\n'),
		);
		yield* schedule();
		expect(yield* fleet.get("one")).toEqual(done);
		expect(done.value.history).toBeUndefined();
	},
);
