import { expect } from "vitest";
import { boardEditRacesCompletion } from "#test/engineBoardTraits.ts";
import { engine } from "#test/engineStory.ts";
import { githubPullRequest, markdownWork } from "#test/engineTraits.ts";
import { REPORT } from "#test/githubResult.ts";

engine.it("finishing work through Fleet closes its unanswered decision in the source", [githubPullRequest({}), markdownWork()], function* (fleet) {
	yield* fleet.prepareWork("one");
	yield* fleet.dispatch("one");
	fleet.workerReports(REPORT);
	yield* fleet.schedule();
	const waiting = (yield* fleet.get("one")).value.decision?.published;
	if (waiting === undefined) {
		throw new Error("Missing merge decision");
	}
	expect(fleet.readBoardPublication(waiting.sourcePath).fields.attention).toMatchObject([{ state: "open" }]);
	fleet.mergePullRequest();
	yield* fleet.schedule();
	expect((yield* fleet.get("one")).value.stage).toBe("completed");
	expect(fleet.readBoardPublication(waiting.sourcePath).fields.attention).toMatchObject([{ state: "closed" }]);
	expect(fleet.readBoardWork(waiting.sourcePath)).toContain("Closed because Board work one is done.");
});

for (const status of ["done", "deferred", "superseded"]) {
	engine.it(
		`reconciliation closes an unanswered decision after work becomes ${status} outside Fleet`,
		[githubPullRequest({}), markdownWork()],
		function* (fleet) {
			yield* fleet.prepareWork("one");
			yield* fleet.dispatch("one");
			fleet.workerReports(REPORT);
			yield* fleet.schedule();
			const waiting = (yield* fleet.get("one")).value.decision?.published;
			if (waiting === undefined) {
				throw new Error("Missing merge decision");
			}
			fleet.writeBoardWork("one.md", fleet.boardBrief().replace("kind: task", `kind: task\nstatus: ${status}`));
			yield* fleet.reconcile("one");
			expect(fleet.readBoardPublication(waiting.sourcePath).fields.attention).toMatchObject([{ state: "closed" }]);
			expect(fleet.readBoardWork(waiting.sourcePath)).toContain(`Closed because Board work one is ${status}.`);
		},
	);
}

engine.it(
	"a raced completion keeps the decision open until the Board work is written done",
	[githubPullRequest({}), boardEditRacesCompletion(), markdownWork()],
	function* (fleet) {
		yield* fleet.prepareWork("one");
		yield* fleet.dispatch("one");
		fleet.workerReports(REPORT);
		yield* fleet.schedule();
		const waiting = (yield* fleet.get("one")).value.decision?.published;
		if (waiting === undefined) {
			throw new Error("Missing merge decision");
		}
		fleet.editBoardAtCompletion(`${fleet.boardBrief()}\nA human added context.\n`);
		fleet.mergePullRequest();
		yield* fleet.schedule();
		expect(fleet.readBoardPublication(waiting.sourcePath).fields.attention).toMatchObject([{ state: "open" }]);
		yield* fleet.schedule();
		expect(fleet.readBoardPublication(waiting.sourcePath).fields.attention).toMatchObject([{ state: "closed" }]);
		expect(fleet.readBoardWork(waiting.sourcePath)).toContain("Closed because Board work one is done.");
	},
);
