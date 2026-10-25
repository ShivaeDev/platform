import { Effect, Layer } from "effect";
import { reportBoard as attachmentReportBoard } from "#host/reportBoard.ts";
import { BoardFailure } from "#policy.ts";
import type { SessionReceipt } from "#session/schema.ts";
import { engine } from "#test/engineStory.ts";
import { HEAD } from "#test/githubResult.ts";
import { mainObservation } from "#test/preparation.ts";
import { lostReportReceipt, reportBoard } from "#test/report.ts";

export function lostReportPublication(attachments = false) {
	return engine.trait("configuration", "the Board loses a report publication receipt", function* (state) {
		const root = yield* reportBoard;
		const publication = lostReportReceipt(root);
		const collectionReceipts: SessionReceipt[] = [];
		const report = { available: true, collectionReceipts, collections: 0, publication };
		state.recovery.report = report;
		state.root = root;
		state.options = {
			...state.options,
			mainQuery: (preparation) => Effect.succeed(mainObservation({ fromRevision: preparation.baseRevision, revision: HEAD })),
			resultUnavailable: true,
		};
		state.board = attachments
			? attachmentReportBoard(
					root,
					() => Effect.succeed(false),
					(observation) => {
						report.collectionReceipts.push(observation.receipt);
						report.collections += 1;
						return report.available
							? Effect.succeed({ files: [{ bytes: new TextEncoder().encode("Original bytes."), path: "evidence.txt" }], unavailable: [] })
							: Effect.fail(new BoardFailure({ message: "Retrieval became unavailable" }));
					},
				).pipe(Layer.provide(publication.board))
			: publication.board;
	});
}
