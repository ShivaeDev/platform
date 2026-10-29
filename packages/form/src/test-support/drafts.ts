import { Effect, Layer, Schema } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { formStories } from "./formStories.ts";

const runtime = Atom.runtime(Layer.empty);
const none = { support: () => undefined, verbs: () => ({}) };

export const stock = formStories(() => Schema.Struct({ name: Schema.String, quantity: Schema.String }), {
	...none,
	config: () => ({ initialValues: { name: "Printer paper", quantity: "300" }, onSubmit: Effect.succeed, runtime }),
});

export const notes = formStories(() => Schema.Struct({ name: Schema.String, note: Schema.optionalKey(Schema.String) }), {
	...none,
	config: () => ({ initialValues: { name: "First" }, onSubmit: Effect.succeed, runtime }),
});

export function noteRemoved() {
	return notes.step("the note is removed", (driver) => {
		const { name } = driver.current().values.value;
		driver.current().values.set({ name });
	});
}

export const lines = formStories(() => Schema.Struct({ lines: Schema.Array(Schema.Struct({ id: Schema.String })), name: Schema.String }), {
	...none,
	config: () => ({ initialValues: { lines: [{ id: "old" }], name: "First" }, onSubmit: Effect.succeed, runtime }),
});

export const payloads = formStories(() => Schema.Struct({ payload: Schema.Unknown }), {
	...none,
	config: () => ({ initialValues: { payload: "First" }, onSubmit: Effect.succeed, runtime }),
});

export const unstorable: { self?: object } = {};
unstorable.self = unstorable;
