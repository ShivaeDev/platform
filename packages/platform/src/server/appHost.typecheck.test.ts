import { type Config, Context, Effect, Layer, Option, Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";
import { Migrator } from "effect/unstable/sql";
import { expectTypeOf, it } from "vitest";
import { appHost } from "#appHost.ts";

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
it("host composition preserves application requirements and build failures", () => {
	expectTypeOf<Layer.Services<typeof incomplete>>().toEqualTypeOf<Required>();
	expectTypeOf<Layer.Services<typeof complete>>().toEqualTypeOf<never>();
	expectTypeOf<Extract<Layer.Error<typeof complete>, BuildFailure>>().toEqualTypeOf<BuildFailure>();
	expectTypeOf<Extract<Layer.Error<typeof complete>, Config.ConfigError>>().toEqualTypeOf<Config.ConfigError>();
});
