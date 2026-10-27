import { Data, Effect, Layer, Schema } from "effect";
import * as Atom from "effect/reactivity/Atom";

export const query = Atom.make(Effect.succeed({ id: 1, title: "Quarterly report" }));
export const Title = Schema.Struct({ title: Schema.String });
export const runtime = Atom.runtime(Layer.empty);
export function saveTitle(values: { readonly title: string }) {
	return values.title.length > 0 ? Effect.succeed({ id: 1, title: values.title }) : Effect.fail("Rejected" as const);
}

export class NameRejected extends Data.TaggedError("NameRejected")<{ readonly field: "title"; readonly message: string }> {}
export class StaleRejected extends Data.TaggedError("StaleRejected")<{ readonly field: "subtitle"; readonly message: string }> {}
export function saveNamed(values: { readonly title: string }) {
	return Effect.fail(new NameRejected({ field: "title", message: values.title }));
}
export function saveStale(values: { readonly title: string }) {
	return Effect.fail(new StaleRejected({ field: "subtitle", message: values.title }));
}

const perField = { field: Schema.optionalKey(Schema.String), message: Schema.String };
export class Conflict extends Schema.TaggedError<Conflict>()("Conflict", perField) {}
export class TitleConflict extends Schema.TaggedError<TitleConflict>()("TitleConflict", {
	field: Schema.optionalKey(Schema.Literal("title")),
	message: Schema.String,
}) {}
export class Described extends Schema.TaggedError<Described>()("Described", { message: Schema.String }) {}
export function saveConflict(values: { readonly title: string }) {
	return Effect.fail(new Conflict({ message: values.title }));
}
