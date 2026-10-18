import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";
import { cycle } from "#engine/scheduler.ts";
import { boardEditRacesCompletion } from "#test/boardEditRacesCompletion.ts";
import { boardHttpFiles } from "#test/boardHttp.ts";
import { engine } from "#test/engineStory.ts";
import { checksWithoutRepair, githubPullRequest, markdownWork, noChangeReported } from "#test/engineTraits.ts";
import { REPORT } from "#test/githubResult.ts";

for (const released of [false, true]) {
	engine.it(
		`a synthetic merge marks ${released ? "released" : "completed"} Board work done without changing other bytes or its cycle`,
		[githubPullRequest({ failed: released }), checksWithoutRepair(), markdownWork()],
		function* ({ fixture, fleet, schedule, root, source, pullRequest, prepareWork, workerReports }) {
			const github = pullRequest();
			const file = join(root, "one.md");
			const files = boardHttpFiles(root);
			const original = source.replace("kind: task", "kind: task\nstatus: planned # keep this comment\nnext_action: Implement the work.");
			files.write("one.md", original);
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			workerReports(REPORT);
			yield* schedule();
			const waiting = yield* fleet.get("one");
			expect(waiting.value.stage).toBe("needs-human");
			github.state.status = "MERGED";
			yield* schedule();
			const done = yield* fleet.get("one");
			expect(done.value.stage).toBe(released ? "released" : "completed");
			expect(readFileSync(file, "utf8")).toBe(
				original.replace("status: planned", "status: done").replace("Implement the work.", '"Done; PR #7 merged."'),
			);
			expect(done.value.boardRevision).toBe(waiting.value.boardRevision);
			expect(done.value.boardContext).toBe(original);
			expect(done.value.history ?? []).toEqual(waiting.value.history ?? []);
			const stat = statSync(file);
			yield* schedule();
			expect(yield* fleet.get("one")).toEqual(done);
			expect(statSync(file).ino).toBe(stat.ino);
			expect(fixture.launched).toHaveLength(2);
		},
	);
}

{
	const setup = boardEditRacesCompletion();
	engine.it(
		"a Board edit between the scheduler read and completion write survives and is marked done on a later pass",
		[githubPullRequest({}), setup.given, markdownWork()],
		function* ({ fixture, fleet, restart, schedule, root, source, pullRequest, prepareWork, workerReports }) {
			const context = setup.context();
			const github = pullRequest();
			const file = join(root, "one.md");
			const files = boardHttpFiles(root);
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			workerReports(REPORT);
			yield* schedule();
			const waiting = yield* fleet.get("one");
			const changed = `${source}\nA human added this note.\n`;
			context.edit = () => files.write("one.md", changed);
			github.state.status = "MERGED";
			yield* schedule();
			const done = yield* fleet.get("one");
			expect(done.value.stage).toBe("completed");
			expect(readFileSync(file, "utf8")).toBe(changed);
			yield* restart(cycle);
			expect(readFileSync(file, "utf8")).toBe(
				changed.replace("fleet: approved\n", 'fleet: approved\nstatus: done\nnext_action: "Done; PR #7 merged."\n'),
			);
			expect(yield* fleet.get("one")).toEqual(done);
			expect(done.value.boardRevision).toBe(waiting.value.boardRevision);
			expect(done.value.history ?? []).toEqual(waiting.value.history ?? []);
			expect(fixture.launched).toHaveLength(2);
		},
	);
}

engine.it(
	"a report completion marks only Board bookkeeping fields and preserves its recorded report and cycle",
	[markdownWork()],
	function* ({ fleet, schedule, root, source, prepareWork, workerReports }) {
		const file = join(root, "one.md");
		const files = boardHttpFiles(root);
		const original = source.replace("fleet: approved", "fleet: approved\nfleet-deliverable: report");
		files.write("one.md", original);
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		workerReports(REPORT);
		yield* schedule();
		const done = yield* fleet.get("one");
		expect(done.value.stage).toBe("completed");
		expect(done.value.report).toBeDefined();
		expect(readFileSync(file, "utf8")).toBe(
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
	function* ({ fleet, schedule, root, source, prepareWork, workerReports }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		workerReports(REPORT);
		yield* schedule();
		const done = yield* fleet.get("one");
		expect(done.value.stage).toBe("completed");
		expect(readFileSync(join(root, "one.md"), "utf8")).toBe(
			source.replace("fleet: approved\n", 'fleet: approved\nstatus: done\nnext_action: "Done; no change needed."\n'),
		);
		yield* schedule();
		expect(yield* fleet.get("one")).toEqual(done);
		expect(done.value.history).toBeUndefined();
	},
);
