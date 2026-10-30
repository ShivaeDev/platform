import { layerWebSocketConstructorWS } from "@effect/platform-node/NodeSocket";
import { Effect } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { makeNotesClient } from "#modules/notes/client/make.ts";
import type { RunningHost } from "#test-support/host.ts";
import { queryUpdates } from "./queryUpdates.ts";

const liveClient = Effect.fn("AppStory.liveClient")(function* (host: RunningHost, cookie: string) {
	const client = makeNotesClient(`${host.baseUrl}/rpc`, {
		headers: { cookie, origin: host.origin },
		webSocketConstructor: layerWebSocketConstructorWS,
	});
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(value) => Effect.sync(() => value.dispose()),
	);
	return { client, registry };
});

export const liveNotes = Effect.fn("AppStory.liveNotes")(function* (host: RunningHost, cookie: string) {
	const { client, registry } = yield* liveClient(host, cookie);
	const updates = yield* queryUpdates(registry, client.api.list.query());
	return { nextNotes: updates.next, notes: updates.current };
});

export const liveNote = Effect.fn("AppStory.liveNote")(function* (host: RunningHost, cookie: string, id: number) {
	const { client, registry } = yield* liveClient(host, cookie);
	const query = client.api.get.query({ id });
	const updates = yield* queryUpdates(registry, query);
	return { nextNote: updates.next, refresh: () => Effect.sync(() => registry.refresh(query)) };
});
