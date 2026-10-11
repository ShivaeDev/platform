import { Effect } from "effect";
import { authoredQuestion } from "#attention/inbox.ts";
import type { MetadataDocument } from "#metadata/model.ts";
import type { responseService } from "./service.ts";
import { questionTemplate } from "./template.ts";
import { responseUrl } from "./url.ts";

export const readingActions = Effect.fn("WorkBoard.readingActions")(function* (
	document: MetadataDocument,
	source: string,
	service: Effect.Success<ReturnType<typeof responseService>> | undefined,
	enabled: boolean,
	identity: string | undefined,
) {
	if (!(service && enabled && identity)) {
		return undefined;
	}
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
