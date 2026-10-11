import { expect } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { make } from "#form.ts";
import { it } from "#test/registry.ts";

const runtime = Atom.runtime(Layer.empty);

it("handler paths reject omitted optional inputs without attaching to missing array elements", function* (registry) {
	const form = make(Schema.Struct({ note: Schema.optionalKey(Schema.String) }), {
		initialValues: {},
		onSubmit: (_values, submitter) => submitter.fail("note", "Explain your choice"),
		runtime,
	});
	registry.mount(form.error("note"));
	registry.set(form.submit, undefined);
	yield* Effect.flip(AtomRegistry.getResult(registry, form.submit));
	expect(registry.get(form.error("note"))).toBe("Explain your choice");
	expect(registry.get(form.errorAt(["note"]))).toBe("Explain your choice");
	form.change("note", "An explanation");
	expect(registry.get(form.error("note"))).toBeUndefined();
	const array = make(Schema.Struct({ answers: Schema.Array(Schema.Struct({ id: Schema.String, note: Schema.optionalKey(Schema.String) })) }), {
		arrayKeys: { answers: (answer) => answer.id },
		initialValues: { answers: [{ id: "one" }] },
		onSubmit: (_values, submitter) => submitter.fail(["answers", 0, "note"], "Explain your choice"),
		runtime,
	});
	registry.mount(array.errorAt(["answers", 0, "note"]));
	registry.set(array.submit, undefined);
	yield* Effect.flip(AtomRegistry.getResult(registry, array.submit));
	expect(registry.get(array.errorAt(["answers", 0, "note"]))).toBe("Explain your choice");
	array.change("answers", []);
	expect(registry.get(array.errorAt(["answers", 0, "note"]))).toBeUndefined();
});

it("a whole-element rejection follows recreated elements and clears on a change inside that element", function* (registry) {
	const form = make(Schema.Struct({ answers: Schema.Array(Schema.Struct({ id: Schema.Number, text: Schema.String })) }), {
		arrayKeys: { answers: (answer) => answer.id },
		initialValues: {
			answers: [
				{ id: 0, text: "One" },
				{ id: 1, text: "Two" },
			],
		},
		onSubmit: (_values, submitter) => submitter.fail(["answers", 0], "Rejected element"),
		runtime,
	});
	registry.mount(form.errorAt(["answers", 0]));
	registry.set(form.submit, undefined);
	yield* Effect.flip(AtomRegistry.getResult(registry, form.submit));
	form.change("answers", [
		{ id: 1, text: "Two" },
		{ id: 0, text: "One" },
	]);
	expect(registry.get(form.errorAt(["answers", 0]))).toBeUndefined();
	expect(registry.get(form.errorAt(["answers", 1]))).toBe("Rejected element");
	form.change("answers", [
		{ id: 1, text: "Two" },
		{ id: 0, text: "Edited" },
	]);
	expect(registry.get(form.errorAt(["answers", 1]))).toBeUndefined();
});
