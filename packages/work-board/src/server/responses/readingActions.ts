import { Effect } from "effect";
import { BadRequest } from "@shivaedev/platform/errors/taxonomy.ts";
import { responseUrl } from "#responses/url.ts";
import { authoredQuestion } from "#server/attention/inbox.ts";
import type { MetadataDocument } from "#server/metadata/model.ts";
import type { locate } from "./locate.ts";
import { questionSourceMatches } from "./questionSourceMatches.ts";
import { questionTemplate } from "./template.ts";

export const readingActions = Effect.fn("WorkBoard.readingActions")(function* (
	document: MetadataDocument,
	source: string,
	enabled: boolean,
	identity: string | undefined,
	locateQuestion: ReturnType<typeof locate>,
) {
	if (!(enabled && identity)) {
		return undefined;
	}
	const item = identity;
	const requests = authoredQuestion(document) ? ["answer"] : (document.parsed.fields.attention ?? []).map((request) => request.id);
	const actions = new Map<string, string>();
	for (const request of requests) {
		const question = yield* locateQuestion(item, request).pipe(Effect.option);
		if (question._tag === "Some" && questionSourceMatches(question.value, document)) {
			const template = yield* Effect.try({
				catch: (cause) => new BadRequest({ message: cause instanceof Error ? cause.message : "Review the question template and retry." }),
				try: () => questionTemplate(source, request),
			}).pipe(Effect.option);
			for (const prompt of template._tag === "Some" ? template.value.prompts : []) {
				actions.set(`${request}/${prompt.id}`, responseUrl(item, request));
				actions.set(`/${prompt.id}`, responseUrl(item, request));
			}
		}
	}
	return actions;
});
