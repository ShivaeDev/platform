import { Effect } from "effect";
import { expect } from "vitest";
import { engine } from "#test/engineStory.ts";
import { markdownWork, reviewerStillRunning } from "#test/engineTraits.ts";

engine.it(
	"stores shared stages while retaining resumable execution steps",
	[reviewerStillRunning()],
	function* ({ fleet, prepareWork, finishWorkers, turnReports, restart }) {
		yield* prepareWork("one");
		expect((yield* fleet.get("one")).value.stage).toBe("queued");
		expect((yield* fleet.dispatch("one")).value.stage).toBe("working");
		finishWorkers();
		const reviewing = yield* fleet.reconcile("one");
		expect(reviewing.value.stage).toBe("reviewing");
		yield* turnReports(
			reviewing,
			`FLEET_REVIEW: ${JSON.stringify({ evidence: ["Read the exact revision"], findings: [], head: reviewing.value.result?.head, verdict: "approve" })}`,
		);
		const completed = yield* fleet.reconcile("one");
		expect(completed.value).toMatchObject({ stage: "done", step: "done" });
		yield* restart();
		expect((yield* fleet.get("one")).value.stage).toBe("done");
	},
);

for (const approval of ["held", "manual"] as const) {
	engine.it(`never launches a ${approval} Board task`, [markdownWork()], function* ({ boardBrief, writeBoardWork, prepareWork, schedule, launches }) {
		writeBoardWork("one.md", boardBrief().replace("fleet: approved", `fleet: ${approval}`));
		const failure = yield* prepareWork("one").pipe(Effect.match({ onFailure: (error) => error, onSuccess: () => undefined }));
		expect(failure).toMatchObject({ _tag: "Forbidden", message: "Current Board revision needs maintainer approval" });
		yield* schedule();
		expect(launches()).toEqual([]);
	});
}
engine.it("refuses legacy Board fields before preparing work", [markdownWork()], function* ({ boardBrief, writeBoardWork, prepareWork }) {
	writeBoardWork("one.md", boardBrief().replace("kind: task", "kind: project"));
	const failure = yield* prepareWork("one").pipe(Effect.match({ onFailure: (error) => error, onSuccess: () => undefined }));
	expect(failure).toMatchObject({ message: expect.stringContaining("one.md") });
	expect(failure?.message).toContain("kind:");
	expect(failure?.message).toContain("work-board migrate <board dir>");
});

engine.it(
	"publishes worker questions as blocking task questions",
	[markdownWork()],
	function* ({ prepareWork, fleet, workerReports, readBoardPublication }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		workerReports("FLEET_QUESTION: Which storage should I use?");
		const waiting = (yield* fleet.reconcile("one")).value;
		expect(waiting.stage).toBe("waiting");
		expect(waiting.decision?.code).toBe("worker-question");
		const path = waiting.decision?.published?.sourcePath;
		expect(path).toBeDefined();
		if (path !== undefined) {
			expect(readBoardPublication(path).fields).toMatchObject({ kind: "question", scope: "task", status: "ready", urgency: "blocking" });
		}
	},
);
