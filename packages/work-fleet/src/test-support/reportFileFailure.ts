import { NodeServices } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { reportAttachmentFiles } from "#host/reportAttachmentFiles.ts";
import { reportBoard } from "#host/reportBoard.ts";
import { BoardGateway } from "#policy.ts";
import { changedReportAttachment } from "#test/changedReportAttachment.ts";
import { engine } from "#test/engineStory.ts";
import { HEAD } from "#test/githubResult.ts";
import { liveBoard } from "#test/liveBoard.ts";
import { mainObservation } from "#test/preparation.ts";
import { reportBoard as reportRoot } from "#test/report.ts";
import { reconstructedAttachment } from "#test/reportAttachmentSafety.ts";

export function reportFileFailure(scenario: "escape" | "oversized-payload" | "changed-file") {
	return engine.trait("configuration", `report collection encounters ${scenario}`, function* (state) {
		const root = yield* reportRoot;
		const work = yield* BoardGateway.pipe(
			Effect.flatMap((board) => board.get("one")),
			Effect.provide(liveBoard(root)),
		);
		let attachment: { readonly folder: string; readonly name: string } | undefined;
		if (scenario === "escape") {
			attachment = yield* reconstructedAttachment("escape");
		}
		if (scenario === "changed-file") {
			attachment = yield* changedReportAttachment;
		}

		state.root = root;
		state.recovery.reportFailure = { path: attachment?.name ?? "", work };
		state.options = {
			...state.options,
			mainQuery: (preparation) => Effect.succeed(mainObservation({ fromRevision: preparation.baseRevision, revision: HEAD })),
			resultUnavailable: true,
		};
		state.board = reportBoard(
			root,
			() => Effect.succeed(false),
			() =>
				attachment === undefined
					? Effect.succeed({ files: [], unavailable: [] })
					: reportAttachmentFiles(attachment.folder, [attachment.name]).pipe(Effect.map((files) => ({ files, unavailable: [] }))),
		).pipe(Layer.provide(liveBoard(root).pipe(Layer.provide(NodeServices.layer))));
	});
}
