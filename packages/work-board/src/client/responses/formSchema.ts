import { Schema } from "effect";
import { DraftInput, type PromptAnswer, ResponseKind, Revision } from "#browser/responses/schema.ts";
import { AnswerRecovery } from "./answerRecovery.ts";

export function responseFormSchema(hasPrompts: boolean, requiredSelections: readonly string[] = []) {
	return Schema.Struct({
		...DraftInput.fields,
		answerContext: Schema.optional(Schema.String),
		body: hasPrompts ? DraftInput.fields.body : DraftInput.fields.body.check(Schema.isMinLength(1)),
		recovery: Schema.optionalKey(AnswerRecovery),
		revision: Revision,
		type: Schema.String.pipe(Schema.decodeTo(ResponseKind)),
	}).check(
		Schema.makeFilter((values) =>
			values.type === "answer" ? values.answers?.flatMap((answer, index) => answerIssue(answer, index, requiredSelections)) : undefined,
		),
	);
}

export type ResponseSubmission = ReturnType<typeof responseFormSchema>["Type"];
export type ResponseInput = ReturnType<typeof responseFormSchema>["Encoded"];

function answerIssue(answer: PromptAnswer, index: number, requiredSelections: readonly string[]) {
	if (answer.selected.length > 0) {
		return [];
	}
	if (requiredSelections.includes(answer.prompt)) {
		return [{ issue: "Choose an option before recording this answer.", path: ["answers", index, "text"] }];
	}
	return answer.text.trim() ? [] : [{ issue: "Choose an option or answer in your own words.", path: ["answers", index, "text"] }];
}
