import { expect } from "vitest";
import { cycle } from "#engine/scheduler.ts";
import { views } from "#engine/views.ts";
import { boardHttpFiles } from "#test/boardHttp.ts";
import { engine } from "#test/engineStory.ts";
import { markdownWork, noChangeReported } from "#test/engineTraits.ts";
import { workClosesDuringAssessment } from "#test/workClosesDuringAssessment.ts";

engine.it(
	"an area waiter closed as superseded is released without starting a worker",
	[noChangeReported(), markdownWork()],
	function* ({ fixture, fleet, prepareWork, finishWorkers, restart, schedule, root, source }) {
		const files = boardHttpFiles(root);
		const planned = source.replace("kind: task", "kind: task\nstatus: planned\nareas: [shared]");
		files.write("one.md", planned);
		files.write("two.md", planned.replace("id: one", "id: two"));
		yield* prepareWork("one");
		yield* prepareWork("two");
		yield* fleet.dispatch("one");
		yield* schedule();
		expect((yield* fleet.get("two")).value.blocker).toBe("waiting for area shared held by one");
		files.write("two.md", planned.replace("id: one", "id: two").replace("status: planned", "status: superseded"));
		finishWorkers();
		expect((yield* fleet.reconcile("one")).value.stage).toBe("completed");
		const starts = fixture.starts.length;
		yield* schedule();
		expect(fixture.starts).toHaveLength(starts);
		expect((yield* fleet.get("two")).value).toMatchObject({
			attempts: [],
			releaseReason: "Not launched because current Board status is superseded",
			stage: "released",
		});
		const waiting = views((yield* fleet.list()).map(({ value }) => value)).waiting;
		expect(Object.values(waiting).flat()).toEqual([]);
		expect((yield* restart(cycle)).dispatched).toEqual([]);
		expect(fixture.starts).toHaveLength(starts);
	},
);

engine.it(
	"a dependency waiter closed as deferred is dropped when its dependency completes",
	[noChangeReported()],
	function* ({ fixture, fleet, prepareWork, finishWorkers, restart, schedule }) {
		yield* prepareWork("one");
		yield* prepareWork("dependent");
		yield* schedule();
		expect((yield* fleet.get("dependent")).value.blocker).toContain("waiting for dependency one");
		fixture.boardStatus("dependent", "deferred");
		finishWorkers();
		yield* fleet.reconcile("one");
		const starts = fixture.starts.length;
		yield* restart(cycle);
		expect((yield* fleet.get("dependent")).value.stage).toBe("released");
		expect(fixture.starts).toHaveLength(starts);
	},
);

for (const status of ["done", "superseded", "deferred"]) {
	{
		const setup = workClosesDuringAssessment();
		engine.it(
			`launch bypasses the scheduler snapshot when Markdown status becomes ${status} during assessment`,
			[setup.given, markdownWork()],
			function* ({ fixture, fleet, prepareWork, schedule, root, source }) {
				const context = setup.context();
				const files = boardHttpFiles(root);
				const planned = source.replace("kind: task", "kind: task\nstatus: planned");
				files.write("one.md", planned);
				yield* prepareWork("one");
				context.closeWork = () => files.write("one.md", planned.replace("status: planned", `status: ${status}`));
				yield* schedule();
				expect((yield* fleet.get("one")).value).toMatchObject({
					attempts: [],
					releaseReason: `Not launched because current Board status is ${status}`,
					stage: "released",
				});
				expect(fixture.starts).toEqual([]);
				expect(fixture.settings.filter((call) => call.call === "turn")).toEqual([]);
			},
		);
	}
}
