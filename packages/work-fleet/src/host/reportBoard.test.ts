import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { markdownBoard } from "#board/markdown.ts";
import { reportFileName } from "#board/reportLinks.ts";
import { reportBoard } from "#host/reportBoard.ts";
import { BoardFailure, BoardGateway } from "#policy.ts";
import type { ReportAttachments } from "#reportAttachments.ts";
import { lostReportReceipt, reportBoard as reportRoot } from "#test/report.ts";

const ORIGINAL: ReportAttachments = { files: [{ bytes: new TextEncoder().encode("Original evidence.\n"), path: "evidence.txt" }], unavailable: [] };
const EMPTY: ReportAttachments = { files: [], unavailable: [] };
const MISSING: ReportAttachments = { files: [], unavailable: [{ path: "evidence.txt", reason: "Unavailable on first retrieval" }] };
const CHANGED: ReportAttachments = { files: [{ bytes: new TextEncoder().encode("Changed evidence.\n"), path: "evidence.txt" }], unavailable: [] };
const OBSERVATION = {
	execution: "completed",
	output: "Findings.\nFLEET_ATTACHMENT: evidence.txt",
	provisioning: "ready",
	receipt: { sessionId: "worker", turnId: "turn" },
} as const;

for (const boundary of ["before-publication", "lost-acknowledgement"] as const) {
	for (const [outcome, initial, later] of [
		["changed bytes", ORIGINAL, CHANGED],
		["retrieval failure", ORIGINAL, undefined],
		["attachments becoming available", MISSING, ORIGINAL],
		["an empty collection becoming populated", EMPTY, ORIGINAL],
	] as const) {
		it.live(`restarts ${boundary} with ${outcome} and reuses the exact publication payload`, () =>
			Effect.gen(function* () {
				const root = yield* reportRoot;
				const publication = lostReportReceipt(root);
				const beforePublication = Layer.effect(BoardGateway)(
					Effect.gen(function* () {
						const original = yield* BoardGateway;
						return { ...original, report: () => Effect.fail(new BoardFailure({ message: "Publication unavailable" })) };
					}),
				).pipe(Layer.provide(markdownBoard(root)));
				let collections = 0;
				function collect() {
					collections += 1;
					return Effect.succeed(initial);
				}
				const first = reportBoard(root, () => Effect.succeed(false), collect).pipe(
					Layer.provide(boundary === "lost-acknowledgement" ? publication.board : beforePublication),
				);
				const work = yield* Effect.gen(function* () {
					const board = yield* BoardGateway;
					const current = yield* board.get("one");
					expect((yield* Effect.result(board.report(current, OBSERVATION)))._tag).toBe("Failure");
					return current;
				}).pipe(Effect.provide(first));
				const retry = reportBoard(
					root,
					() => Effect.succeed(false),
					() => {
						collections += 1;
						return later === undefined ? Effect.fail(new BoardFailure({ message: "Retrieval now unavailable" })) : Effect.succeed(later);
					},
				).pipe(Layer.provide(markdownBoard(root)));
				const recovered = yield* Effect.gen(function* () {
					const board = yield* BoardGateway;
					return yield* board.report(work, OBSERVATION);
				}).pipe(Effect.provide(retry));
				const content = readFileSync(join(root, recovered.sourcePath), "utf8");
				expect(collections).toBe(1);
				expect(content).toContain(OBSERVATION.output);
				if (initial.files.length > 0) {
					const file = initial.files[0];
					if (file === undefined) {
						return yield* Effect.die(new Error("Missing initial attachment"));
					}
					expect(readFileSync(join(root, "responses", `${recovered.itemId}.attachments`, reportFileName(file.path)))).toEqual(
						Buffer.from(file.bytes),
					);
				}
				if (initial === MISSING) {
					expect(content).toContain("Unavailable on first retrieval");
				} else if (initial === EMPTY) {
					expect(content.endsWith(OBSERVATION.output)).toBe(true);
				}
			}).pipe(Effect.provide(NodeServices.layer)),
		);
	}
}
