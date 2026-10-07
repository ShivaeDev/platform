import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { markdownBoard } from "#board/markdown.ts";
import { BoardGateway } from "#policy.ts";
import { boardFolder } from "#test/boardFolder.ts";
import { boardHttp, boardHttpFiles, boardOverview } from "#test/boardHttp.ts";

const decision = {
	id: "fleet.denied",
	links: [],
	reason: "Delivery policy denies this scope",
	recommendation: "Configure trusted policy and retry.",
};

it.effect("closes only an applied exact answer, retains source bytes, and keeps a later denied request open", function* () {
	const root = yield* boardFolder("withDependency");
	const files = boardHttpFiles(root);
	yield* Effect.gen(function* () {
		const board = yield* BoardGateway;
		const receipt = yield* board.decision("task.one", decision);
		const source = files.read(receipt.sourcePath);
		const { client } = yield* boardHttp(root);
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
			(yield* Effect.result(board.acknowledgeDecision({ decision: receipt, disposition: "applied", recordedAt: 1000, responseId: clarify.id })))._tag,
		).toBe("Failure");
		expect(yield* boardOverview(root)).toContain(`data-attention-item="${receipt.itemId}"`);
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
		expect(files.receipts()).toHaveLength(1);
		expect(files.read(receipt.sourcePath)).toBe(source);
		expect(yield* boardOverview(root)).not.toContain(`data-attention-item="${receipt.itemId}"`);
		const { client: current, url } = yield* boardHttp(root);
		expect(
			(yield* Effect.result(Effect.tryPromise(() => current.run(current.responses.question.run({ item: receipt.itemId, request: receipt.request })))))
				._tag,
		).toBe("Failure");
		const pageResponse = yield* Effect.tryPromise(() => fetch(`${url}/${receipt.sourcePath}`));
		expect(yield* Effect.tryPromise(() => pageResponse.text())).toContain("Managed request acknowledged: applied");
		const next = yield* board.decision("task.one", { ...decision, id: "fleet.denied-again" });
		const overview = yield* boardOverview(root);
		expect(overview).not.toContain(`data-attention-item="${receipt.itemId}"`);
		expect(overview).toContain(`data-attention-item="${next.itemId}"`);
	}).pipe(Effect.provide(markdownBoard(root).pipe(Layer.provide(NodeServices.layer))));
});

it.effect(
	"recovers exact lost publication from original context after a task edit and acknowledges supersession without a fabricated answer",
	function* () {
		const root = yield* boardFolder("withDependency");
		const files = boardHttpFiles(root);
		yield* Effect.gen(function* () {
			const board = yield* BoardGateway;
			const original = yield* board.get("task.one");
			const lost = yield* board.decision("task.one", decision, original);
			const oldSource = files.read(lost.sourcePath);
			files.write("task.md", `${original.context}\nHuman context changed.\n`);
			const recovered = yield* board.decision("task.one", decision, original);
			expect(recovered).toEqual(lost);
			expect(files.read(recovered.sourcePath)).toBe(oldSource);
			expect((yield* board.readDecision(recovered))._tag).toBe("Stale");
			yield* board.acknowledgeDecision({ decision: recovered, disposition: "superseded", recordedAt: 2000 });
			expect(yield* boardOverview(root)).not.toContain(`data-attention-item="${lost.itemId}"`);
			expect(files.receipts().map(files.read).join("\n")).not.toContain('"response":');
			expect((yield* Effect.result(board.decision("task.one", decision, { ...original, revision: "wrong-hash" })))._tag).toBe("Failure");
		}).pipe(Effect.provide(markdownBoard(root).pipe(Layer.provide(NodeServices.layer))));
	},
);

it.effect("keeps duplicates, malformed metadata and changed decision contexts outside receipt closure", function* () {
	const root = yield* boardFolder("withDependency");
	const files = boardHttpFiles(root);
	yield* Effect.gen(function* () {
		const board = yield* BoardGateway;
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
		expect(yield* boardOverview(root)).toContain(`data-attention-item="${receipt.itemId}"`);
		files.write("responses/duplicate-receipt.md", "# No duplicate receipt\n");
		files.write(receipt.sourcePath, source.replace('"managed":true', '"managed":true,"unsupported":true'));
		expect((yield* Effect.result(board.acknowledgeDecision({ decision: receipt, disposition: "superseded", recordedAt: 3000 })))._tag).toBe(
			"Failure",
		);
		files.write(receipt.sourcePath, source.replace('"managed":true', '"managed":false'));
		expect(yield* boardOverview(root)).toContain(`data-attention-item="${receipt.itemId}"`);
	}).pipe(Effect.provide(markdownBoard(root).pipe(Layer.provide(NodeServices.layer))));
});
