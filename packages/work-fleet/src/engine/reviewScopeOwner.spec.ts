import { expect } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import { scopeApproval } from "#test/engineBoardTraits.ts";
import { isolatedEngine } from "#test/engineStory.ts";
import { markdownWork } from "#test/engineTraits.ts";

for (const timing of ["between review passes", "while the reviewer finishes"] as const) {
	const setup = scopeApproval(timing);
	isolatedEngine.it(
		`approval removed ${timing} publishes a maintainer decision and persists its waiting group`,
		[markdownWork(), setup],
		function* ({
			fleet,
			prepareWork,
			finishWorkers,
			restart,
			waitForReviewObservation,
			writeBoardWork,
			boardBrief,
			resumeReviewer,
			readBoardPublication,
			rpcViews,
			launches,
		}) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			if (timing === "between review passes") {
				expect((yield* fleet.reconcile("one")).value.stage).toBe("reviewing");
			}
			const reconciliation = timing === "between review passes" ? undefined : yield* fleet.reconcile("one").pipe(Effect.forkChild);
			if (!(timing === "between review passes")) {
				yield* waitForReviewObservation();
			}
			writeBoardWork("one.md", boardBrief().replace("fleet: approved", "fleet: draft"));
			finishWorkers();
			yield* resumeReviewer();
			const stopped = reconciliation === undefined ? yield* fleet.reconcile("one") : yield* Fiber.join(reconciliation);
			expect(stopped.value.review).toBeUndefined();
			expect(stopped.value).toMatchObject({
				attentionOwner: "maintainer",
				decision: { attentionOwner: "maintainer", reason: "Work is no longer approved" },
				decisionPublished: true,
				stage: "needs-human",
			});
			const published = stopped.value.decision?.published ?? (yield* Effect.die("Missing scope approval publication"));
			const parsed = readBoardPublication(published.sourcePath);
			expect(parsed.diagnostics).toEqual([]);
			expect(parsed.fields.attention).toMatchObject([{ id: stopped.value.decision?.id, responseFrom: ["maintainer"] }]);
			yield* restart();
			const persisted = yield* fleet.get("one");
			expect(persisted.value).toMatchObject({
				attentionOwner: "maintainer",
				decision: { attentionOwner: "maintainer", id: stopped.value.decision?.id },
			});
			yield* restart();
			const views = yield* rpcViews();
			expect(views.waiting.maintainer).toMatchObject([{ decision: { id: stopped.value.decision?.id }, workId: "one" }]);
			expect(views.waiting.orchestrator).toEqual([]);
			expect(views.waiting.automation).toEqual([]);
			expect(launches()).toHaveLength(2);
		},
	);
}
