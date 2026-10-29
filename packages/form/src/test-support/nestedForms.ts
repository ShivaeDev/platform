import { Effect, Layer, Schema } from "effect";
import * as Atom from "effect/reactivity/Atom";
import type { Path } from "#shape.ts";
import { formStories } from "./formStories.ts";

const runtime = Atom.runtime(Layer.empty);
export const UNANSWERED_MESSAGE = "Choose or write an answer";
const Answers = Schema.Struct({ answers: Schema.Array(Schema.Struct({ selected: Schema.Array(Schema.String), text: Schema.String })) }).check(
	Schema.makeFilter((values) =>
		values.answers.flatMap((answer, index) =>
			answer.selected.length === 0 && !answer.text.trim() ? [{ issue: UNANSWERED_MESSAGE, path: ["answers", index, "text"] }] : [],
		),
	),
);
const unanswered = { selected: [], text: "" };

export const answerPaths = formStories(() => Answers, {
	config: () => ({ initialValues: { answers: [unanswered] }, onSubmit: Effect.succeed, runtime }),
	support: () => undefined,
	verbs: (driver) => ({
		sameErrorAtom: (path: Path<"answers">, other: Path<"answers">) =>
			Effect.sync(() => driver.current().errorAt(path) === driver.current().errorAt(other)),
	}),
});

export const twoUnanswered = formStories(() => Answers, {
	config: () => ({ initialValues: { answers: [unanswered, unanswered] }, onSubmit: Effect.succeed, runtime }),
	support: () => undefined,
	verbs: (driver, tell) => ({
		answerSelectionError: (position: number) => Effect.sync(() => driver.read(driver.current().errorAt(["answers", position, "selected"]))),
		answerTextError: (position: number) => Effect.sync(() => driver.read(driver.current().errorAt(["answers", position, "text"]))),
		chooseOption: (position: number, option: string) =>
			Effect.sync(() => {
				tell(`choose ${option} for answer ${position + 1}`);
				const answers = driver.current().values.value.answers;
				driver.current().change(
					"answers",
					answers.map((answer, index) => (index === position ? { ...answer, selected: [option] } : answer)),
				);
			}),
	}),
});

export const profiles = formStories(() => Schema.Struct({ profile: Schema.Struct({ name: Schema.NonEmptyString, other: Schema.String }) }), {
	config: () => ({ initialValues: { profile: { name: "", other: "" } }, onSubmit: Effect.succeed, runtime }),
	support: () => undefined,
	verbs: () => ({}),
});
