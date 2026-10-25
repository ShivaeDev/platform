import { NodeServices } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { markdownBoard } from "#board/markdown.ts";
import { reportAttachmentFiles } from "#host/reportAttachmentFiles.ts";
import { reportBoard } from "#host/reportBoard.ts";
import { BoardGateway } from "#policy.ts";
import { changedReportAttachment } from "#test/changedReportAttachment.ts";
import { engine } from "#test/engineStory.ts";
import { reportBoard as reportRoot } from "#test/report.ts";
import { reconstructedAttachment } from "#test/reportAttachmentSafety.ts";

export function reportFileFailure(scenario: "escape" | "oversized-payload" | "changed-file") {
	return engine.trait("configuration", `report collection encounters ${scenario}`, function* (state) {
		const root = yield* reportRoot;
		const work = yield* BoardGateway.pipe(
			Effect.flatMap((board) => board.get("one")),
			Effect.provide(markdownBoard(root)),
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
		state.options = { ...state.options, resultUnavailable: true };
		state.board = reportBoard(
			root,
			() => Effect.succeed(false),
			() =>
				attachment === undefined
					? Effect.succeed({ files: [], unavailable: [] })
					: reportAttachmentFiles(attachment.folder, [attachment.name]).pipe(Effect.map((files) => ({ files, unavailable: [] }))),
		).pipe(Layer.provide(markdownBoard(root).pipe(Layer.provide(NodeServices.layer))));
	});
}
