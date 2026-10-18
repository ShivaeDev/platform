import { readdirSync } from "node:fs";
import { join } from "node:path";
import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { revisionOf } from "@shivaedev/work-board/server/responses/records.ts";
import { withBoardReadPass } from "#board/readPass.ts";
import { BoardGateway } from "#policy.ts";
import { boardReads } from "#test/boardReads.ts";

const LIMIT = 256 * 1024;
function observation(output: string, turnId = "first") {
	return { execution: "completed", output, provisioning: "unknown", receipt: { sessionId: "worker", turnId } } as const;
}

it.effect("publishes a report into the current snapshot without rescanning and retains it in the next pass", function* () {
	const fixture = yield* boardReads(1);
	yield* Effect.gen(function* () {
		const board = yield* BoardGateway;
		const report = yield* withBoardReadPass(
			Effect.gen(function* () {
				const work = yield* board.get("item.0");
				const input = observation("# Findings\n\nComplete evidence.\n");
				const published = yield* board.report(work, input);
				const result = yield* board.get(published.itemId);
				expect(result.context.endsWith(input.output)).toBe(true);
				expect(revisionOf(result.context)).toBe(published.revision);
				expect(result.sourcePath).toBe(join(fixture.root, published.sourcePath));
				expect(yield* board.report(work, input)).toEqual(published);
				return published;
			}),
		);
		expect(fixture.scans()).toBe(1);
		expect([...fixture.reads.values()]).toEqual([1]);
		expect(revisionOf((yield* withBoardReadPass(board.get(report.itemId))).context)).toBe(report.revision);
		expect(fixture.scans()).toBe(3);
	}).pipe(Effect.provide(fixture.board));
});

it.effect("checks complete UTF-8 bytes including receipt overhead before publishing, accepting exactly 256 KiB", function* () {
	const fixture = yield* boardReads(1);
	yield* withBoardReadPass(
		Effect.gen(function* () {
			const board = yield* BoardGateway;
			const work = yield* board.get("item.0");
			const small = yield* board.report(work, observation("x"));
			const source = (yield* board.get(small.itemId)).context;
			const available = LIMIT - new TextEncoder().encode(source).length + 1;
			const exact = "界".repeat(Math.floor(available / 3)) + "x".repeat(available % 3);
			const report = yield* board.report(work, observation(exact, "bound"));
			expect(new TextEncoder().encode((yield* board.get(report.itemId)).context).length).toBe(LIMIT);
			for (const output of [`${exact}x`, "界".repeat(Math.floor(LIMIT / 3))]) {
				const failure = yield* board.report(work, observation(output, "large")).pipe(Effect.flip);
				expect(failure.message).toContain("256 KiB");
				expect(failure.message).toContain("including metadata and receipt");
			}
			expect(readdirSync(join(fixture.root, "responses"))).toHaveLength(2);
		}),
	).pipe(Effect.provide(fixture.board));
});

for (const wholeFileRevision of [false, true]) {
	it.effect(
		`${wholeFileRevision ? "saved whole-file" : "authored brief"} report publication survives bookkeeping edits and rejects changed briefs and forged identities`,
		function* () {
			const fixture = yield* boardReads(1);
			yield* Effect.gen(function* () {
				const board = yield* BoardGateway;
				const work = yield* board.get("item.0");
				const original = { ...work, revision: wholeFileRevision ? revisionOf(work.context) : work.revision };
				yield* fixture.write("0.md", original.context.replace("id: item.0", "id: item.0\nstatus: done\nnext_action: Work completed."));
				const report = yield* board.report(original, observation("Complete findings."));
				expect(report.workRevision).toBe(original.revision);
				expect(yield* board.report(original, observation("Complete findings."))).toEqual(report);
				expect(revisionOf((yield* board.get(report.itemId)).context)).toBe(report.revision);
				const forged = { ...original, context: original.context.replace("id: item.0", "id: other") };
				expect((yield* Effect.result(board.report(forged, observation("Forged report.", "forged"))))._tag).toBe("Failure");
				yield* fixture.write("0.md", `${original.context}\nChanged scope.\n`);
				expect((yield* Effect.result(board.report(original, observation("Stale report.", "stale"))))._tag).toBe("Failure");
			}).pipe(Effect.provide(fixture.board));
		},
	);
}
