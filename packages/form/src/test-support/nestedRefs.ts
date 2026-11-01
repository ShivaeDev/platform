import { Effect, Schema } from "effect";
import type * as AtomRef from "effect/reactivity/AtomRef";
import { formStories } from "./formStories.ts";

export const STARTING_COUNT = 1;
export const STARTING_SCORE = 30;

const NestedFields = Schema.Struct({
	profile: Schema.Struct({ details: Schema.Struct({ count: Schema.Number, label: Schema.String }) }),
	teams: Schema.Array(Schema.Struct({ scores: Schema.Array(Schema.Number), title: Schema.String })),
});

interface Refs {
	count: AtomRef.AtomRef<number>;
	score: AtomRef.AtomRef<number>;
}

export const nestedRefs = formStories(() => NestedFields, {
	config: () => ({
		initialValues: {
			profile: { details: { count: STARTING_COUNT, label: "First" } },
			teams: [
				{ scores: [10, 20], title: "First" },
				{ scores: [STARTING_SCORE, 40], title: "Second" },
			],
		},
		onSubmit: Effect.succeed,
	}),
	opened: (form, _read, support) => {
		support.refs = {
			count: form.field("profile").prop("details").prop("count"),
			score: form.field("teams").prop(1).prop("scores").prop(0),
		};
	},
	support: (): { refs?: Refs } => ({}),
	verbs: (_driver, tell, support) => {
		function refs() {
			if (!support.refs) {
				throw new Error("Open the form before using its nested refs");
			}
			return support.refs;
		}
		return {
			count: () => Effect.sync(() => refs().count.value),
			countUp: () =>
				Effect.sync(() => {
					tell("count the nested profile up by one");
					refs().count.update((count) => count + 1);
				}),
			score: () => Effect.sync(() => refs().score.value),
			setCount: (count: number) =>
				Effect.sync(() => {
					tell(`set the nested profile count to ${count}`);
					refs().count.set(count);
				}),
			setScore: (score: number) =>
				Effect.sync(() => {
					tell(`set the second team's first score to ${score}`);
					refs().score.set(score);
				}),
		};
	},
});
