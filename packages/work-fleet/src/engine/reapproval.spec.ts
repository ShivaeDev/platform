import { expect } from "@effect/vitest";
import { isolatedEngine } from "#test/engineStory.ts";
import { markdownWork, reviewerStillRunning } from "#test/engineTraits.ts";

for (const completedWhileHeld of [false, true]) {
	isolatedEngine.it(
		`re-approval resumes the same ${completedWhileHeld ? "completed" : "running"} worker and closes the approval question after restart`,
		[markdownWork(), reviewerStillRunning()],
		function* ({
			boardBrief,
			writeBoardWork,
			prepareWork,
			fleet,
			restart,
			finishWorkers,
			boardReceiptRecords,
			providerStarts,
			schedule,
			rpcViews,
			boardInboxFiles,
		}) {
			const source = boardBrief();
			yield* prepareWork("one");
			const original = yield* fleet.dispatch("one");
			writeBoardWork("one.md", source.replace("fleet: approved", "fleet: held"));
			const held = yield* fleet.reconcile("one");
			expect(held.value.decision?.code).toBe("approval-required");
			expect(held.value.decision?.published).toBeDefined();
			expect(yield* boardInboxFiles()).toContain(held.value.decision?.published?.sourcePath);
			expect((yield* rpcViews()).waiting.maintainer.map((item) => item.workId)).toContain("one");
			if (completedWhileHeld) {
				finishWorkers();
			}
			yield* fleet.reconcile("one");
			expect((yield* fleet.get("one")).value.step).toBe("waiting");
			writeBoardWork("one.md", source);
			yield* restart();
			yield* schedule();
			const resumed = yield* fleet.get("one");
			expect(resumed.value.decision).toBeUndefined();
			expect(resumed.value.blocker).toBeUndefined();
			expect((yield* rpcViews()).waiting.maintainer).toEqual([]);
			expect(yield* boardInboxFiles()).not.toContain(held.value.decision?.published?.sourcePath);
			expect(resumed.value.step).toBe("working");
			expect(resumed.value.attempts[0]?.receipt).toEqual(original.value.attempts[0]?.receipt);
			expect(resumed.value.supersededDecisions).toMatchObject([{ boardAcknowledged: true, published: held.value.decision?.published }]);
			expect(boardReceiptRecords()).toMatchObject([{ disposition: "superseded", question: held.value.decision?.published?.questionId }]);
			finishWorkers();
			const reviewed = yield* fleet.reconcile("one");
			expect(reviewed.value.step).toBe("reviewing");
			expect(reviewed.value.result).toMatchObject({ kind: "change", pr: "https://example.invalid/pr/one" });
			expect(
				providerStarts()
					.filter((start) => start.access !== "read-only")
					.map((start) => start.operationId),
			).toEqual(["operation-1"]);
		},
	);
}
