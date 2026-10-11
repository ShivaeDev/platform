import { expect } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { make } from "#form.ts";
import { Invalid } from "#shape.ts";
import { it } from "#test/registry.ts";

const runtime = Atom.runtime(Layer.empty);
const Answers = Schema.Struct({
	answers: Schema.Array(Schema.Struct({ selected: Schema.Array(Schema.String), text: Schema.String })),
}).check(
	Schema.makeFilter((values) =>
		values.answers.flatMap((answer, index) =>
			answer.selected.length === 0 && !answer.text.trim() ? [{ issue: "Choose or write an answer", path: ["answers", index, "text"] }] : [],
		),
	),
);

it("nested Schema messages address each unanswered control and retain the top-level summary", function* (registry) {
	let calls = 0;
	const form = make(Answers, {
		initialValues: {
			answers: [
				{ selected: [], text: "" },
				{ selected: [], text: "" },
			],
		},
		onSubmit: (values) =>
			Effect.sync(() => {
				calls += 1;
				return values;
			}),
		runtime,
	});
	const first = form.errorAt(["answers", 0, "text"]);
	const second = form.errorAt(["answers", 1, "text"]);
	const selections = form.errorAt(["answers", 0, "selected"]);
	registry.mount(first);
	registry.mount(second);
	expect(registry.get(first)).toBeUndefined();
	expect(registry.get(second)).toBeUndefined();
	registry.set(form.submit, undefined);
	expect(yield* Effect.flip(AtomRegistry.getResult(registry, form.submit))).toBeInstanceOf(Invalid);
	expect(calls).toBe(0);
	expect(registry.get(first)).toBe("Choose or write an answer");
	expect(registry.get(second)).toBe("Choose or write an answer");
	expect(registry.get(selections)).toBeUndefined();
	expect(registry.get(form.error("answers"))).toBe("Choose or write an answer");
	form.change("answers", [
		{ selected: ["option"], text: "" },
		{ selected: [], text: "" },
	]);
	expect(registry.get(first)).toBeUndefined();
	expect(registry.get(second)).toBe("Choose or write an answer");
	form.change("answers", [
		{ selected: ["option"], text: "" },
		{ selected: [], text: "Another answer" },
	]);
	expect(registry.get(second)).toBeUndefined();
	registry.set(form.submit, undefined);
	expect(yield* AtomRegistry.getResult(registry, form.submit)).toEqual(form.values.value);
	expect(calls).toBe(1);
});

it("blur reveals descendant Schema feedback without inventing sibling paths", function* (registry) {
	const form = make(Schema.Struct({ profile: Schema.Struct({ name: Schema.NonEmptyString, other: Schema.String }) }), {
		initialValues: { profile: { name: "", other: "" } },
		onSubmit: Effect.succeed,
		runtime,
	});
	yield* Effect.sync(() => form.blur("profile"));
	expect(registry.get(form.errorAt(["profile"]))).toBe("Required");
	expect(registry.get(form.errorAt(["profile", "name"]))).toBe("Required");
	expect(registry.get(form.errorAt(["profile", "other"]))).toBeUndefined();
});
