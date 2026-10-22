import { Effect } from "effect";
import { expect } from "vitest";
import { engine } from "#test/engineStory.ts";
import { markdownWork } from "#test/engineTraits.ts";
import { prepared } from "#test/preparation.ts";
import { sweepPullRequests } from "#test/sweepPullRequests.ts";
import { sweepTask } from "#test/sweepTask.ts";

engine.it(
	"a sweep drains running work, holds matching PRs and migrates them once after merging",
	[markdownWork(), sweepPullRequests()],
	function* ({
		fleet,
		writeBoardWork,
		configureSweepPr,
		finishWorkers,
		restart,
		observeSweepPr,
		status,
		providerStarts,
		reviewedHeads,
		readBoardPublication,
		turnOutput,
	}) {
		const brief = sweepTask("catalog", ["**/package.json"]);
		for (const [id, paths] of [
			["package", ["packages/example/package.json"]],
			["docs", ["docs/guide.md"]],
			["queued", ["src/queued.ts"]],
			["catalog", ["pnpm-workspace.yaml"]],
		] as const) {
			writeBoardWork(`${id}.md`, id === "catalog" ? brief : sweepTask(id));
			configureSweepPr(id, paths);
			yield* fleet.prepare({ cwd: "/synthetic", preparation: prepared({ ownedPaths: paths }), prompt: `Implement ${id}`, workId: id });
		}
		yield* fleet.dispatch("package");
		yield* fleet.dispatch("docs");
		yield* fleet.dispatch("catalog");
		yield* fleet.dispatch("queued").pipe(Effect.result);
		expect((yield* fleet.get("queued")).value).toMatchObject({
			attempts: [],
			attentionOwner: "automation",
			blocker: "waiting for sweep catalog",
			step: "queued",
		});
		finishWorkers();
		const held = (yield* fleet.reconcile("package")).value;
		expect(held).toMatchObject({ attentionOwner: "automation", blocker: "Held behind sweep catalog", step: "delivering" });
		expect(held.result?.kind).toBe("change");
		expect(held.decision).toBeUndefined();
		expect(held.mergeReadyAt).toBeUndefined();
		expect((yield* fleet.reconcile("docs")).value.decision?.code).toBe("reviewed-pr-ready");
		const readySweep = (yield* fleet.reconcile("catalog")).value;
		expect(readySweep.decision?.reason).toBe("Reviewed sweep PR is ready to merge");
		expect(readBoardPublication(readySweep.decision?.published?.sourcePath ?? "missing").body).toContain("sweep PR passed review");
		expect(yield* status()).toContain("Held behind sweep catalog");
		yield* restart();
		expect((yield* fleet.reconcile("package")).value.sweepHold?.context).toBe(brief);
		observeSweepPr("catalog", "merged");
		expect((yield* fleet.reconcile("catalog")).value.step).toBe("done");
		const migrating = (yield* fleet.reconcile("package")).value;
		expect(migrating.attempts.at(-1)).toMatchObject({ role: "repair", status: "accepted" });
		const receivedPrompt = turnOutput(migrating.attempts.at(-1)?.receipt);
		expect(receivedPrompt).toContain("Fetch and merge main");
		expect(receivedPrompt).toContain(brief);
		expect(migrating.decision).toBeUndefined();
		expect(migrating.sweepHold).toBeUndefined();
		yield* restart();
		yield* fleet.reconcile("package");
		finishWorkers();
		const migrated = (yield* fleet.reconcile("package")).value;
		expect(migrated.decision?.code).toBe("reviewed-pr-ready");
		expect(migrated.result?.head).not.toBe(held.result?.head);
		expect(reviewedHeads()).toContain(migrated.result?.head);
		expect(migrated.attempts.filter((attempt) => attempt.role === "repair")).toHaveLength(1);
		expect(providerStarts().filter((start) => start.access === "read-only")).toHaveLength(4);
		expect((yield* fleet.dispatch("queued")).value.step).toBe("working");
	},
);

engine.it(
	"a closed sweep releases held PRs and new launches without migration",
	[markdownWork(), sweepPullRequests()],
	function* ({ fleet, writeBoardWork, configureSweepPr, prepareWork, finishWorkers, observeSweepPr, restart }) {
		for (const id of ["package", "catalog", "queued"]) {
			writeBoardWork(`${id}.md`, sweepTask(id, id === "catalog" ? ["*"] : undefined));
			configureSweepPr(id, [`src/${id}.ts`]);
			yield* prepareWork(id);
		}
		yield* fleet.dispatch("package");
		yield* fleet.dispatch("catalog");
		finishWorkers();
		expect((yield* fleet.reconcile("package")).value.blocker).toBe("Held behind sweep catalog");
		yield* fleet.reconcile("catalog");
		observeSweepPr("catalog", "closed");
		expect((yield* fleet.reconcile("catalog")).value.sweepClosed).toBe(true);
		yield* restart();
		yield* fleet.reconcile("package");
		const ready = (yield* fleet.reconcile("package")).value;
		expect(ready.decision?.code).toBe("reviewed-pr-ready");
		expect(ready.attempts.filter((attempt) => attempt.role === "repair")).toHaveLength(0);
		expect((yield* fleet.dispatch("queued")).value.step).toBe("working");
	},
);
