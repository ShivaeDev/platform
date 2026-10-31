import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { isolatedEngine } from "#test/engineStory.ts";
import { markdownWork, reviewerStillRunning } from "#test/engineTraits.ts";

isolatedEngine.it(
	"holding running work on the Board publishes an approval question waiting on the maintainer",
	[markdownWork(), reviewerStillRunning()],
	function* ({ boardBrief, boardInboxFiles, fleet, prepareWork, rpcViews, writeBoardWork }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		writeBoardWork("one.md", boardBrief().replace("fleet: approved", "fleet: held"));

		const held = (yield* fleet.reconcile("one")).value;

		yield* outcomes([
			["inbox", () => boardInboxFiles(), expect.arrayContaining([held.decision?.published?.sourcePath])],
			["waiting on the maintainer", () => rpcViews().pipe(Effect.map(({ waiting }) => waiting.maintainer.map(({ workId }) => workId))), ["one"]],
		]);
		expect(held).toMatchObject({ decision: { code: "approval-required", published: { sourcePath: expect.any(String) } }, step: "waiting" });
	},
);

for (const completedWhileHeld of [false, true]) {
	const worker = completedWhileHeld ? "completed" : "running";

	isolatedEngine.it(
		`re-approval after a restart resumes the same ${worker} worker and supersedes its approval question`,
		[markdownWork(), reviewerStillRunning()],
		function* ({
			boardBrief,
			boardInboxFiles,
			boardReceiptRecords,
			finishWorkers,
			fleet,
			prepareWork,
			providerStarts,
			restart,
			rpcViews,
			schedule,
			writeBoardWork,
		}) {
			const source = boardBrief();
			yield* prepareWork("one");
			const original = yield* fleet.dispatch("one");
			writeBoardWork("one.md", source.replace("fleet: approved", "fleet: held"));
			const question = (yield* fleet.reconcile("one")).value.decision?.published;
			if (completedWhileHeld) {
				finishWorkers();
			}
			expect((yield* fleet.reconcile("one")).value.step).toBe("waiting");

			writeBoardWork("one.md", source);
			yield* restart();
			yield* schedule();

			const resumed = (yield* fleet.get("one")).value;
			yield* outcomes([
				["inbox", () => boardInboxFiles(), expect.not.arrayContaining([question?.sourcePath])],
				["waiting on the maintainer", () => rpcViews().pipe(Effect.map(({ waiting }) => waiting.maintainer)), []],
			]);
			expect({
				blocker: resumed.blocker ?? "none",
				decision: resumed.decision?.code ?? "none",
				receipt: resumed.attempts[0]?.receipt,
				receipts: boardReceiptRecords().map((receipt) => `${receipt?.disposition} ${receipt?.question}`),
				step: resumed.step,
				superseded: resumed.supersededDecisions?.map(({ boardAcknowledged, published }) => ({ boardAcknowledged, published })),
				workers: providerStarts()
					.filter(({ access }) => access !== "read-only")
					.map(({ operationId }) => operationId),
			}).toEqual({
				blocker: "none",
				decision: "none",
				receipt: original.value.attempts[0]?.receipt,
				receipts: [`superseded ${question?.questionId}`],
				step: "working",
				superseded: [{ boardAcknowledged: true, published: question }],
				workers: ["operation-1"],
			});
		},
	);

	isolatedEngine.it(
		`a re-approved ${worker} worker's report reaches review without launching another worker`,
		[markdownWork(), reviewerStillRunning()],
		function* ({ boardBrief, finishWorkers, fleet, prepareWork, providerStarts, restart, schedule, writeBoardWork }) {
			const source = boardBrief();
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			writeBoardWork("one.md", source.replace("fleet: approved", "fleet: held"));
			yield* fleet.reconcile("one");
			if (completedWhileHeld) {
				finishWorkers();
			}
			yield* fleet.reconcile("one");
			writeBoardWork("one.md", source);
			yield* restart();
			yield* schedule();
			finishWorkers();

			const reviewed = yield* fleet.reconcile("one");

			expect({
				result: reviewed.value.result,
				step: reviewed.value.step,
				workers: providerStarts()
					.filter(({ access }) => access !== "read-only")
					.map(({ operationId }) => operationId),
			}).toMatchObject({ result: { kind: "change", pr: "https://example.invalid/pr/one" }, step: "reviewing", workers: ["operation-1"] });
		},
	);
}
