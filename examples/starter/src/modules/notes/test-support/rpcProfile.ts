import { layerWebSocketConstructorWS } from "@effect/platform-node/NodeSocket";
import { Effect } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { makeNotesClient } from "#modules/notes/client/make.ts";
import type { RunningHost } from "#test-support/host.ts";

export function rpcProfile(host: RunningHost, cookie: string) {
	const { api, runtime } = makeNotesClient(`${host.baseUrl}/rpc`, {
		headers: { cookie, origin: host.origin },
		webSocketConstructor: layerWebSocketConstructorWS,
	});
	return Effect.acquireUseRelease(
		Effect.sync(() => AtomRegistry.make()),
		(registry) => AtomRegistry.getResult(registry, runtime.atom(api.whoami.run(undefined))),
		(registry) => Effect.sync(() => registry.dispose()),
	);
}
