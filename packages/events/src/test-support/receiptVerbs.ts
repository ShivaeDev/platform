import { Effect } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { readKeys } from "@shivaedev/changes/keys.ts";
import { type NoteEngine, notes } from "./notes.ts";

export function receiptVerbs(engine: NoteEngine) {
	const announced: string[] = [];
	return {
		announcedChanges: () => Effect.sync(() => [...announced]),
		appendEmpty: (requestId: string) => engine.store.append({ events: [], expectedVersion: 0, requestId, stream: "alice" }),
		observeName: (requestId: string, name: string) =>
			Effect.gen(function* () {
				const current = (yield* engine.store.read("alice")).at(-1);
				const version = yield* engine.store
					.append({
						events: current?.value.name === name ? [] : [{ name }],
						expectedVersion: current?.streamVersion ?? 0,
						requestId,
						stream: "alice",
					})
					.pipe(Effect.catchTag("AlreadyDone", (done) => Effect.succeed(done.streamVersion)));
				const history = yield* engine.store.read("alice");
				return { name: history.find((event) => event.streamVersion === version)?.value.name, version };
			}),
		watchChanges: () =>
			Effect.gen(function* () {
				const reactivity = yield* Reactivity.Reactivity;
				const stop = reactivity.registerUnsafe(readKeys([notes.list]), () => announced.push("notes"));
				yield* Effect.addFinalizer(() => Effect.sync(stop));
			}),
	};
}
