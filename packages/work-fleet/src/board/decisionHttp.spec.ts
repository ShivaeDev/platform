import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { revisionOf } from "@shivaedev/work-board/responses/records.ts";
import { markdownBoard } from "#board/markdown.ts";
import { BoardGateway } from "#policy.ts";
import { boardFolder } from "#test/boardFolder.ts";
import { boardHttp, boardHttpFiles } from "#test/boardHttp.ts";

const decision = {
	id: "fleet.denied",
	links: ["https://example.test/pr/1"],
	reason: "Delivery authority is denied",
	recommendation: "Update trusted runtime policy, then retry.",
};

it.effect("opens an answerable linked Board decision over real HTTP and records a guided response through native RPC", function* () {
	const root = yield* boardFolder("withDependency");
	const original = readFileSync(join(root, "task.md"), "utf8");
	yield* Effect.gen(function* () {
		const board = yield* BoardGateway;
		const receipt = yield* board.decision("task.one", decision);
		const { client, url } = yield* boardHttp(root);
		const preview = yield* Effect.tryPromise(() => client.run(client.responses.question.run({ item: receipt.itemId, request: receipt.request })));
		expect(preview.id).toBe(receipt.questionId);
		expect(receipt.workSourcePath).toBe("task.md");
		expect(preview.source).toBe(receipt.sourcePath);
		expect(preview.reviewedRevision).toBe(revisionOf(readFileSync(join(root, receipt.sourcePath), "utf8")));
		const page = yield* Effect.tryPromise(() => fetch(`${url}/_board/respond?item=${receipt.itemId}&request=${receipt.request}`));
		expect(page.status).toBe(200);
		expect(yield* Effect.tryPromise(() => page.text())).toContain("fleet-action");
		const saved = yield* Effect.tryPromise(() =>
			client.mutate(
				client.responses.recordResponse.run({
					answers: [{ prompt: "fleet-action", selected: ["retry"], text: "Preserve independent review." }],
					author: "maintainer",
					body: "Policy is now configured. **Keep the scoped checks.**",
					id: "response.retry",
					question: receipt.questionId,
					type: "answer",
				}),
			),
		);
		expect(saved.body).toContain("Keep the scoped checks");
		expect(yield* board.readDecision(receipt)).toEqual({ _tag: "Response", response: saved });
		yield* Effect.gen(function* () {
			const restarted = yield* BoardGateway;
			expect(yield* restarted.decision("task.one", decision)).toEqual(receipt);
			expect(yield* restarted.readDecision(receipt)).toEqual({ _tag: "Response", response: saved });
		}).pipe(Effect.provide(markdownBoard(root).pipe(Layer.provide(NodeServices.layer))));
		expect(readFileSync(join(root, "task.md"), "utf8")).toBe(original);
	}).pipe(Effect.provide(markdownBoard(root).pipe(Layer.provide(NodeServices.layer))));
});

it.effect("keeps clarify and not-now explicit and requires supersession before choosing competing answers", function* () {
	const root = yield* boardFolder("withDependency");
	yield* Effect.gen(function* () {
		const board = yield* BoardGateway;
		const receipt = yield* board.decision("task.one", decision);
		const { client } = yield* boardHttp(root);
		const clarify = yield* Effect.tryPromise(() =>
			client.mutate(
				client.responses.recordResponse.run({
					author: "maintainer",
					body: "Which exact scope needs authority?",
					id: "response.clarify",
					question: receipt.questionId,
					type: "clarify",
				}),
			),
		);
		expect(yield* board.readDecision(receipt)).toEqual({ _tag: "Response", response: clarify });
		const deferred = yield* Effect.tryPromise(() =>
			client.mutate(
				client.responses.recordResponse.run({
					author: "maintainer",
					body: "Wait for policy review.",
					id: "response.deferred",
					question: receipt.questionId,
					supersedes: clarify.id,
					type: "not_now",
				}),
			),
		);
		expect(yield* board.readDecision(receipt)).toEqual({ _tag: "Response", response: deferred });
		const answer = yield* Effect.tryPromise(() =>
			client.mutate(
				client.responses.recordResponse.run({
					answers: [{ prompt: "fleet-action", selected: ["retry"], text: "" }],
					author: "maintainer",
					body: "Retry.",
					id: "response.answer",
					question: receipt.questionId,
					supersedes: deferred.id,
					type: "answer",
				}),
			),
		);
		expect(yield* board.readDecision(receipt)).toEqual({ _tag: "Response", response: answer });
		const resolved = yield* Effect.tryPromise(() =>
			client.mutate(
				client.responses.recordResponse.run({
					answers: [{ prompt: "fleet-action", selected: ["release"], text: "" }],
					author: "maintainer",
					body: "Release instead.",
					id: "response.resolved",
					question: receipt.questionId,
					type: "answer",
				}),
			),
		);
		expect(yield* board.readDecision(receipt)).toEqual({ _tag: "Ambiguous", responseIds: [answer.id, resolved.id] });
	}).pipe(Effect.provide(markdownBoard(root).pipe(Layer.provide(NodeServices.layer))));
});

it.effect("qualifies current answers by exact decision source location, context and original work revision", function* () {
	const root = yield* boardFolder("withDependency");
	const files = boardHttpFiles(root);
	yield* Effect.gen(function* () {
		const board = yield* BoardGateway;
		const receipt = yield* board.decision("task.one", decision);
		const { client } = yield* boardHttp(root);
		const source = readFileSync(join(root, receipt.sourcePath), "utf8");
		files.write(receipt.sourcePath, `${source}\nChanged context.\n`);
		expect((yield* board.readDecision(receipt))._tag).toBe("Stale");
		const recorded = yield* Effect.result(
			Effect.tryPromise(() =>
				client.mutate(
					client.responses.recordResponse.run({
						author: "maintainer",
						body: "Old context.",
						id: "response.stale",
						question: receipt.questionId,
						type: "clarify",
					}),
				),
			),
		);
		expect(recorded._tag).toBe("Failure");
		files.write(receipt.sourcePath, source);
		files.move(receipt.sourcePath, "moved.md");
		expect((yield* board.readDecision(receipt))._tag).toBe("Stale");
		files.move("moved.md", receipt.sourcePath);
		files.move("task.md", "moved-task.md");
		expect((yield* board.readDecision(receipt))._tag).toBe("Stale");
		files.move("moved-task.md", "task.md");
		files.write("task.md", `${files.read("task.md")}\nChanged work.\n`);
		expect((yield* board.readDecision(receipt))._tag).toBe("Stale");
	}).pipe(Effect.provide(markdownBoard(root).pipe(Layer.provide(NodeServices.layer))));
});
