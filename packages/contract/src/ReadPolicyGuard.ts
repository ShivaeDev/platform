import { Effect, Layer, Schema } from "effect";
import { type Rpc, type RpcGroup, RpcMiddleware } from "effect/rpc";
import { prependMiddleware } from "#internal/prependMiddleware.ts";
import { authorizeReads, CurrentViewer } from "#readPolicy.ts";
import { MissingReadPolicy, QueryReadDenied } from "#readPolicyErrors.ts";
import { WebSocketRequired } from "#WebSocketRequired.ts";

export class ReadPolicyGuard extends RpcMiddleware.Service<ReadPolicyGuard>()("@shivaedev/contract/ReadPolicyGuard", {
	error: Schema.Union([MissingReadPolicy, QueryReadDenied, WebSocketRequired]),
}) {}

export function readPolicyGuardLayer(options: { readonly websocket?: boolean } = {}): Layer.Layer<ReadPolicyGuard> {
	return Layer.succeed(ReadPolicyGuard, (effect, request) =>
		!options.websocket && request.rpc._tag.endsWith(".$changes")
			? Effect.fail(new WebSocketRequired({ message: `${request.rpc._tag} needs the WebSocket protocol` }))
			: Effect.flatMap(CurrentViewer, (viewer) => authorizeReads(effect, request, viewer)),
	);
}

export function guardReads<R extends Rpc.Any>(group: RpcGroup.RpcGroup<R>) {
	return prependMiddleware(group.middleware(ReadPolicyGuard), ReadPolicyGuard.key);
}
