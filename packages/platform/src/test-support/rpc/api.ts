import { Effect, Layer, Option, Schema } from "effect";
import { Rpc, RpcClient, type RpcClientError, RpcGroup } from "effect/unstable/rpc";
import { Forbidden } from "#errors/taxonomy.ts";
import { Identity, OptionalIdentity, RequestId } from "#rpc/identity.ts";
import { Authenticated, MaybeAuthenticated, RequestTracing } from "#rpc/middleware.ts";
import { betterAuthSessions } from "#rpc-server/adapters/better-auth-sessions.ts";
import type { OriginPolicy } from "#rpc-server/origin.ts";
import { authenticatedLayer, maybeAuthenticatedLayer } from "#rpc-server/session.ts";
import { requestTracingLayer } from "#rpc-server/tracing.ts";
import { httpClient, type Provider, recorder, rpcHttp, serve } from "./harness.ts";

const Account = RpcGroup.make(
	Rpc.make("Whoami", { success: Schema.String }),
	Rpc.make("ReadOwn", { error: Forbidden, payload: { userId: Schema.String }, success: Schema.String }),
)
	.middleware(Authenticated)
	.middleware(RequestTracing);

const Public = RpcGroup.make(Rpc.make("Greeting", { success: Schema.String }))
	.middleware(MaybeAuthenticated)
	.middleware(RequestTracing);

export const Api = Account.merge(Public);

const Handlers = Api.toLayer({
	Greeting: () =>
		Effect.map(OptionalIdentity, (identity) =>
			Option.match(identity, {
				onNone: () => "hello anonymous",
				onSome: ({ id }) => `hello ${id}`,
			}),
		),
	ReadOwn: ({ userId }) =>
		Effect.gen(function* () {
			const identity = yield* Identity;
			if (identity.id !== userId) {
				return yield* new Forbidden({ message: "Not your account" });
			}
			return identity.id;
		}),
	Whoami: () =>
		Effect.gen(function* () {
			const identity = yield* Identity;
			const requestId = yield* RequestId;
			yield* Effect.logInfo("handled");
			return `${identity.id} ${requestId}`;
		}),
});

export function serverLayer(provider: Provider, origin: OriginPolicy) {
	const policy = { origin, provider: betterAuthSessions(provider.getSession) };
	return Layer.mergeAll(Handlers, authenticatedLayer(policy), maybeAuthenticatedLayer(policy), requestTracingLayer());
}

export function makeApp(provider: Provider, origin: OriginPolicy) {
	const recorded = recorder();
	const app = serve(rpcHttp(Api).pipe(Layer.provide(serverLayer(provider, origin)), Layer.provide(recorded.layer)));
	function call<A, E>(
		headers: Readonly<Record<string, string>>,
		run: (client: RpcClient.FromGroup<typeof Api, RpcClientError.RpcClientError>) => Effect.Effect<A, E>,
	) {
		return Effect.runPromise(
			Effect.gen(function* () {
				const client = yield* RpcClient.make(Api);
				return yield* Effect.result(run(client));
			}).pipe(Effect.provide(httpClient(app, headers)), Effect.scoped),
		);
	}
	return { app, call, ...recorded };
}
