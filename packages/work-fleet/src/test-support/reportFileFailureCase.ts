import { mkdir, truncate, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { markdownBoard } from "#board/markdown.ts";
import { reportIdentity } from "#board/reportIdentity.ts";
import { Fleet } from "#fleet.ts";
import { reportAttachmentFiles } from "#host/reportAttachmentFiles.ts";
import { reportBoard } from "#host/reportBoard.ts";
import { BoardGateway } from "#policy.ts";
import { REPORT_LIMITS } from "#reportLimits.ts";
import { changedReportAttachment } from "#test/changedReportAttachment.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { reportBoard as reportRoot } from "#test/report.ts";
import { reconstructedAttachment } from "#test/reportAttachmentSafety.ts";

export const reportFileFailureCase = Effect.fnUntraced(function* (scenario: "escape" | "oversized-payload" | "changed-file") {
	const root = yield* reportRoot;
	const work = yield* BoardGateway.pipe(
		Effect.flatMap((board) => board.get("one")),
		Effect.provide(markdownBoard(root)),
	);
	let attachment: { readonly folder: string; readonly name: string } | undefined;
	if (scenario === "escape") {
		attachment = yield* reconstructedAttachment("escape");
	} else if (scenario === "changed-file") {
		attachment = yield* changedReportAttachment;
	}
	const collector = reportBoard(
		root,
		() => Effect.succeed(false),
		() =>
			attachment === undefined
				? Effect.succeed({ files: [], unavailable: [] })
				: reportAttachmentFiles(attachment.folder, [attachment.name]).pipe(Effect.map((files) => ({ files, unavailable: [] }))),
	).pipe(Layer.provide(markdownBoard(root).pipe(Layer.provide(NodeServices.layer))));
	return yield* withEngine(
		{ resultUnavailable: true },
		(fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				let path = attachment?.name ?? "";
				if (scenario === "oversized-payload") {
					const [observation] = fixture.observations.values();
					if (observation === undefined) {
						return yield* Effect.die("Missing synthetic report worker");
					}
					const { itemId } = reportIdentity(work, observation.receipt);
					path = `.fleet-reports/${itemId}.json`;
					yield* Effect.promise(async () => {
						await mkdir(join(root, ".fleet-reports"));
						await writeFile(join(root, path), "");
						await truncate(join(root, path), REPORT_LIMITS.attachmentBytes * 2 + 512 * 1024 + 1);
					});
				}
				const parked = yield* fleet.reconcile("one");
				return { launched: fixture.launched, parked: parked.value, path, stored: (yield* fleet.get("one")).value };
			}),
		collector,
	);
}, Effect.provide(NodeServices.layer));
