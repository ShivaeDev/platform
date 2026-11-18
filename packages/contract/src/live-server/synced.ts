import { Effect } from "effect";
import type { SyncToken } from "@shivaedev/changes/syncToken.ts";
import type { initialize } from "#live-server/initialize.ts";

export function synced(state: Effect.Success<typeof initialize>) {
	return Effect.fn("LiveServer.synced")(function* (token: SyncToken) {
		yield* Effect.sync(() => {
			for (const push of state.syncClients.get(token.client) ?? []) {
				push(token.id);
			}
		});
	});
}
