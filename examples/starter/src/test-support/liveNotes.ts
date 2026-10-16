import { Effect } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { expect, vi } from "vitest";
import { makeNotesClient } from "#client/makeNotes.ts";
import type { RunningHost } from "./host.ts";

export const liveNotes = Effect.fn("StarterStory.liveNotes")(function* (host: RunningHost, cookie: string) {
	const client = makeNotesClient(`${host.baseUrl}/rpc`, (transport) =>
		HttpClient.mapRequest(transport, HttpClientRequest.setHeaders({ cookie, origin: host.origin })),
	);
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(value) => Effect.sync(() => value.dispose()),
	);
	const list = client.api.list.query();
	registry.mount(list);
	registry.mount(client.connection);
	yield* Effect.promise(() => vi.waitFor(() => expect(registry.get(client.status).connection).toBe("live")));
	return { client, list, registry };
});
