import { Effect } from "effect";
import { expect } from "vitest";
import { responseMarkdown } from "@shivaedev/work-board/server/responses/records.ts";
import { pendingAcknowledgements } from "#engine/pendingAcknowledgements.ts";
import { isolatedEngine } from "#test/engineStory.ts";
import { readableBoard } from "#test/readableBoard.ts";
import { QUESTION } from "#test/workerQuestion.ts";

for (const unavailable of ["decision", "question", "answer"] as const) {
	isolatedEngine.it(
		`an unreadable ${unavailable} keeps its acknowledgement pending until the Markdown source recovers`,
		[readableBoard(true)],
		function* ({
			makeBoardUnreadable,
			restoreBoardReads,
			resumeAcknowledgements,
			writeTrackedBoard,
			boardReceipts,
			readBoardWork,
			providerStarts,
			workerQuestion,
			prepareWork,
			restart,
			fleet,
		}) {
			yield* prepareWork("item.0");
			yield* fleet.dispatch("item.0");
			yield* workerQuestion("item.0", QUESTION);
			const stopped = yield* fleet.reconcile("item.0");
			const decision = stopped.value.decision;
			if (decision?.published === undefined) {
				return yield* Effect.die("Missing published worker question");
			}
			const published = decision.published;
			const responseId = "response.answer";
			const responseFile = `responses/${responseId}.md`;
			const answer = responseMarkdown({
				body: "Use PostgreSQL.",
				id: responseId,
				response: { author: "orchestrator", question: published.questionId, recordedAt: 1000, reviewedRevision: published.revision, type: "answer" },
			});
			yield* writeTrackedBoard(responseFile, answer);
			const applied = yield* fleet.resolve("item.0", decision.id, responseId);
			expect(pendingAcknowledgements(applied.value)).toHaveLength(1);
			const starts = providerStarts().length;
			const file = { answer: responseFile, decision: published.sourcePath, question: `responses/${published.questionId}.md` }[unavailable];
			makeBoardUnreadable(file);
			resumeAcknowledgements();
			yield* restart();
			const waiting = yield* fleet.reconcile("item.0");
			expect(waiting.value.responses).toEqual(applied.value.responses);
			expect(pendingAcknowledgements(waiting.value)).toHaveLength(1);
			expect(waiting.value.blocker).toContain(`Board source could not be read: ${file}`);

			expect(boardReceipts()).toHaveLength(0);
			restoreBoardReads();
			yield* restart();
			const recovered = yield* fleet.reconcile("item.0");
			expect(recovered.value.responses).toEqual(applied.value.responses?.map((response) => ({ ...response, boardAcknowledged: true })));
			expect(pendingAcknowledgements(recovered.value)).toEqual([]);
			expect(recovered.value.blocker).toBeUndefined();
			expect(boardReceipts()).toHaveLength(1);
			expect(readBoardWork(boardReceipts()[0] ?? "missing")).toContain('"disposition":"applied"');
			expect(readBoardWork(responseFile)).toBe(answer);
			expect(providerStarts()).toHaveLength(starts);
		},
	);
}
