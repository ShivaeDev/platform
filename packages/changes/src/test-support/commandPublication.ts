import { Cause, Effect } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { CommandPublication } from "#commandPublication.ts";
import { SyncDelivery, type SyncToken } from "#syncToken.ts";

export const commandPublication = storyKit({
	*create() {
		const reactivity = yield* Reactivity.Reactivity;
		const announced: string[] = [];
		for (const key of ["notes:1", "notes:2"]) {
			const stop = reactivity.registerUnsafe([key], () => announced.push(key));
			yield* Effect.addFinalizer(() => Effect.sync(stop));
		}
		return { announced, delivers: true, reactivity };
	},
	layer: Reactivity.layer,
	name: "local command publication",
	stages: ["host"],
	verbs: (engine, story) => ({
		announced: () => Effect.sync(() => [...engine.announced]),
		publish: (keys: readonly string[], sync?: SyncToken) =>
			Effect.gen(function* () {
				story.tell(
					`publish ${keys.join(", ") || "no keys"}${sync === undefined ? "" : ` and sync token ${sync.id} of ${sync.client}`} through the default command port`,
				);
				const publication = yield* CommandPublication;
				const published = publication.publish(keys, sync).pipe(
					Effect.as("published"),
					Effect.catchTag("CommandPublicationError", (error) => Effect.succeed(`publication failed: ${Cause.pretty(error.cause).split("\n")[0]}`)),
				);
				return yield* engine.delivers
					? Effect.provideService(published, SyncDelivery, (token) =>
							Effect.sync(() => engine.announced.push(`sync token ${token.id} of ${token.client}`)),
						)
					: published;
			}),
	}),
});

export function noHostDelivery() {
	return commandPublication.trait("host", "a host that takes no sync tokens", function* (engine) {
		yield* Effect.sync(() => {
			engine.delivers = false;
		});
	});
}

export function throwingSubscriber(key: string) {
	return commandPublication.trait("host", `a subscriber to ${key} that throws`, function* (engine) {
		const stop = engine.reactivity.registerUnsafe([key], () => {
			throw new Error(`The subscriber to ${key} threw`);
		});
		yield* Effect.addFinalizer(() => Effect.sync(stop));
	});
}
