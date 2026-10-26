import { Effect } from "effect";
import { Conflict } from "@shivaedev/contract/errors/taxonomy.ts";
import type { DraftInput, Question } from "#browser/responses/schema.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import { questionFrom, responseFrom } from "./records.ts";

export function validateSupersedes(input: DraftInput, question: Question, data: Snapshot) {
	if (input.supersedes === undefined) {
		return Effect.void;
	}
	const matches = data.model.ids.get(input.supersedes);
	const previous = matches?.length === 1 && matches[0] ? responseFrom(matches[0]) : undefined;
	const context = previous && data.model.ids.get(previous.response.question);
	const old = context?.length === 1 && context[0] ? questionFrom(context[0]) : undefined;
	return old
		&& previous
		&& previous.response.reviewedRevision === old.question.reviewedRevision
		&& old.question.item === question.question.item
		&& old.question.request === question.question.request
		&& input.supersedes !== input.id
		? Effect.void
		: Effect.fail(new Conflict({ message: "Supersedes must identify one recorded response to this item's attention request." }));
}
