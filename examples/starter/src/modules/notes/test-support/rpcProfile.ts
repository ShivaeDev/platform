import { Effect } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { makeNotesClient } from "#modules/notes/client/make.ts";
import type { RunningHost } from "#test-support/host.ts";

export function rpcProfile(host: RunningHost, cookie: string) {
	const { api, runtime } = makeNotesClient(`${host.baseUrl}/rpc`, (client) =>
		HttpClient.mapRequest(client, HttpClientRequest.setHeaders({ cookie, origin: host.origin })),
	);
	return Effect.acquireUseRelease(
		Effect.sync(() => AtomRegistry.make()),
		(registry) => AtomRegistry.getResult(registry, runtime.atom(api.whoami.run(undefined))),
		(registry) => Effect.sync(() => registry.dispose()),
	);
}
