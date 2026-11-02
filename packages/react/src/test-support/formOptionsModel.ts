import { Context, Effect, Schema } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { FieldFailure } from "@shivaedev/form/shape.ts";

export const Answers = Schema.Struct({
	answers: Schema.Array(Schema.Struct({ id: Schema.String, text: Schema.String })),
	title: Schema.NonEmptyString,
});
export const initialValues = {
	answers: [
		{ id: "first", text: "One" },
		{ id: "second", text: "Two" },
	],
	title: "",
};
export const query = Atom.make(AsyncResult.success(initialValues));
export class TitleCheck extends Context.Service<TitleCheck, { readonly check: (value: string) => Effect.Effect<string | undefined> }>()(
	"test/TitleCheck",
) {}
export type Kind = "editor" | "create";
export type Answers = typeof Answers.Type;
export function saveAnswers(values: Answers) {
	return values.title === "closed"
		? Effect.fail(new FieldFailure({ message: "Answer is closed", path: "answers", segments: ["answers", 1, "text"] }))
		: Effect.succeed(values);
}
