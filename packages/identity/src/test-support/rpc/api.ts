import { Effect, Layer, Option, Schema } from "effect";
import { Rpc, RpcClient, type RpcClientError, RpcGroup } from "effect/rpc";
import { Identity, OptionalIdentity } from "#identity.ts";
import { Authenticated, MaybeAuthenticated, RequestTracing } from "#middleware.ts";
import { betterAuthSessions } from "#server/adapters/betterAuthSessions.ts";
import type { OriginPolicy } from "#server/origin.ts";
import { authenticatedLayer, maybeAuthenticatedLayer } from "#server/session.ts";
import { requestTracingLayer } from "#server/tracing.ts";
import { httpClient, type Provider, recorder, rpcHttp, serve } from "./harness.ts";

const Account = RpcGroup.make(Rpc.make("Whoami", { success: Schema.String }))
	.middleware(Authenticated)
	.middleware(RequestTracing);

const Public = RpcGroup.make(Rpc.make("Greeting", { success: Schema.String }))
	.middleware(MaybeAuthenticated)
	.middleware(RequestTracing);

export const Api = Account.merge(Public);

export type ApiClient = RpcClient.FromGroup<typeof Api, RpcClientError.RpcClientError>;

const Handlers = Api.toLayer({
	Greeting: () =>
		Effect.map(OptionalIdentity, (identity) =>
			Option.match(identity, {
				onNone: () => "hello anonymous",
				onSome: ({ id }) => `hello ${id}`,
			}),
		),
	Whoami: () =>
		Effect.gen(function* () {
			const identity = yield* Identity;
			yield* Effect.logInfo("handled");
			return identity.id;
		}),
});

export function serverLayer(provider: Provider, origin: OriginPolicy) {
	const sessions = betterAuthSessions(provider.getSession);
	const policy = { origin, provider: sessions };
	return Layer.mergeAll(Handlers, authenticatedLayer(policy), maybeAuthenticatedLayer(policy), requestTracingLayer());
}

export function makeApp(provider: Provider, origin: OriginPolicy) {
	const recorded = recorder();
	const app = serve(rpcHttp(Api).pipe(Layer.provide(serverLayer(provider, origin)), Layer.provide(recorded.layer)));
	function call<A, E>(headers: Readonly<Record<string, string>>, run: (client: ApiClient) => Effect.Effect<A, E>) {
		return Effect.gen(function* () {
			const client = yield* RpcClient.make(Api);
			return yield* Effect.result(run(client));
		}).pipe(Effect.provide(httpClient(app, headers)), Effect.scoped);
	}
	return { app, call, origin, ...recorded };
}
