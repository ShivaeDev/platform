import { Effect, Layer } from "effect";
import { reportBoard as attachmentReportBoard } from "#host/reportBoard.ts";
import { BoardFailure } from "#policy.ts";
import { engine } from "#test/engineStory.ts";
import { lostReportReceipt, reportBoard } from "#test/report.ts";

export function lostReportPublication(attachments = false) {
	return engine.trait("configuration", "the Board loses a report publication receipt", function* (state) {
		const root = yield* reportBoard;
		const publication = lostReportReceipt(root);
		const report = { available: true, collections: 0, publication };
		state.recovery.report = report;
		state.root = root;
		state.options = { ...state.options, resultUnavailable: true };
		state.board = attachments
			? attachmentReportBoard(
					root,
					() => Effect.succeed(false),
					() => {
						report.collections += 1;
						return report.available
							? Effect.succeed({ files: [{ bytes: new TextEncoder().encode("Original bytes."), path: "evidence.txt" }], unavailable: [] })
							: Effect.fail(new BoardFailure({ message: "Retrieval became unavailable" }));
					},
				).pipe(Layer.provide(publication.board))
			: publication.board;
	});
}
