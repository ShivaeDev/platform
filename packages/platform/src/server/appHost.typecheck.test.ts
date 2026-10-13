import { type Config, Context, Effect, Layer, Option, Schema } from "effect";
import { Headers, HttpRouter } from "effect/unstable/http";
import { Rpc, RpcGroup } from "effect/unstable/rpc";
import { Migrator, SqlClient } from "effect/unstable/sql";
import { expectTypeOf, it } from "vitest";
import { type AppHostOptions, appHost } from "#appHost.ts";

class Required extends Context.Service<Required, string>()("host-test/Required") {}
class BuildFailure extends Schema.TaggedError<BuildFailure>()("BuildFailure", {}) {}
const Api = RpcGroup.make(Rpc.make("read", { success: Schema.String }));
const handlers = Api.toLayer({ read: () => Required });
const options = {
	group: Api,
	handlers,
	migrations: { loader: Migrator.fromRecord({}) },
	sessions: { origin: () => true, provider: { get: () => Effect.succeed(Option.none()) } },
};
const incomplete = appHost({ ...options, services: Layer.empty });
const complete = appHost({ ...options, services: Layer.effect(Required, Effect.fail(new BuildFailure())) });
const sqlHandlers = Api.toLayer({ read: () => SqlClient.SqlClient.pipe(Effect.as("ready")) });
const withoutDatabase = appHost({ group: Api, handlers: sqlHandlers, policy: "loopback", services: Layer.empty });
const withDatabase = appHost({ ...options, handlers: sqlHandlers, services: Layer.empty });
const typedOptions: AppHostOptions<
	RpcGroup.Rpcs<typeof Api>,
	Layer.Success<typeof handlers>,
	never,
	Required,
	never,
	never,
	never,
	never,
	{ readonly user: { readonly id: string } }
> = { ...options, services: Layer.empty };
const failingRouteHost = appHost({
	group: Api,
	handlers: Api.toLayer({ read: () => Effect.succeed("ready") }),
	policy: "loopback",
	routes: HttpRouter.add("GET", "/failed", Effect.fail(new BuildFailure())),
	services: Layer.empty,
});
const typedHost = appHost(typedOptions);
const providerSession = typedOptions.sessions.provider.get(Headers.empty);
it("host composition preserves application requirements and build failures", () => {
	expectTypeOf<Layer.Services<typeof failingRouteHost>>().toEqualTypeOf<never>();
	expectTypeOf<Layer.Services<typeof incomplete>>().toEqualTypeOf<Required>();
	expectTypeOf<Layer.Services<typeof complete>>().toEqualTypeOf<never>();
	expectTypeOf<Extract<Layer.Error<typeof complete>, BuildFailure>>().toEqualTypeOf<BuildFailure>();
	expectTypeOf<Extract<Layer.Error<typeof complete>, Config.ConfigError>>().toEqualTypeOf<Config.ConfigError>();
	expectTypeOf<Layer.Services<typeof withoutDatabase>>().toEqualTypeOf<SqlClient.SqlClient>();
	expectTypeOf<Layer.Services<typeof withDatabase>>().toEqualTypeOf<never>();
	expectTypeOf<Layer.Services<typeof typedHost>>().toEqualTypeOf<Required>();
	expectTypeOf<Effect.Success<typeof providerSession>>().toEqualTypeOf<Option.Option<{ readonly user: { readonly id: string } }>>();
});
