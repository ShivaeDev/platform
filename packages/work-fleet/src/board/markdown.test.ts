import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import { Effect, Exit, Layer } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { metadataParse } from "@shivaedev/work-board/metadata/parse.ts";
import { questionFrom } from "@shivaedev/work-board/responses/records.ts";
import { markdownBoard } from "#board/markdown.ts";
import { BoardGateway } from "#policy.ts";
import { boardFolder } from "#test/boardFolder.ts";

it.effect("reads stable Board identity and publishes a durable retryable Board decision", function* () {
	const root = yield* boardFolder("withDependency");
	yield* Effect.gen(function* () {
		const board = yield* BoardGateway;
		const work = yield* board.get("task.one");
		expect(work.dependsOn).toEqual(["task.before"]);
		expect(work.context).toContain("# Useful work");
		const decision = {
			id: "fleet.denied",
			links: ["https://example.test/pr/1"],
			reason: "Delivery authority is denied",
			recommendation: "Approve exact scope through trusted runtime policy",
		};
		const receipt = yield* board.decision(work.workId, decision);
		expect(yield* board.decision(work.workId, decision)).toEqual(receipt);
		const files = readdirSync(join(root, "responses"));
		expect(files).toHaveLength(2);
		const source = `responses/${receipt.questionId}.md`;
		const parsed = metadataParse(readFileSync(join(root, source), "utf8"));
		expect(questionFrom({ file: source, parsed })?.question.item).toBe(receipt.itemId);
		expect(yield* board.readDecision(receipt)).toEqual({ _tag: "Pending" });
	}).pipe(Effect.provide(markdownBoard(root).pipe(Layer.provide(NodeServices.layer))));
});

it.effect("refuses ambiguous IDs and malformed metadata instead of selecting a task", function* () {
	const root = yield* boardFolder("ambiguousIdentity");
	const result = yield* Effect.gen(function* () {
		const board = yield* BoardGateway;
		return yield* Effect.exit(board.get("same"));
	}).pipe(Effect.provide(markdownBoard(root).pipe(Layer.provide(NodeServices.layer))));
	expect(Exit.isFailure(result)).toBe(true);
});
