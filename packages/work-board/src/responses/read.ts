import { Effect } from "effect";
import { ResponseFailed } from "#browser/responses/schema.ts";
import type { MetadataDocument } from "#metadata/model.ts";
import type { Snapshot } from "#search/snapshot.ts";
import { malformedResponse, questionFrom, responsesFor } from "./records.ts";

function reject(code: ResponseFailed["code"], message: string) {
	return Effect.fail(new ResponseFailed({ code, message }));
}
const registeredQuestion = Effect.fn("WorkBoard.registeredQuestion")(function* (matches: readonly MetadataDocument[] | undefined) {
	if (!matches?.length) {
		return yield* reject("Missing", "The registered question is missing.");
	}
	if (matches.length !== 1) {
		return yield* reject("Conflict", "The registered question identity is ambiguous; response history is unknown.");
	}
	const question = matches[0] && questionFrom(matches[0]);
	if (!question) {
		return yield* reject("Conflict", "This identity is not a valid registered question; response history is unknown.");
	}
	return question;
});
export function readResponses(snapshot: Effect.Effect<Snapshot, ResponseFailed>) {
	return Effect.fn("WorkBoard.read")(function* (id: string) {
		const data = yield* snapshot;
		if (data.unavailable.length > 0) {
			return yield* reject("Unavailable", "The workspace index is incomplete; no response can be selected safely.");
		}
		const question = yield* registeredQuestion(data.model.ids.get(id));
		if (new TextEncoder().encode(question.context).length > 256 * 1024) {
			return yield* reject("Unsupported", "The registered context exceeds the 256 KiB limit.");
		}
		if (data.documents.some(malformedResponse)) {
			return yield* reject("Unavailable", "A response record is malformed; response history cannot be established safely.");
		}
		const result = responsesFor(data.documents, question);
		if (result.responses.some((candidate) => candidate.body.length > 32_768)) {
			return yield* reject("Unsupported", "A recorded response exceeds the supported text limit; read its source file directly.");
		}
		if (result.responses.some((candidate) => data.model.ids.get(candidate.id)?.length !== 1)) {
			return yield* reject("Conflict", "A response identity is duplicated; no answer is selected.");
		}
		return result;
	});
}
