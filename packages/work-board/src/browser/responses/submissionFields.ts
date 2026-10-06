import { Schema } from "effect";
import type { Draft } from "./drafts.ts";
import { ResponseKind } from "./schema.ts";

export function submissionFields(pending: Draft, question: string) {
	return {
		...(pending.answers === undefined ? {} : { answers: pending.answers }),
		...(pending.supersedes === undefined ? {} : { supersedes: pending.supersedes }),
		author: pending.author,
		body: pending.body,
		id: pending.id,
		question,
		type: Schema.decodeUnknownSync(ResponseKind)(pending.type),
	};
}
