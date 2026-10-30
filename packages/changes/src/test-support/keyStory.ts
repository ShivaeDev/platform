import { Effect, Schema } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { makeChannel } from "#channel.ts";
import { collection, invalidationKeys, type Key, readKeys } from "#keys.ts";

export const rows = collection("rows", Schema.Number, { listId: Schema.Number, userId: Schema.String });
export const keyStory = storyKit({
	create: () =>
		Effect.gen(function* () {
			const provided = yield* Effect.serviceOption(Reactivity.Reactivity);
			const reactivity = provided._tag === "Some" ? provided.value : yield* Reactivity.make;
			const refreshed: string[] = [];
			const channel = makeChannel<Key>({
				key: JSON.stringify,
				name: "keys",
				owner: Effect.succeed("owner"),
				publish: (keys) => reactivity.invalidate(invalidationKeys(keys)),
			});
			return { channel, reactivity, refreshed };
		}),
	name: "record and bucket changes",
	stages: [],
	verbs: (engine, story) => ({
		opensTransaction: () =>
			Effect.map(engine.channel.open, (frame) => ({
				commit: () =>
					Effect.suspend(() => {
						story.tell("the transaction commits");
						return frame.settle("committed");
					}),
				record: (keys: readonly Key[]) =>
					Effect.suspend(() => {
						story.tell(`the transaction records ${keys.map((key) => JSON.stringify(key)).join(", ")}`);
						return frame.provide(engine.channel.record(keys));
					}),
			})),
		refreshed: () => engine.refreshed,
		watch: (label: string, keys: readonly Key[]) =>
			Effect.acquireRelease(
				Effect.sync(() => {
					story.tell(`${label} watches ${keys.map((key) => JSON.stringify(key)).join(", ")}`);
					return engine.reactivity.registerUnsafe(readKeys(keys), () => engine.refreshed.push(label));
				}),
				(release) => Effect.sync(release),
			),
	}),
});
