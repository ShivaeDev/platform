import { Effect, type FileSystem } from "effect";
import { BadRequest, NotFound, PreconditionFailed, ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { rpcBoundary } from "@shivaedev/platform/server/rpc-server/boundary.ts";
import type { HandoffPreview } from "#browser/handoffs/schema.ts";
import type { ResponseRejection } from "#rpc/rejections.ts";
import { markdownPath } from "#server/files/markdownPath.ts";
import { metadataParse } from "#server/metadata/parse.ts";
import { questionId, revisionOf } from "#server/responses/records.ts";
import type { Snapshot } from "#server/search/snapshot.ts";

export function handoffSource(root: string, realRoot: string, snapshot: Effect.Effect<Snapshot, ResponseRejection>, fs: FileSystem.FileSystem) {
	return Effect.fn("WorkBoard.handoffSource")(function* (item: string) {
		const data = yield* snapshot;
		const matches = data.model.ids.get(item);
		if (data.unavailable.length > 0 || matches?.length !== 1 || !matches[0]) {
			return yield* Effect.fail(new NotFound({ message: "The item is missing, ambiguous or unavailable." }));
		}
		const file = matches[0].file;
		const real = yield* markdownPath(root, realRoot, file);
		if (!real) {
			return yield* Effect.fail(new ServiceUnavailable({ message: "The handoff source could not be read." }));
		}
		const context = yield* fs.readFileString(real).pipe(
			rpcBoundary(ServiceUnavailable, {
				message: "The handoff source could not be read.",
				unexpected: (message) => new ServiceUnavailable({ message }),
			}),
		);
		const fields = metadataParse(context).fields;
		if (fields.id !== item || fields.kind === "question" || fields.response !== undefined || fields.handoff !== undefined) {
			return yield* Effect.fail(new PreconditionFailed({ message: "Choose a current project item for this handoff." }));
		}
		if (new TextEncoder().encode(context).length > 256 * 1024) {
			return yield* Effect.fail(new BadRequest({ message: "Handoff context is limited to 256 KiB. Choose a focused item." }));
		}
		const reviewedRevision = revisionOf(context);
		const preview: HandoffPreview = { context, id: questionId(item, "handoff", reviewedRevision, file), item, reviewedRevision, source: file };
		return preview;
	});
}
