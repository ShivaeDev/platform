import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
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
			stepOf,
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
			yield* outcomes([
				["package", () => stepOf("package"), "working"],
				["queued operations", () => fleet.get("queued").pipe(Effect.map((current) => current.value.attempts.map((entry) => entry.operationId))), []],
			]);
			sweepChecksFail("catalog", false);
			sweepConflicts("catalog", false);
			yield* vacateExecution("busy");
		},
	);
}

isolatedEngine.it(
	"concurrent sweep dispatch launches only one sweep",
	[markdownWork(), sweepPullRequests()],
	function* ({ configureSweepPr, dispatchTogether, launches, prepareWork, writeBoardWork }) {
		for (const id of ["catalog", "rename"]) {
			writeBoardWork(`${id}.md`, sweepTask(id, ["*"]));
			configureSweepPr(id, [`src/${id}.ts`]);
			yield* prepareWork(id);
		}

		yield* dispatchTogether("catalog", "rename");

		expect(launches()).toEqual(["operation-1"]);
	},
);

isolatedEngine.it(
	"urgent dispatch is refused and queued on automation behind a launched sweep",
	[markdownWork(), sweepPullRequests()],
	function* ({ attemptDispatch, configureSweepPr, fleet, prepareWork, writeBoardWork }) {
		writeBoardWork("catalog.md", sweepTask("catalog", ["*"]));
		writeBoardWork("urgent.md", sweepTask("urgent").replace("fleet: approved", "fleet: approved\nfleet-priority: urgent"));
		for (const id of ["catalog", "urgent"]) {
			configureSweepPr(id, [`src/${id}.ts`]);
			yield* prepareWork(id);
		}
		expect((yield* fleet.dispatch("catalog")).value.step).toBe("working");

		const refused = yield* attemptDispatch("urgent");

		expect({ refused, urgent: (yield* fleet.get("urgent")).value }).toMatchObject({
			refused: "admission refused: waiting for sweep catalog",
			urgent: { attempts: [], attentionOwner: "automation", blocker: "waiting for sweep catalog", step: "queued" },
		});
	},
);
