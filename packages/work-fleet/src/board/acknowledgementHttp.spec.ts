import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { boardFolderStory, folderContains } from "#test/boardFolderStory.ts";

const decision = {
	id: "fleet.denied",
	links: [],
	reason: "Delivery policy denies this scope",
	recommendation: "Configure trusted policy and retry.",
};
boardFolderStory.it(
	"closes only an applied exact answer, retains source bytes, and keeps a later denied request open",
	[folderContains("withDependency")],
	function* ({ board, files, openHttp, askFiles }) {
		yield* Effect.gen(function* () {
			const receipt = yield* board.decision("task.one", decision);
			const source = files.read(receipt.sourcePath);
			const { client } = yield* openHttp();
			const clarify = yield* Effect.tryPromise(() =>
				client.mutate(
					client.responses.recordResponse.run({
						author: "maintainer",
						body: "What scope is denied?",
						id: "response.clarify",
						question: receipt.questionId,
						type: "clarify",
					}),
				),
			);
			expect(
				(yield* Effect.result(board.acknowledgeDecision({ decision: receipt, disposition: "applied", recordedAt: 1000, responseId: clarify.id })))
					._tag,
			).toBe("Failure");
			expect(yield* askFiles()).toContain(receipt.sourcePath);
			const answer = yield* Effect.tryPromise(() =>
				client.mutate(
					client.responses.recordResponse.run({
						answers: [{ prompt: "fleet-action", selected: ["retry"], text: "" }],
						author: "maintainer",
						body: "Policy configured.",
						id: "response.retry",
						question: receipt.questionId,
						supersedes: clarify.id,
						type: "answer",
					}),
				),
			);
			const acknowledgement = { decision: receipt, disposition: "applied" as const, recordedAt: 1001, responseId: answer.id };
			yield* board.acknowledgeDecision(acknowledgement);
			yield* board.acknowledgeDecision(acknowledgement);
			expect((yield* Effect.result(board.acknowledgeDecision({ decision: receipt, disposition: "superseded", recordedAt: 1002 })))._tag).toBe(
				"Failure",
			);
			expect(files.receipts()).toHaveLength(1);
			expect(files.read(receipt.sourcePath)).toBe(source);
			expect(yield* askFiles()).not.toContain(receipt.sourcePath);
			const { client: current } = yield* openHttp();
			expect(
				(yield* Effect.result(
					Effect.tryPromise(() => current.run(current.responses.question.run({ item: receipt.itemId, request: receipt.request }))),
				))._tag,
			).toBe("Failure");
			const sourceData = yield* Effect.tryPromise(() => current.run(current.api.document.run({ url: `/${receipt.sourcePath}` })));
			expect(sourceData.reading?.receipts[receipt.request]?.disposition).toBe("applied");
			const next = yield* board.decision("task.one", { ...decision, id: "fleet.denied-again" });
			const asks = yield* askFiles();
			expect(asks).not.toContain(receipt.sourcePath);
			expect(asks).toContain(next.sourcePath);
		});
	},
);
boardFolderStory.it(
	"recovers exact lost publication from original context after a task edit and acknowledges supersession without a fabricated answer",
	[folderContains("withDependency")],
	function* ({ board, files, askFiles }) {
		yield* Effect.gen(function* () {
			const original = yield* board.get("task.one");
			const lost = yield* board.decision("task.one", decision, original);
			const oldSource = files.read(lost.sourcePath);
			files.write("task.md", `${original.context}\nHuman context changed.\n`);
			const recovered = yield* board.decision("task.one", decision, original);
			expect(recovered).toEqual(lost);
			expect(files.read(recovered.sourcePath)).toBe(oldSource);
			expect((yield* board.readDecision(recovered))._tag).toBe("Pending");
			yield* board.acknowledgeDecision({ decision: recovered, disposition: "superseded", recordedAt: 2000 });
			expect(yield* askFiles()).not.toContain(lost.sourcePath);
			expect(files.receipts().map(files.read).join("\n")).not.toContain('"response":');
			expect((yield* Effect.result(board.decision("task.one", decision, { ...original, revision: "wrong-hash" })))._tag).toBe("Failure");
		});
	},
);
boardFolderStory.it(
	"keeps duplicates, malformed metadata and changed decision contexts outside receipt closure",
	[folderContains("withDependency")],
	function* ({ board, files, askFiles }) {
		yield* Effect.gen(function* () {
			const receipt = yield* board.decision("task.one", decision);
			const source = files.read(receipt.sourcePath);
			files.write(receipt.sourcePath, `${source}\nChanged decision.\n`);
			expect((yield* Effect.result(board.acknowledgeDecision({ decision: receipt, disposition: "superseded", recordedAt: 3000 })))._tag).toBe(
				"Failure",
			);
			files.write(receipt.sourcePath, source);
			yield* board.acknowledgeDecision({ decision: receipt, disposition: "superseded", recordedAt: 3000 });
			const saved = files.receipts()[0];
			expect(saved).toBeDefined();
			files.write("responses/duplicate-receipt.md", files.read(saved ?? ""));
			expect(yield* askFiles()).toContain(receipt.sourcePath);
			files.write("responses/duplicate-receipt.md", "# No duplicate receipt\n");
			files.write(receipt.sourcePath, source.replace('"managed":true', '"managed":true,"unsupported":true'));
			expect((yield* Effect.result(board.acknowledgeDecision({ decision: receipt, disposition: "superseded", recordedAt: 3000 })))._tag).toBe(
				"Failure",
			);
			files.write(receipt.sourcePath, source.replace('"managed":true', '"managed":false'));
			expect(yield* askFiles()).toContain(receipt.sourcePath);
		});
	},
);
