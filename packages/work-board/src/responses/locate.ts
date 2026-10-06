import { Effect, type FileSystem } from "effect";
import { attentionRequests } from "#attention/requests.ts";
import { type QuestionPreview, ResponseFailed } from "#browser/responses/schema.ts";
import { markdownPath } from "#files/markdownPath.ts";
import { metadataModel } from "#metadata/model.ts";
import { metadataParse } from "#metadata/parse.ts";
import type { Snapshot } from "#search/snapshot.ts";
import { questionId, revisionOf } from "./records.ts";
import { questionTemplate } from "./template.ts";

function reject(code: ResponseFailed["code"], message: string) {
	return Effect.fail(new ResponseFailed({ code, message }));
}
export function locate(root: string, realRoot: string, snapshot: Effect.Effect<Snapshot, ResponseFailed>, fs: FileSystem.FileSystem) {
	return Effect.fn("WorkBoard.locate")(function* (item: string, request: string) {
		const data = yield* snapshot;
		const entry = attentionRequests(data).entries.find((candidate) => candidate.itemId === item && candidate.request.id === request);
		if (!entry) {
			return yield* reject("Missing", "The exact open attention request is missing, ambiguous or unavailable.");
		}
		const real = yield* markdownPath(root, realRoot, entry.document.file);
		if (!real) {
			return yield* reject("Missing", "The reviewed source moved or disappeared.");
		}
		const source = yield* fs.readFileString(real).pipe(Effect.catch(() => reject("Unavailable", "The source could not be read.")));
		if (new TextEncoder().encode(source).length > 256 * 1024) {
			return yield* reject("Unsupported", "Question context is limited to 256 KiB; use a focused source document.");
		}
		const parsed = metadataParse(source);
		if (
			parsed.fields.id !== item
			|| parsed.fields.attention?.filter((candidate) => candidate.id === request && candidate.state === "open").length !== 1
		) {
			return yield* reject("Stale", "The source request changed. Re-read the question before proceeding.");
		}
		const documents = [...data.documents.filter((document) => document.file !== entry.document.file), { file: entry.document.file, parsed }];
		const model = metadataModel(documents, data.unavailable, data.model.rootFile);
		const fresh = attentionRequests({ ...data, documents, model }).entries.find(
			(candidate) => candidate.itemId === item && candidate.request.id === request,
		)?.request;
		if (!fresh) {
			return yield* reject("Stale", "The current request or its references are invalid. Review the source diagnostics before registering it.");
		}
		const revision = revisionOf(source);
		yield* Effect.try({
			catch: (cause) => new ResponseFailed({ code: "Unsupported", message: `Invalid response template: ${String(cause)}` }),
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
