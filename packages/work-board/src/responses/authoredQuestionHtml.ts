import { Effect, type FileSystem, type Path } from "effect";
import { openItem } from "#attention/inbox.ts";
import type { QuestionPreview } from "#browser/responses/schema.ts";
import type { MetadataDocument } from "#metadata/model.ts";
import { escapeHtml } from "#page/escape.ts";
import type { RenderFailed } from "#render/failed.ts";
import type { Highlighter } from "#render/highlighter.ts";
import { composerHtml } from "./composerHtml.ts";
import { historyHtml } from "./historyHtml.ts";
import { questionId, revisionOf } from "./records.ts";
import type { responseService } from "./service.ts";

export const authoredQuestionHtml = Effect.fn("WorkBoard.authoredQuestionHtml")(function* (
	document: MetadataDocument,
	source: string,
	service: Effect.Success<ReturnType<typeof responseService>>,
	enabled: boolean,
): Effect.fn.Return<string, RenderFailed, Highlighter | FileSystem.FileSystem | Path.Path> {
	const item = document.parsed.fields.id ?? "";
	const revision = revisionOf(source);
	const preview: QuestionPreview = {
		context: source,
		id: questionId(item, "answer", revision, document.file),
		item,
		reason: document.parsed.fields.nextAction ?? "A question needs your answer",
		request: "answer",
		reviewedRevision: revision,
		source: document.file,
	};
	const records = yield* service.history(preview).pipe(Effect.result);
	const history =
		records._tag === "Success"
			? yield* historyHtml(preview, records.success)
			: '<p role="status">Recorded responses are unavailable. Check the workspace source issues and retry.</p>';
	if (!openItem(document)) {
		return `<section class="response-panel"><h2>Question closed</h2><p role="status">This question is closed. Recorded answers remain below.</p>${history}</section>`;
	}
	return yield* service.locate(item, "answer").pipe(
		Effect.flatMap((question) => (records._tag === "Success" ? composerHtml(question, records.success, enabled) : Effect.succeed(history))),
		Effect.catch((error) =>
			Effect.succeed(
				`<section class="response-panel"><h2>Answer unavailable</h2><p role="status">${escapeHtml(error.message)}</p>${history}</section>`,
			),
		),
	);
});
