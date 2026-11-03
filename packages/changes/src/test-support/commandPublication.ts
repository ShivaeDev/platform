import { Effect } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { CommandPublication } from "#commandPublication.ts";

export const commandPublication = storyKit({
	*create() {
		const reactivity = yield* Reactivity.Reactivity;
		const announced: string[] = [];
		for (const key of ["notes:1", "notes:2"]) {
			const stop = reactivity.registerUnsafe([key], () => announced.push(key));
			yield* Effect.addFinalizer(() => Effect.sync(stop));
		}
		return { announced };
	},
	layer: Reactivity.layer,
	name: "local command publication",
	stages: [],
	verbs: (engine, story) => ({
		announced: () => Effect.sync(() => [...engine.announced]),
		publish: (keys: readonly string[]) =>
			Effect.gen(function* () {
				story.tell(`publish ${keys.join(", ")} through the default command port`);
				const publication = yield* CommandPublication;
				yield* publication.publish(keys);
			}),
	}),
});
