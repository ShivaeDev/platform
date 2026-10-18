import { Effect } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { vi } from "vitest";
import { LiveConnection } from "@shivaedev/effect-contract/automaticLive.ts";
import { makeNotesClient } from "#client/makeNotes.ts";
import type { RunningHost } from "./host.ts";

export const liveNotes = Effect.fn("AppStory.liveNotes")(function* (host: RunningHost, cookie: string) {
	const client = makeNotesClient(`${host.baseUrl}/rpc`, (transport) =>
		HttpClient.mapRequest(transport, HttpClientRequest.setHeaders({ cookie, origin: host.origin })),
	);
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(value) => Effect.sync(() => value.dispose()),
	);
	const list = client.api.list.query();
	registry.mount(list);
	registry.mount(client.api[LiveConnection].connection);
	yield* Effect.promise(() =>
		vi.waitFor(() => {
			if (registry.get(client.api[LiveConnection].status).connection !== "live") {
				throw new Error("The notes subscription has not connected");
			}
		}),
	);
	return { notes: () => AsyncResult.getOrElse(registry.get(list), () => undefined) };
});
