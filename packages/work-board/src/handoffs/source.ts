import { Effect, type FileSystem } from "effect";
import type { HandoffPreview } from "#browser/handoffs/schema.ts";
import { ResponseFailed } from "#browser/responses/schema.ts";
import { markdownPath } from "#files/markdownPath.ts";
import { metadataParse } from "#metadata/parse.ts";
import { questionId, revisionOf } from "#responses/records.ts";
import type { Snapshot } from "#search/snapshot.ts";

export function handoffSource(root: string, realRoot: string, snapshot: Effect.Effect<Snapshot, ResponseFailed>, fs: FileSystem.FileSystem) {
	return Effect.fn("WorkBoard.handoffSource")(function* (item: string) {
		const data = yield* snapshot;
		const matches = data.model.ids.get(item);
		if (data.unavailable.length > 0 || matches?.length !== 1 || !matches[0]) {
			return yield* Effect.fail(new ResponseFailed({ code: "Missing", message: "The item is missing, ambiguous or unavailable." }));
		}
		const file = matches[0].file;
		const real = yield* markdownPath(root, realRoot, file);
		const context = real ? yield* fs.readFileString(real).pipe(Effect.catch(() => Effect.succeed(undefined))) : undefined;
		if (context === undefined) {
			return yield* Effect.fail(new ResponseFailed({ code: "Unavailable", message: "The handoff source could not be read." }));
		}
		const fields = metadataParse(context).fields;
		if (fields.id !== item || fields.kind === "question" || fields.kind === "response" || fields.kind === "handoff") {
			return yield* Effect.fail(new ResponseFailed({ code: "Stale", message: "Choose a current project item for this handoff." }));
		}
		if (new TextEncoder().encode(context).length > 256 * 1024) {
			return yield* Effect.fail(
				new ResponseFailed({ code: "Unsupported", message: "Handoff context is limited to 256 KiB. Choose a focused item." }),
			);
		}
		const reviewedRevision = revisionOf(context);
		const preview: HandoffPreview = { context, id: questionId(item, "handoff", reviewedRevision, file), item, reviewedRevision, source: file };
		return preview;
	});
}
