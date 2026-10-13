import { type Effect, Layer, Schema } from "effect";
import type * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import type * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import type { BrowserDraftConfig } from "@shivaedev/effect-form/react.ts";
import type { Editor } from "#editor.ts";

export const DraftFields = Schema.Struct({ name: Schema.NonEmptyString, quantity: Schema.NumberFromString });
export const draftRuntime = Atom.runtime(Layer.empty);
export const draftInitial = { name: "Paper", quantity: "300" };
export type Row = typeof draftInitial;
export type ViewEditor = Editor<typeof DraftFields.fields, Row, never, string, never>;
export type Save = (values: typeof DraftFields.Type) => Effect.Effect<Row, string>;
export interface Held {
	current?: ViewEditor;
	registry?: AtomRegistry.AtomRegistry;
}
export interface ScreenProps {
	readonly held: Held;
	readonly persistedDraft: BrowserDraftConfig;
	readonly query: Atom.Writable<AsyncResult.AsyncResult<Row>, AsyncResult.AsyncResult<Row>>;
	readonly save: Save;
}
