import { Effect, Option, PubSub, Stream } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { makeChannel } from "@shivaedev/changes/channel.ts";
import { invalidationKeys, type Key } from "@shivaedev/changes/keys.ts";
import { AppChanges } from "@shivaedev/server/appHost.ts";
import { watcher } from "#rpc/keys.ts";
import type { Change } from "#server/files/changes.ts";
import { affected } from "#server/rpc/affected.ts";
import { Workspace } from "#server/workspace.ts";

export const publishChanges = Effect.gen(function* () {
	const workspace = yield* Workspace;
	const { changes } = yield* workspace.settings();
	const index = workspace.index();
	const reactivity = yield* Reactivity.Reactivity;
	const live = yield* AppChanges;
	const channel = makeChannel<Key>({
		name: "work-board",
		owner: Effect.succeed(changes),
		publish: (keys) => reactivity.invalidate(invalidationKeys(keys)),
	});
	const subscription = yield* PubSub.subscribe(changes.events);
	let sequence = changes.sequence ? yield* changes.sequence : undefined;
	let previous = yield* Effect.option(index);
	const publish = Effect.fn("WorkBoard.publish")(function* (change: Change) {
		const contiguous = sequence !== undefined && change.sequence === sequence + 1;
		sequence = change.sequence;
		if (change._tag === "Watching") {
			yield* channel.record([watcher.list]);
		}
		const current = yield* Effect.option(index);
		const keys =
			contiguous && change._tag === "Changed" && Option.isSome(previous) && Option.isSome(current)
				? affected(previous.value, current.value, change.paths)
				: undefined;
		previous = current;
		yield* keys === undefined ? live.resync : channel.record(keys);
	});
	yield* Stream.fromSubscription(subscription).pipe(Stream.runForEach(publish));
});
