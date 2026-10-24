import { Effect, Layer } from "effect";
import { markdownBoard } from "#board/markdown.ts";
import { reportBoard } from "#host/reportBoard.ts";
import { BoardFailure, BoardGateway, type BoardWork } from "#policy.ts";
import type { ReportAttachments } from "#reportAttachments.ts";
import { lostReportReceipt } from "#test/report.ts";

export const REPORT_OBSERVATION = {
	execution: "completed",
	output: "Findings.\nFLEET_ATTACHMENT: evidence.txt",
	provisioning: "ready",
	receipt: { sessionId: "worker", turnId: "turn" },
} as const;
export function reportPublicationVerbs(root: string, tell: (line: string) => void) {
	let collections = 0;
	let work: BoardWork | undefined;
	return {
		collections: () => collections,
		publish: (initial: ReportAttachments, boundary: "before-publication" | "lost-acknowledgement") =>
			Effect.gen(function* () {
				tell(`publish a report at the ${boundary} boundary`);
				const publication = lostReportReceipt(root);
				const beforePublication = Layer.effect(BoardGateway)(
					Effect.map(BoardGateway, (original) => ({
						...original,
						report: () => Effect.fail(new BoardFailure({ message: "Publication unavailable" })),
					})),
				).pipe(Layer.provide(markdownBoard(root)));
				const layer = reportBoard(
					root,
					() => Effect.succeed(false),
					() => {
						collections += 1;
						return Effect.succeed(initial);
					},
				).pipe(Layer.provide(boundary === "lost-acknowledgement" ? publication.board : beforePublication));
				return yield* Effect.gen(function* () {
					const board = yield* BoardGateway;
					work = yield* board.get("one");
					return yield* Effect.result(board.report(work, REPORT_OBSERVATION));
				}).pipe(Effect.provide(layer));
			}),
		recover: (later: ReportAttachments | undefined) =>
			Effect.gen(function* () {
				tell("restart report publication with a changed attachment source");
				if (work === undefined) {
					return yield* Effect.die("Publish a report before recovering it");
				}
				const current = work;
				const layer = reportBoard(
					root,
					() => Effect.succeed(false),
					() => {
						collections += 1;
						return later === undefined ? Effect.fail(new BoardFailure({ message: "Retrieval now unavailable" })) : Effect.succeed(later);
					},
				).pipe(Layer.provide(markdownBoard(root)));
				return yield* Effect.flatMap(BoardGateway, (board) => board.report(current, REPORT_OBSERVATION)).pipe(Effect.provide(layer));
			}),
	};
}
