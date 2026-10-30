import { expect } from "vitest";
import { githubPullRequest, markdownWork } from "#test/engineTraits.ts";
import { PR, REPORT } from "#test/githubResult.ts";
import { largeBoard } from "#test/largeBoard.ts";
import { publicationStory as engine } from "#test/publicationStory.ts";

engine.it("status answers while a large Board rescan is still reading briefs", [largeBoard], function* (fleet) {
	yield* fleet.prepareWork("item.0");
	yield* fleet.startRescanDaemon();
	yield* fleet.startBoardRescan();

	const status = yield* fleet.rescanStatus();

	expect(status.active).toMatchObject([{ stage: "queued", workId: "item.0" }]);
	yield* fleet.finishBoardRescan();
});

engine.it("watch answers while a large Board rescan is still reading briefs", [largeBoard], function* (fleet) {
	yield* fleet.prepareWork("item.0");
	yield* fleet.startRescanDaemon();
	yield* fleet.startBoardRescan();

	const snapshots = yield* fleet.rescanWatch();

	expect(snapshots).toMatchObject([{ states: [{ stage: "queued", workId: "item.0" }] }]);
	yield* fleet.finishBoardRescan();
});

for (const path of ["one.md", "archive/one.md"]) {
	engine.it(`a done brief with a delivered id produces no warning in ${path}`, [githubPullRequest(), markdownWork()], function* (fleet) {
		yield* fleet.prepareWork("one");
		yield* fleet.dispatch("one");
		fleet.workerReports(REPORT);
		yield* fleet.schedule();
		fleet.mergePullRequest();
		yield* fleet.schedule();
		if (path !== "one.md") {
			fleet.archiveBoardWork("one.md");
		}

		yield* fleet.schedule();

		expect(yield* fleet.briefProblem("one", path)).toBeUndefined();
		expect(fleet.recordedSchedulerLogs()).toEqual([]);
	});
}

engine.it("a ready brief reusing a delivered id warns once until the brief changes", [githubPullRequest(), markdownWork()], function* (fleet) {
	yield* fleet.prepareWork("one");
	yield* fleet.dispatch("one");
	fleet.workerReports(REPORT);
	yield* fleet.schedule();
	fleet.mergePullRequest();
	yield* fleet.schedule();
	const ready = fleet.boardBrief().replace("kind: task", "kind: task\nstatus: ready");
	fleet.writeBoardWork("reused.md", ready);
	fleet.writeBoardWork("one.md", "---\nid: retired\nkind: task\n---\n# Retired\n");

	yield* fleet.schedule();
	yield* fleet.schedule();

	const message = `id one was delivered in ${PR}; give this brief a new id`;
	expect(yield* fleet.briefProblem("one", "reused.md")).toBe(message);
	expect(fleet.recordedSchedulerLogs().map((entry) => entry.message)).toEqual([[message]]);
	fleet.writeBoardWork("reused.md", `${ready}\nRevised acceptance criteria.\n`);

	yield* fleet.schedule();

	expect(fleet.recordedSchedulerLogs().map((entry) => entry.message)).toEqual([[message], [message]]);
});
