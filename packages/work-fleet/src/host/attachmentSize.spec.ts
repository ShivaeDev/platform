import { readdirSync } from "node:fs";
import { join } from "node:path";
import { expect } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { reportBoard } from "#host/reportBoard.ts";
import { BoardGateway } from "#policy.ts";
import { boardReads } from "#test/boardReads.ts";

it.effect("rejects oversized reports including attachment links before writing an attachments folder", function* () {
	const fixture = yield* boardReads(1);
	const boardLayer = reportBoard(
		fixture.root,
		() => Effect.succeed(false),
		() => Effect.succeed([{ bytes: Uint8Array.of(42), path: "evidence.txt" }]),
	).pipe(Layer.provide(fixture.board));
	const observation = { execution: "completed", output: "x", provisioning: "unknown", receipt: { sessionId: "worker", turnId: "small" } } as const;
	const small = yield* Effect.gen(function* () {
		const board = yield* BoardGateway;
		const work = yield* board.get("item.0");
		const report = yield* board.report(work, observation);
		return (yield* board.get(report.itemId)).context;
	}).pipe(Effect.provide(fixture.board));
	const available = 256 * 1024 - new TextEncoder().encode(small).length + 1;
	const exact = "界".repeat(Math.floor(available / 3)) + "x".repeat(available % 3);
	yield* Effect.gen(function* () {
		const board = yield* BoardGateway;
		const work = yield* board.get("item.0");
		for (const output of [exact, "界".repeat((256 * 1024) / 3)]) {
			const failure = yield* board.report(work, { ...observation, output, receipt: { ...observation.receipt, turnId: "large" } }).pipe(Effect.flip);
			expect(failure.message).toContain("256 KiB");
			expect(readdirSync(join(fixture.root, "responses"))).toHaveLength(1);
		}
	}).pipe(Effect.provide(boardLayer));
});
