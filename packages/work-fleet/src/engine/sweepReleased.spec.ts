import { Effect } from "effect";
import { expect } from "vitest";
import { engine } from "#test/engineStory.ts";
import { markdownWork } from "#test/engineTraits.ts";
import { sweepPullRequests } from "#test/sweepPullRequests.ts";
import { sweepTask } from "#test/sweepTask.ts";

for (const outcome of ["merged", "closed"] as const) {
	engine.it(
		`a released and renewed sweep keeps its open PR reservation until it is ${outcome}`,
		[markdownWork(), sweepPullRequests()],
		function* ({ fleet, writeBoardWork, configureSweepPr, prepareWork, finishWorkers, recordBoardResponse, observeSweepPr, restart }) {
			for (const id of ["package", "catalog", "queued"]) {
				writeBoardWork(`${id}.md`, sweepTask(id, id === "catalog" ? ["*"] : undefined));
				configureSweepPr(id, [`src/${id}.ts`]);
				yield* prepareWork(id);
			}
			yield* fleet.dispatch("package");
			yield* fleet.dispatch("catalog");
			finishWorkers();
			expect((yield* fleet.reconcile("package")).value.blocker).toBe("Held behind sweep catalog");
			const ready = (yield* fleet.reconcile("catalog")).value;
			const decision = ready.decision?.id ?? "missing";
			const response = yield* recordBoardResponse({
				answers: [{ prompt: "fleet-action", selected: ["release"], text: "" }],
				author: "maintainer",
				body: "Hand the PR back while it remains open.",
				id: "response.release",
				question: ready.decision?.published?.questionId ?? "missing",
				type: "answer",
			});
			yield* fleet.resolve("catalog", decision, response.id);
			writeBoardWork("catalog.md", `${sweepTask("catalog")}\nA separate follow-up task.`);
			yield* prepareWork("catalog");
			yield* restart();
			for (const id of ["queued", "catalog"]) {
				yield* fleet.dispatch(id).pipe(Effect.result);
				expect((yield* fleet.get(id)).value).toMatchObject({ attempts: [], blocker: "waiting for sweep catalog", stage: "prepared" });
			}
			observeSweepPr("catalog", outcome);
			yield* fleet.reconcile("catalog");
			yield* fleet.reconcile("package");
			const packageResult = (yield* fleet.reconcile("package")).value;
			expect(packageResult.attempts.filter((attempt) => attempt.role === "repair")).toHaveLength(outcome === "merged" ? 1 : 0);
			if (outcome === "closed") {
				expect(packageResult.decision?.code).toBe("reviewed-pr-ready");
			}
			expect((yield* fleet.dispatch("queued")).value.stage).toBe("executing");
		},
	);
}
