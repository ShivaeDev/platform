import { Effect } from "effect";
import { expect } from "vitest";
import { isolatedEngine } from "#test/engineStory.ts";
import { markdownWork, reviewerStillRunning } from "#test/engineTraits.ts";
import { sweepPullRequests } from "#test/sweepPullRequests.ts";
import { sweepTask } from "#test/sweepTask.ts";

for (const reason of ["checks", "conflict"] as const) {
	isolatedEngine.it(
		`a sweep's ${reason} repair bypasses occupied execution limits ahead of other work`,
		[markdownWork(), sweepPullRequests(2), reviewerStillRunning()],
		function* ({
			fleet,
			writeBoardWork,
			configureSweepPr,
			prepareWork,
			sweepChecksFail,
			sweepConflicts,
			restart,
			schedule,
			setTurnExecution,
			turnOutput,
			occupyExecution,
			vacateExecution,
		}) {
			for (const id of ["package", "catalog", "queued"]) {
				writeBoardWork(`${id}.md`, sweepTask(id, id === "catalog" ? ["**/package.json"] : undefined));
				configureSweepPr(id, [`src/${id}.ts`]);
				yield* prepareWork(id);
			}
			yield* fleet.dispatch("package");
			yield* fleet.dispatch("catalog");
			const catalog = (yield* fleet.get("catalog")).value;
			const receipt = catalog.attempts.at(-1)?.receipt;
			if (receipt === undefined) {
				throw new Error("The sweep has no worker turn");
			}
			setTurnExecution(receipt, "completed");
			const reviewing = (yield* fleet.reconcile("catalog")).value;
			const reviewer = reviewing.attempts.at(-1)?.receipt;
			if (reviewer === undefined) {
				throw new Error("The sweep has no reviewer turn");
			}
			setTurnExecution(reviewer, "completed", turnOutput(reviewer));
			if (reason === "checks") {
				sweepChecksFail("catalog", true);
			} else {
				yield* fleet.reconcile("catalog");
				sweepConflicts("catalog", true);
			}
			yield* occupyExecution("busy");
			yield* restart();
			yield* schedule();
			const repairing = (yield* fleet.get("catalog")).value;
			expect(repairing.attempts.at(-1)).toMatchObject({ role: "repair", status: "accepted" });
			expect((yield* fleet.get("package")).value.step).toBe("working");
			expect((yield* fleet.get("queued")).value.attempts.map((entry) => entry.operationId)).toEqual([]);
			sweepChecksFail("catalog", false);
			sweepConflicts("catalog", false);
			yield* vacateExecution("busy");
		},
	);
}

isolatedEngine.it(
	"concurrent sweep dispatch admits only one sweep and urgent dispatch cannot pass it",
	[markdownWork(), sweepPullRequests()],
	function* ({ fleet, writeBoardWork, configureSweepPr, prepareWork, launches }) {
		for (const id of ["catalog", "rename", "urgent"]) {
			const brief = sweepTask(id, id === "urgent" ? undefined : ["*"]);
			writeBoardWork(`${id}.md`, id === "urgent" ? brief.replace("fleet: approved", "fleet: approved\nfleet-priority: urgent") : brief);
			configureSweepPr(id, [`src/${id}.ts`]);
			yield* prepareWork(id);
		}
		yield* Effect.all(
			[fleet.dispatch("catalog"), fleet.dispatch("rename")].map((operation) => operation.pipe(Effect.result)),
			{ concurrency: "unbounded" },
		);
		expect(launches()).toEqual(["operation-1"]);
		yield* fleet.dispatch("urgent").pipe(Effect.result);
		expect((yield* fleet.get("urgent")).value).toMatchObject({ attempts: [], attentionOwner: "automation", step: "queued" });
		expect((yield* fleet.get("urgent")).value.blocker).toMatch(/^waiting for sweep (?:catalog|rename)$/u);
	},
);
