import { Effect, Layer, Option, Schema } from "effect";
import { Rpc, RpcClient, type RpcClientError, RpcGroup } from "effect/unstable/rpc";
import { Forbidden } from "../../src/errors.ts";
import { Authenticated, Identity, MaybeAuthenticated, OptionalIdentity, RequestId, RequestTracing } from "../../src/rpc.ts";
import { authenticatedLayer, betterAuthSessions, maybeAuthenticatedLayer, type OriginPolicy, requestTracingLayer } from "../../src/rpc-server.ts";
import { httpClient, type Provider, recorder, rpcHttp, serve } from "./support.ts";

const Account = RpcGroup.make(
	Rpc.make("Whoami", { success: Schema.String }),
	Rpc.make("ReadOwn", { payload: { userId: Schema.String }, success: Schema.String, error: Forbidden }),
)
	.middleware(Authenticated)
	.middleware(RequestTracing);

const Public = RpcGroup.make(Rpc.make("Greeting", { success: Schema.String }))
	.middleware(MaybeAuthenticated)
	.middleware(RequestTracing);

export const Api = Account.merge(Public);

const Handlers = Api.toLayer({
	Whoami: () =>
		Effect.gen(function* () {
			const identity = yield* Identity;
			const requestId = yield* RequestId;
			yield* Effect.logInfo("handled");
			return `${identity.id} ${requestId}`;
		}),
	ReadOwn: ({ userId }) =>
		Effect.gen(function* () {
			const identity = yield* Identity;
			if (identity.id !== userId) return yield* new Forbidden({ message: "Not your account" });
			return identity.id;
		}),
	Greeting: () =>
		Effect.map(OptionalIdentity, (identity) =>
			Option.match(identity, {
				onNone: () => "hello anonymous",
				onSome: ({ id }) => `hello ${id}`,
			}),
		),
});

export const serverLayer = (provider: Provider, origin: OriginPolicy) => {
	const policy = { provider: betterAuthSessions(provider.getSession), origin };
	return Layer.mergeAll(Handlers, authenticatedLayer(policy), maybeAuthenticatedLayer(policy), requestTracingLayer());
};

export const makeApp = (provider: Provider, origin: OriginPolicy) => {
	const recorded = recorder();
	const app = serve(rpcHttp(Api).pipe(Layer.provide(serverLayer(provider, origin)), Layer.provide(recorded.layer)));
	const call = <A, E>(
		headers: Readonly<Record<string, string>>,
		run: (client: RpcClient.FromGroup<typeof Api, RpcClientError.RpcClientError>) => Effect.Effect<A, E>,
	) =>
		Effect.runPromise(
			Effect.gen(function* () {
				const client = yield* RpcClient.make(Api);
				return yield* Effect.result(run(client));
			}).pipe(Effect.provide(httpClient(app, headers)), Effect.scoped),
		);
	return { app, call, ...recorded };
};
