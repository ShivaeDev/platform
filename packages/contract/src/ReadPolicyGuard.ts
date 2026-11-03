import { Effect, Layer, Schema } from "effect";
import { type Rpc, type RpcGroup, RpcMiddleware } from "effect/rpc";
import { authorizeReads, CurrentViewer } from "#readPolicy.ts";
import { MissingReadPolicy, QueryReadDenied } from "#readPolicyErrors.ts";
import { WebSocketRequired } from "#WebSocketRequired.ts";

export class ReadPolicyGuard extends RpcMiddleware.Service<ReadPolicyGuard>()("@shivaedev/contract/ReadPolicyGuard", {
	error: Schema.Union([MissingReadPolicy, QueryReadDenied, WebSocketRequired]),
}) {
	static layer(options: { readonly websocket?: boolean } = {}) {
		return Layer.succeed(ReadPolicyGuard, (effect, request) =>
			!options.websocket && request.rpc._tag.endsWith(".$changes")
				? Effect.fail(new WebSocketRequired({ message: `${request.rpc._tag} needs the WebSocket protocol` }))
				: Effect.flatMap(CurrentViewer, (viewer) => authorizeReads(effect, request, viewer)),
		);
	}
}

export const guardReads = Effect.fnUntraced(function* <R extends Rpc.Any>(group: RpcGroup.RpcGroup<R>) {
	return yield* Effect.sync(() => {
		const guarded = group.middleware(ReadPolicyGuard);
		// Native middleware runs in reverse order; identity must supply the viewer before this guard runs.
		for (const rpc of guarded.requests.values()) {
			Object.assign(rpc, { middlewares: new Set([ReadPolicyGuard, ...rpc.middlewares]) });
		}
		return guarded;
	});
});
