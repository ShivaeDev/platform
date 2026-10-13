import { Schema } from "effect";
import { DraftInput, ResponseKind, Revision } from "#browser/responses/schema.ts";
import { AnswerRecovery } from "./answerRecovery.ts";

export function responseFormSchema(hasPrompts: boolean) {
	return Schema.Struct({
		...DraftInput.fields,
		answerContext: Schema.optional(Schema.String),
		body: hasPrompts ? DraftInput.fields.body : DraftInput.fields.body.check(Schema.isMinLength(1)),
		recovery: Schema.optionalKey(AnswerRecovery),
		revision: Revision,
		type: Schema.String.pipe(Schema.decodeTo(ResponseKind)),
	}).check(
		Schema.makeFilter((values) =>
			values.type === "answer"
				? values.answers?.flatMap((answer, index) =>
						answer.selected.length === 0 && !answer.text.trim()
							? [{ issue: "Choose an option or answer in your own words.", path: ["answers", index, "text"] }]
							: [],
					)
				: undefined,
		),
	);
}

export type ResponseSubmission = ReturnType<typeof responseFormSchema>["Type"];
export type ResponseInput = ReturnType<typeof responseFormSchema>["Encoded"];
