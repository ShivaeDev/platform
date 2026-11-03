import { Context, Effect, Layer, Schema, type Types } from "effect";
import { type Rpc, RpcMiddleware } from "effect/rpc";
import { authorizeReads, CurrentViewer } from "#readPolicy.ts";
import { MissingReadPolicy, QueryReadDenied } from "#readPolicyErrors.ts";
import { WebSocketRequired } from "#WebSocketRequired.ts";

function readPolicyGuard<A, E, R>(
	effect: Effect.Effect<A, E, R>,
	request: { readonly rpc: Rpc.Any; readonly payload: unknown },
): Effect.Effect<A, E | MissingReadPolicy | QueryReadDenied | WebSocketRequired | Types.unhandled, R> {
	return Effect.flatMap(CurrentViewer, (viewer) => authorizeReads(effect, request, viewer));
}

const middleware = RpcMiddleware.Service<never>()("@shivaedev/contract/ReadPolicyGuard", {
	error: Schema.Union([MissingReadPolicy, QueryReadDenied, WebSocketRequired]),
});

export const ReadPolicyGuard = Object.assign(Context.Reference("@shivaedev/contract/ReadPolicyGuard", { defaultValue: () => readPolicyGuard }), {
	[RpcMiddleware.TypeId]: middleware[RpcMiddleware.TypeId],
	"~ClientError": middleware["~ClientError"],
	error: middleware.error,
	requiredForClient: middleware.requiredForClient,
});

export function readPolicyGuardLayer(options: { readonly websocket?: boolean } = {}) {
	return Layer.succeed(ReadPolicyGuard, (effect, request) =>
		!options.websocket && request.rpc._tag.endsWith(".$changes")
			? Effect.fail(new WebSocketRequired({ message: `${request.rpc._tag} needs the WebSocket protocol` }))
			: readPolicyGuard(effect, request),
	);
}
