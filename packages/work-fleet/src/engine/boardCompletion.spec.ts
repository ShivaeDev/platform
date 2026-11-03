import { expect } from "vitest";
import { metadataParse } from "@shivaedev/work-board/metadata/adapters/parse.ts";
import { boardEditRacesCompletion } from "#test/engineBoardTraits.ts";
import { engine } from "#test/engineStory.ts";
import { checksWithoutRepair, githubPullRequest, markdownWork, noChangeReported } from "#test/engineTraits.ts";
import { HEAD, REPORT } from "#test/githubResult.ts";
import { reportMain } from "#test/reportMain.ts";

for (const released of [false, true]) {
	engine.it(
		`a synthetic merge marks ${released ? "released" : "completed"} Board work done and preserves its authored context and cycle`,
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
			const completed = metadataParse(readBoardWork());
			expect(completed.fields).toMatchObject({ ...metadataParse(original).fields, nextAction: "Done; PR #7 merged.", status: "done" });
			expect(completed.body).toBe(metadataParse(original).body);
			expect(done.value.boardRevision).toBe(waiting.value.boardRevision);
			expect(done.value.boardContext).toBe(original);
			expect(done.value.history ?? []).toEqual(waiting.value.history ?? []);
			const identity = boardFileIdentity();
			yield* schedule();
			expect(yield* fleet.get("one")).toEqual(done);
			expect(boardFileIdentity()).toBe(identity);
			expect(launches()).toEqual(["operation-1", "operation-2"]);
		},
	);
}
engine.it(
	"a Board edit between the scheduler read and completion write survives later passes",
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
		expect(readBoardWork()).toBe(changed);
		expect(yield* fleet.get("one")).toEqual(done);
		expect(done.value.boardRevision).toBe(waiting.value.boardRevision);
		expect(done.value.history ?? []).toEqual(waiting.value.history ?? []);
		expect(launches()).toEqual(["operation-1", "operation-2"]);
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
		const completed = metadataParse(readBoardWork());
		expect(completed.fields).toMatchObject({ ...metadataParse(original).fields, nextAction: "Done; report recorded.", status: "done" });
		expect(completed.body).toBe(metadataParse(original).body);
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
		const completed = metadataParse(readBoardWork());
		expect(completed.fields).toMatchObject({ id: "one", nextAction: "Done; no change needed.", status: "done" });
		expect(completed.body).toBe(metadataParse(boardBrief()).body);
		yield* schedule();
		expect(yield* fleet.get("one")).toEqual(done);
		expect(done.value.history).toBeUndefined();
	},
);
