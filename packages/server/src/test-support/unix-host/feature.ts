import { Context, Effect, Layer, Ref, Schema } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { collection, invalidationKeys } from "@shivaedev/changes/keys.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { command, query } from "@shivaedev/contract/operation.ts";

const notes = collection("unix-notes", Schema.String);
export class Note extends Context.Service<Note, Ref.Ref<string>>()("@shivaedev/server/test/UnixNote") {
	static readonly layer = Layer.effect(Note, Ref.make("Original"));
}
export const Api = contract("notes", {
	commands: [command("save", { invalidates: () => [], payload: { text: Schema.String } })],
	queries: [query("read", { readPolicy: () => Effect.succeed(true), reads: () => [notes.list], success: Schema.String })],
});
export const handlers = Api.application.toLayer({
	"notes.read": () => Effect.flatMap(Note, Ref.get),
	"notes.save": ({ text }) =>
		Effect.gen(function* () {
			yield* Ref.set(yield* Note, text);
			yield* (yield* Reactivity.Reactivity).invalidate(invalidationKeys([notes.list]));
		}),
});
