import { Effect, Queue } from "effect";
import type { Rpc, RpcClient } from "effect/rpc";
import type { RpcClientError } from "effect/rpc/RpcClientError";
import { liveSyncRequest } from "#liveSyncRequest.ts";
import type { LiveSyncRpc } from "#liveSyncRpc.ts";
import type { Reflection } from "#reflection.ts";

// A stream that may have opened behind a command's token passes a later one, sent on its own once the stream confirms tokens.
export function catchUp(
	reflection: Reflection,
	client: RpcClient.RpcClient.Flat<Rpc.Any | LiveSyncRpc, RpcClientError>,
	connected: Effect.Effect<void, RpcClientError>,
) {
	return Queue.take(reflection.catchUps).pipe(
		Effect.andThen(connected),
		Effect.andThen(Effect.suspend(() => liveSyncRequest(client, { client: reflection.client, id: reflection.token() }))),
		// A host that cannot answer the sync will never confirm it, so the waits it covered end here.
		Effect.catchCause(() => Effect.sync(reflection.abandon)),
		Effect.forever,
		Effect.forkScoped,
	);
}
