import { Effect } from "effect";
import { BadRequest, Conflict, NotFound, ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import type { ResponseRejection } from "#rpc/rejections.ts";
import type { MetadataDocument } from "#server/metadata/model.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import { malformedResponse, questionFrom, responsesFor } from "./records.ts";

const registeredQuestion = Effect.fn("WorkBoard.registeredQuestion")(function* (matches: readonly MetadataDocument[] | undefined) {
	if (!matches?.length) {
		return yield* Effect.fail(new NotFound({ message: "The registered question is missing." }));
	}
	if (matches.length !== 1) {
		return yield* Effect.fail(new Conflict({ message: "The registered question identity is ambiguous; response history is unknown." }));
	}
	const question = matches[0] && questionFrom(matches[0]);
	if (!question) {
		return yield* Effect.fail(new Conflict({ message: "This identity is not a valid registered question; response history is unknown." }));
	}
	return question;
});
export function readResponses(snapshot: Effect.Effect<Snapshot, ResponseRejection>) {
	return Effect.fn("WorkBoard.read")(function* (id: string) {
		const data = yield* snapshot;
		if (data.unavailable.length > 0) {
			return yield* Effect.fail(new ServiceUnavailable({ message: "The workspace index is incomplete; no response can be selected safely." }));
		}
		const question = yield* registeredQuestion(data.model.ids.get(id));
		if (new TextEncoder().encode(question.context).length > 256 * 1024) {
			return yield* Effect.fail(new BadRequest({ message: "The registered context exceeds the 256 KiB limit." }));
		}
		if (data.documents.some(malformedResponse)) {
			return yield* Effect.fail(
				new ServiceUnavailable({ message: "A response record is malformed; response history cannot be established safely." }),
			);
		}
		const result = responsesFor(data.documents, question);
		if (result.responses.some((candidate) => candidate.body.length > 32_768)) {
			return yield* Effect.fail(new BadRequest({ message: "A recorded response exceeds the supported text limit; read its source file directly." }));
		}
		if (result.responses.some((candidate) => data.model.ids.get(candidate.id)?.length !== 1)) {
			return yield* Effect.fail(new Conflict({ message: "A response identity is duplicated; no answer is selected." }));
		}
		return result;
	});
}
