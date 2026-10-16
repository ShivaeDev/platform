import { Effect, Layer } from "effect";
import { expect } from "vitest";
import { responseMarkdown } from "@shivaedev/work-board/responses/records.ts";
import { pendingAcknowledgements } from "#engine/pendingAcknowledgements.ts";
import { Fleet } from "#fleet.ts";
import { BoardFailure, BoardGateway } from "#policy.ts";
import { boardHttpFiles } from "#test/boardHttp.ts";
import { boardReads } from "#test/boardReads.ts";
import { prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";
import { askWorker } from "#test/workerQuestion.ts";

const test = postgresTests("test");

for (const unavailable of ["decision", "question", "answer"] as const) {
	test(`an unreadable ${unavailable} keeps its acknowledgement pending until the Markdown source recovers`, function* () {
		const source = yield* boardReads(1);
		let pause = true;
		const board = Layer.effect(BoardGateway)(
			Effect.map(BoardGateway, (original) => ({
				...original,
				acknowledgeDecision: (input) =>
					pause ? Effect.fail(new BoardFailure({ message: "Acknowledgement publication paused" })) : original.acknowledgeDecision(input),
			})),
		).pipe(Layer.provide(source.board));
		yield* withEngine(
			{},
			(fixture) =>
				Effect.gen(function* () {
					const fleet = yield* Fleet;
					yield* prepareWork("item.0");
					yield* fleet.dispatch("item.0");
					const { decision, published } = yield* askWorker(fixture, "item.0");
					const responseId = "response.answer";
					const responseFile = `responses/${responseId}.md`;
					const answer = responseMarkdown({
						body: "Use PostgreSQL.",
						id: responseId,
						response: {
							author: "orchestrator",
							question: published.questionId,
							recordedAt: 1000,
							reviewedRevision: published.revision,
							type: "answer",
						},
					});
					yield* source.write(responseFile, answer);
					const applied = yield* fleet.resolve("item.0", decision.id, responseId);
					expect(pendingAcknowledgements(applied.value)).toHaveLength(1);
					const starts = fixture.starts.length;
					const file = { answer: responseFile, decision: published.sourcePath, question: `responses/${published.questionId}.md` }[unavailable];
					source.unreadable.add(file);
					pause = false;
					const waiting = yield* fixture.restart(Fleet.pipe(Effect.flatMap((resumed) => resumed.reconcile("item.0"))));
					expect(waiting.value.responses).toEqual(applied.value.responses);
					expect(pendingAcknowledgements(waiting.value)).toHaveLength(1);
					expect(waiting.value.blocker).toContain(`Board source could not be read: ${file}`);
					const files = boardHttpFiles(source.root);
					expect(files.receipts()).toHaveLength(0);
					source.unreadable.clear();
					const recovered = yield* fixture.restart(Fleet.pipe(Effect.flatMap((resumed) => resumed.reconcile("item.0"))));
					expect(recovered.value.responses).toEqual(applied.value.responses?.map((response) => ({ ...response, boardAcknowledged: true })));
					expect(pendingAcknowledgements(recovered.value)).toEqual([]);
					expect(recovered.value.blocker).toBeUndefined();
					expect(files.receipts()).toHaveLength(1);
					expect(files.read(files.receipts()[0] ?? "missing")).toContain('"disposition":"applied"');
					expect(files.read(responseFile)).toBe(answer);
					expect(fixture.starts).toHaveLength(starts);
				}),
			board,
		);
	});
}
