import { Effect } from "effect";
import { expect } from "vitest";
import { isolatedEngine } from "#test/engineStory.ts";
import { markdownWork } from "#test/engineTraits.ts";
import { sweepPullRequests } from "#test/sweepPullRequests.ts";
import { sweepTask } from "#test/sweepTask.ts";

isolatedEngine.it(
	"a sweep repair jumps ahead of an already queued repair with no execution capacity",
	[markdownWork(), sweepPullRequests(2)],
	function* ({ fleet, writeBoardWork, configureSweepPr, prepareWork, finishWorkers, sweepConflicts, occupyExecution, schedule, restart }) {
		for (const id of ["package", "catalog"]) {
			writeBoardWork(`${id}.md`, sweepTask(id, id === "catalog" ? ["**/package.json"] : undefined));
			configureSweepPr(id, [`src/${id}.ts`]);
			yield* prepareWork(id);
			yield* fleet.dispatch(id);
		}
		finishWorkers();
		yield* fleet.reconcile("package");
		yield* fleet.reconcile("catalog");
		yield* occupyExecution("busy-one");
		yield* occupyExecution("busy-two");
		sweepConflicts("package", true);
		expect((yield* fleet.reconcile("package")).value.stage).toBe("repairing");
		sweepConflicts("catalog", true);
		yield* restart();
		yield* schedule();
		expect((yield* fleet.get("catalog")).value.attempts.at(-1)).toMatchObject({ role: "repair", status: "accepted" });
		const waiting = (yield* fleet.get("package")).value;
		expect(waiting.stage).toBe("repairing");
		expect(waiting.attempts.filter((attempt) => attempt.role === "repair")).toHaveLength(0);
	},
);

isolatedEngine.it(
	"launching a sweep retracts an existing ready decision and closes its Board request",
	[markdownWork(), sweepPullRequests()],
	function* ({ fleet, writeBoardWork, configureSweepPr, prepareWork, finishWorkers, readBoardPublication }) {
		writeBoardWork("package.md", sweepTask("package"));
		configureSweepPr("package", ["src/package.ts"]);
		yield* prepareWork("package");
		yield* fleet.dispatch("package");
		finishWorkers();
		const ready = (yield* fleet.reconcile("package")).value;
		expect(ready.decision?.code).toBe("reviewed-pr-ready");
		writeBoardWork("catalog.md", sweepTask("catalog", ["*"]));
		configureSweepPr("catalog", ["src/catalog.ts"]);
		yield* prepareWork("catalog");
		yield* fleet.dispatch("catalog");
		const held = (yield* fleet.reconcile("package")).value;
		expect(held.blocker).toBe("Held behind sweep catalog");
		expect(held.decision).toBeUndefined();
		expect(held.mergeReadyAt).toBeUndefined();
		expect(readBoardPublication(ready.decision?.published?.sourcePath ?? "missing").fields.attention?.[0]?.state).toBe("closed");
		yield* fleet.dispatch("package").pipe(Effect.result);
		expect((yield* fleet.get("package")).value.blocker).toBe("Held behind sweep catalog");
	},
);
