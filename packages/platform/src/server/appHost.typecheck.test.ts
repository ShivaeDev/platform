import { type Config, Context, Effect, Layer, Option, Schema } from "effect";
import { Headers, HttpRouter } from "effect/http";
import { Rpc, RpcGroup } from "effect/rpc";
import { Migrator, SqlClient } from "effect/sql";
import { expectTypeOf, it } from "vitest";
import { type AppHostOptions, appHost } from "#server/appHost.ts";

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
const incomplete = appHost(options);
const complete = appHost({ ...options, services: Layer.effect(Required, Effect.fail(new BuildFailure())) });
const sqlHandlers = Api.toLayer({ read: () => SqlClient.SqlClient.pipe(Effect.as("ready")) });
const withoutDatabase = appHost({ group: Api, handlers: sqlHandlers, policy: "loopback" });
const withDatabase = appHost({ ...options, handlers: sqlHandlers });
const withoutServices = appHost({ group: Api, handlers: Api.toLayer({ read: () => Effect.succeed("ready") }), sessions: options.sessions });
const localWithDatabase = appHost({ group: Api, handlers: sqlHandlers, migrations: options.migrations, policy: "loopback" });
type TypedOptions<TServices = never, TServiceError = never, TServiceRequirements = never> = AppHostOptions<
	RpcGroup.Rpcs<typeof Api>,
	Layer.Success<typeof handlers>,
	never,
	Required,
	TServices,
	TServiceError,
	TServiceRequirements,
	never,
	{ readonly user: { readonly id: string } }
>;
const typedOptions: TypedOptions = options;
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
	expectTypeOf<Layer.Services<typeof withoutServices>>().toEqualTypeOf<never>();
	expectTypeOf<Layer.Error<typeof withoutServices>>().not.toBeUnknown();
	expectTypeOf<Layer.Services<typeof localWithDatabase>>().toEqualTypeOf<never>();
	expectTypeOf<Layer.Services<typeof typedHost>>().toEqualTypeOf<Required>();
	expectTypeOf<Effect.Success<typeof providerSession>>().toEqualTypeOf<Option.Option<{ readonly user: { readonly id: string } }>>();
});

it("annotated options require a Layer for declared service types", () => {
	// @ts-expect-error Declared service outputs must be supplied by a Layer.
	const missingServices: TypedOptions<Required> = options;
	void missingServices;
	expectTypeOf(options).not.toExtend<TypedOptions<never, BuildFailure>>();
	expectTypeOf(options).not.toExtend<TypedOptions<never, never, Required>>();
	const suppliedOptions: TypedOptions<Required> = { ...options, services: Layer.succeed(Required, "ready") };
	const suppliedHost = appHost(suppliedOptions);
	expectTypeOf<Layer.Services<typeof suppliedHost>>().toEqualTypeOf<never>();
});

const deferred = appHost({
	application: Effect.gen(function* () {
		yield* Required;
		yield* SqlClient.SqlClient;
		yield* Effect.fail(new BuildFailure());
		return { group: Api, handlers: sqlHandlers, sessions: options.sessions };
	}),
	migrations: options.migrations,
});
it("deferred construction preserves its requirements and typed failures while supplying SQL and scope", () => {
	expectTypeOf<Layer.Services<typeof deferred>>().toEqualTypeOf<Required>();
	expectTypeOf<Extract<Layer.Error<typeof deferred>, BuildFailure>>().toEqualTypeOf<BuildFailure>();
});
