import { Effect, type FileSystem } from "effect";
import { BadRequest, NotFound, PreconditionFailed, ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { rpcBoundary } from "@shivaedev/platform/server/rpc-server/boundary.ts";
import type { QuestionPreview } from "#browser/responses/schema.ts";
import type { ResponseRejection } from "#rpc/rejections.ts";
import { currentDocument } from "#server/currentDocument.ts";
import { markdownPath } from "#server/files/markdownPath.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import { questionId, revisionOf } from "./records.ts";
import { requestSource } from "./requestSource.ts";
import { questionTemplate } from "./template.ts";

export function locate(root: string, realRoot: string, snapshot: Effect.Effect<Snapshot, ResponseRejection>, fs: FileSystem.FileSystem) {
	return Effect.fn("WorkBoard.locate")(function* (item: string, request: string) {
		const data = yield* snapshot;
		const entry = requestSource(data, item, request);
		if (!entry) {
			return yield* Effect.fail(new NotFound({ message: "The exact open attention request is missing, ambiguous or unavailable." }));
		}
		const real = yield* markdownPath(root, realRoot, entry.document.file);
		if (!real) {
			return yield* Effect.fail(new NotFound({ message: "The reviewed source moved or disappeared." }));
		}
		const source = yield* fs
			.readFileString(real)
			.pipe(
				rpcBoundary(ServiceUnavailable, { message: "The source could not be read.", unexpected: (message) => new ServiceUnavailable({ message }) }),
			);
		if (new TextEncoder().encode(source).length > 256 * 1024) {
			return yield* Effect.fail(new BadRequest({ message: "Question context is limited to 256 KiB; use a focused source document." }));
		}
		const current = currentDocument(data, entry.document.file, source, data.model.rootFile);
		const fresh = requestSource(current.snapshot, item, request);
		if (!fresh) {
			return yield* Effect.fail(
				new PreconditionFailed({
					message: "The current request or its references are invalid. Review the source diagnostics before registering it.",
				}),
			);
		}
		const revision = revisionOf(source);
		yield* Effect.try({
			catch: (cause) => new BadRequest({ message: `Invalid response template: ${cause instanceof Error ? cause.message : String(cause)}` }),
			try: () => questionTemplate(source, request),
		});
		const question: QuestionPreview = {
			context: source,
			id: questionId(item, request, revision, entry.document.file),
			item,
			reason: fresh.reason,
			request,
			reviewedRevision: revision,
			source: entry.document.file,
		};
		return question;
	});
}
