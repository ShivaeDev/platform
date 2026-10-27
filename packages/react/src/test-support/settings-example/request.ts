import { NodeHttpClient } from "@effect/platform-node";
import { Effect } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { Settings } from "./contract.ts";
import { makeClient } from "./makeClient.ts";
import { withReact } from "./withReact.ts";

export function request(url: string, token: string, entityId: number, input?: typeof Settings.Type) {
	const client = makeClient(url, token, entityId, NodeHttpClient.layerUndici);
	const operation = input === undefined ? client.api.get.run({ entityId }) : client.api.save.run({ entityId, ...input });
	return Effect.acquireUseRelease(
		Effect.sync(() => AtomRegistry.make()),
		(registry) => withReact(AtomRegistry.getResult(registry, client.Client.runtime.atom(operation.pipe(Effect.result)))),
		(registry) => Effect.sync(() => registry.dispose()),
	);
}
