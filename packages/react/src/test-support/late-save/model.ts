import { Layer, Schema } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";

export const Fields = Schema.Struct({ name: Schema.String, note: Schema.optionalKey(Schema.String) });
export type Values = typeof Fields.Type;
export const initial: Values = { name: "First", note: "Initial note" };
export const runtime = Atom.runtime(Layer.empty);

export function model() {
	return {
		complete: Promise.withResolvers<void>(),
		query: Atom.make(AsyncResult.success(initial)),
	};
}
export type Model = ReturnType<typeof model>;
