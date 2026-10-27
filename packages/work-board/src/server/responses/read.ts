import { Effect } from "effect";
import { BadRequest, Conflict, NotFound, ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import type { Reading } from "#browser/responses/schema.ts";
import type { ResponseRejection } from "#rpc/rejections.ts";
import type { MetadataDocument, MetadataModel } from "#server/metadata/model.ts";
import { responseIndex } from "#server/responseIndex.ts";
import type { Snapshot } from "#server/search/snapshot.ts";

const registeredQuestion = Effect.fn("WorkBoard.registeredQuestion")(function* (
	matches: readonly MetadataDocument[] | undefined,
	model: MetadataModel,
) {
	if (!matches?.length) {
		return yield* Effect.fail(new NotFound({ message: "The registered question is missing." }));
	}
	if (matches.length !== 1) {
		return yield* Effect.fail(new Conflict({ message: "The registered question identity is ambiguous; response history is unknown." }));
	}
	const question = matches[0] && responseIndex(model).questions.get(matches[0].file);
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
		return yield* readHistory(data, id, true);
	});
}
// The result view checks the files that could hold its own feedback, so it reads without the workspace-wide malformed gate.
export const readHistory = Effect.fn("WorkBoard.readHistory")(function* (data: Snapshot, id: string, requireWellFormed: boolean) {
	const question = yield* registeredQuestion(data.model.ids.get(id), data.model);
	if (new TextEncoder().encode(question.context).length > 256 * 1024) {
		return yield* Effect.fail(new BadRequest({ message: "The registered context exceeds the 256 KiB limit." }));
	}
	const index = responseIndex(data.model);
	if (requireWellFormed && index.malformed) {
		return yield* Effect.fail(new ServiceUnavailable({ message: "A response record is malformed; response history cannot be established safely." }));
	}
	const result: Reading = { question, responses: [...index.responsesFor(question).responses] };
	if (result.responses.some((candidate) => candidate.body.length > 32_768)) {
		return yield* Effect.fail(new BadRequest({ message: "A recorded response exceeds the supported text limit; read its source file directly." }));
	}
	if (result.responses.some((candidate) => data.model.ids.get(candidate.id)?.length !== 1)) {
		return yield* Effect.fail(new Conflict({ message: "A response identity is duplicated; no answer is selected." }));
	}
	return result;
});
