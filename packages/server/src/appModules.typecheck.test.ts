import { Context, Effect, Layer, Schema } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { Migrator } from "effect/sql";
import { expectTypeOf, it } from "vitest";
import type { AppModule } from "#AppModule.ts";
import { appHost } from "#appHost.ts";
import { appModules } from "#appModules.ts";

class Port extends Context.Service<Port, string>()("test/modules/Port") {}
class Service extends Context.Service<Service, string>()("test/modules/Service") {}
class Input extends Context.Service<Input, string>()("test/modules/Input") {}
class BuildFailure extends Schema.TaggedError<BuildFailure>()("ModuleBuildFailure", {}) {}
const group = RpcGroup.make(Rpc.make("read", { success: Schema.String }));
const module = {
	group,
	handlers: group.toLayer({ read: () => Service }),
	migrations: { loader: Migrator.fromRecord({}) },
	services: Layer.effect(Service, Port),
} satisfies AppModule;
const incomplete = appHost({ ...appModules([module]), policy: "loopback" });
const complete = appHost({ ...appModules([{ ...module, ports: Layer.succeed(Port, "default") }]), policy: "loopback" });
const replaced = appHost({
	...appModules([module], { replacements: Layer.effect(Port, Input.pipe(Effect.flatMap(() => Effect.fail(new BuildFailure())))) }),
	policy: "loopback",
});
const migrated = appHost({
	...appModules([
		{
			...module,
			migrations: {
				components: [
					{ apply: Input.pipe(Effect.flatMap(() => Effect.fail(new BuildFailure()))), name: "example", pending: Effect.succeed(undefined) },
				],
				loader: Input.pipe(Effect.as([])),
			},
			ports: Layer.succeed(Port, "default"),
		},
	]),
	policy: "loopback",
});

it("module composition preserves missing ports, replacement requirements and typed build failures", () => {
	expectTypeOf<Layer.Services<typeof incomplete>>().toEqualTypeOf<Port>();
	expectTypeOf<Layer.Services<typeof complete>>().toEqualTypeOf<never>();
	expectTypeOf<Layer.Services<typeof replaced>>().toEqualTypeOf<Input>();
	expectTypeOf<Extract<Layer.Error<typeof replaced>, BuildFailure>>().toEqualTypeOf<BuildFailure>();
	expectTypeOf<Layer.Services<typeof migrated>>().toEqualTypeOf<Input>();
	expectTypeOf<Extract<Layer.Error<typeof migrated>, BuildFailure>>().toEqualTypeOf<BuildFailure>();
});
