import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { metadataParse } from "@shivaedev/work-board/server/metadata/parse.ts";
import { briefRevision } from "#board/briefRevision.ts";
import { taskPrompt } from "#prompt/task.ts";
import { engine } from "#test/engineStory.ts";
import { markdownWork, reviewerStillRunning, reviewRequestsRepairs } from "#test/engineTraits.ts";

engine.it(
	"an approved brief edit preserves the repair session and adopts its result",
	[markdownWork(), engine.traits(reviewRequestsRepairs(), reviewerStillRunning())],
	function* ({ boardBrief, writeBoardWork, providerStarts, finishWorkers, prepareWork, fleet }) {
		const source = boardBrief();
		yield* prepareWork("one");
		const worker = yield* fleet.dispatch("one");
		finishWorkers();
		yield* fleet.reconcile("one");
		finishWorkers();
		const repairing = yield* fleet.reconcile("one");
		writeBoardWork("one.md", `${source}\nRevised repair criteria.\n`);
		yield* fleet.reconcile("one");
		finishWorkers();
		const reviewed = yield* fleet.reconcile("one");
		expect(reviewed.value.step).toBe("reviewing");
		expect(reviewed.value.result).toMatchObject({ head: "head-one-1", pr: "https://example.invalid/pr/one" });
		expect(reviewed.value.result?.head).not.toBe(repairing.value.result?.head);
		expect(reviewed.value.attempts[2]?.receipt?.sessionId).toBe(worker.value.attempts[0]?.receipt?.sessionId);
		expect(providerStarts().filter((entry) => entry.access !== "read-only")).toHaveLength(1);
	},
);

engine.it(
	"approval retains an adopted PR and observes the old reviewer before reviewing the revised criteria",
	[markdownWork(), reviewerStillRunning()],
	function* ({ boardBrief, writeBoardWork, launches, providerStarts, finishWorkers, prepareWork, fleet }) {
		const source = boardBrief();
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		finishWorkers();
		const original = yield* fleet.reconcile("one");
		const current = source.replace("Preserve review and required validation.", "Preserve review.");
		writeBoardWork("one.md", current);
		yield* fleet.reconcile("one");
		const approved = yield* fleet.dispatch("one");
		expect(approved.value.result).toEqual(original.value.result);
		expect(approved.value.attempts).toEqual(original.value.attempts);
		expect((yield* fleet.reconcile("one")).value.step).toBe("reviewing");
		expect(launches()).toHaveLength(2);
		finishWorkers();
		const obsolete = yield* fleet.reconcile("one");
		expect(obsolete.value.review).toBeUndefined();
		expect(obsolete.value.checks).toBeUndefined();
		const revised = yield* fleet.reconcile("one");
		expect(revised.value.step).toBe("reviewing");
		expect(revised.value.attempts.at(-1)?.prompt).toContain(taskPrompt(current));
		expect(revised.value.result).toEqual(original.value.result);
		expect(providerStarts().filter((entry) => entry.access !== "read-only")).toHaveLength(1);
		expect(revised.value.history ?? []).toEqual([]);
	},
);

for (const action of ["dispatch", "retry"] as const) {
	engine.it(
		`${action} approves edited criteria during execution and retains the worker for review and repair`,
		[markdownWork(), engine.traits(reviewRequestsRepairs(), reviewerStillRunning())],
		function* ({
			boardBrief,
			boardReceipts,
			readBoardWork,
			writeBoardWork,
			moveBoardWork,
			archivedSessions,
			answerReport,
			providerStarts,
			finishWorkers,
			prepareWork,
			restart,
			fleet,
		}) {
			const source = boardBrief();
			yield* prepareWork("one");
			const worker = yield* fleet.dispatch("one");
			const current = `${source}\nUpdated acceptance criteria.\n`;
			writeBoardWork("one.md", current.replace("kind: task", "kind: task\nowner: marvin"));
			moveBoardWork("one.md", "revised.md");
			const stopped = yield* fleet.reconcile("one");
			const decision = stopped.value.decision;
			if (decision?.published === undefined) {
				return yield* Effect.die("Missing decision");
			}
			writeBoardWork("revised.md", current);
			const approved =
				action === "dispatch" ? yield* fleet.dispatch("one") : yield* fleet.resolve("one", decision.id, answerReport(decision.published, "retry"));
			expect(approved.value).toMatchObject({ boardContext: current, boardRevision: briefRevision(metadataParse(current)), step: "working" });
			expect(approved.value.boardSourcePath).not.toBe(worker.value.boardSourcePath);
			expect(approved.value.boardSourcePath).toMatch(/revised\.md$/u);
			expect(approved.value.prompt).toContain(current);
			expect(approved.value.attempts.map(({ briefSteers: _steers, ...attempt }) => attempt)).toEqual(stopped.value.attempts);
			expect(approved.value.attempts[0]?.briefSteers).toHaveLength(1);
			expect(approved.value.history ?? []).toEqual([]);
			expect(approved.value.decision).toBeUndefined();
			const receipts = boardReceipts();
			expect(receipts).toHaveLength(1);
			if (action === "dispatch") {
				expect(approved.value.supersededDecisions).toMatchObject([{ boardAcknowledged: true, published: decision.published }]);
				expect(readBoardWork(receipts[0] ?? "")).toContain('"disposition":"superseded"');
			} else {
				expect(approved.value.responses).toMatchObject([{ boardAcknowledged: true, published: decision.published }]);
				expect(readBoardWork(receipts[0] ?? "")).toContain('"disposition":"applied"');
			}
			expect((yield* fleet.reconcile("one")).value.step).toBe("working");
			finishWorkers();
			yield* restart();
			const reviewing = yield* fleet.reconcile("one");
			expect(reviewing.value.step).toBe("reviewing");
			expect(reviewing.value.result).toMatchObject({ kind: "change", pr: "https://example.invalid/pr/one" });
			expect(reviewing.value.attempts[0]?.receipt).toEqual(worker.value.attempts[0]?.receipt);
			expect(reviewing.value.attempts[1]?.prompt).toContain(taskPrompt(current));
			expect(providerStarts().filter((entry) => entry.access !== "read-only")).toHaveLength(1);
			finishWorkers();
			const repairing = yield* fleet.reconcile("one");
			expect(repairing.value.step).toBe("working");
			expect(repairing.value.attempts.at(-1)).toMatchObject({ receipt: { sessionId: worker.value.attempts[0]?.receipt?.sessionId }, role: "repair" });
			expect(repairing.value.result).toEqual(reviewing.value.result);
			expect(providerStarts().filter((entry) => entry.access !== "read-only")).toHaveLength(1);
			expect(archivedSessions()).toEqual([]);
		},
	);
}

engine.it(
	"retry of a context decision cannot approve a subsequent edit",
	[markdownWork()],
	function* ({ boardBrief, writeBoardWork, answerReport, prepareWork, fleet }) {
		const source = boardBrief();
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		writeBoardWork("one.md", `${source.replace("kind: task", "kind: task\nowner: marvin")}\nFirst criteria edit.\n`);
		const decision = (yield* fleet.reconcile("one")).value.decision;
		if (decision?.published === undefined) {
			return yield* Effect.die("Missing decision");
		}
		writeBoardWork("one.md", `${source}\nSecond criteria edit.\n`);
		const denied = yield* fleet.resolve("one", decision.id, answerReport(decision.published, "retry")).pipe(Effect.result);
		expect(denied._tag).toBe("Failure");
		expect((yield* fleet.get("one")).value.boardContext).toBe(source);
		expect((yield* fleet.get("one")).value.responses).toBeUndefined();
	},
);
