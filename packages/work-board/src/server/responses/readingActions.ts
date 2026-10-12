import { Effect } from "effect";
import { responseUrl } from "#responses/url.ts";
import { authoredQuestion } from "#server/attention/inbox.ts";
import type { MetadataDocument } from "#server/metadata/model.ts";
import { Responses } from "./service.ts";
import { questionTemplate } from "./template.ts";

export const readingActions = Effect.fn("WorkBoard.readingActions")(function* (
	document: MetadataDocument,
	source: string,
	enabled: boolean,
	identity: string | undefined,
) {
	if (!(enabled && identity)) {
		return undefined;
	}
	const service = yield* Responses;
	const item = identity;
	const requests = authoredQuestion(document) ? ["answer"] : (document.parsed.fields.attention ?? []).map((request) => request.id);
	const actions = new Map<string, string>();
	for (const request of requests) {
		const question = yield* service.locate(item, request).pipe(Effect.option);
		if (question._tag === "Some" && question.value.context === source) {
			for (const prompt of questionTemplate(source, request).prompts) {
				actions.set(`${request}/${prompt.id}`, responseUrl(item, request));
				actions.set(`/${prompt.id}`, responseUrl(item, request));
			}
		}
	}
	return actions;
});
