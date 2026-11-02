import { Context, Effect, Layer, Schema } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { Migrator } from "effect/sql";
import { expectTypeOf, it } from "vitest";
import type { AppModule } from "#AppModule.ts";
import { appHost } from "#appHost.ts";
import { appModules } from "#appModules.ts";
import type { DuplicateModuleQueue } from "#DuplicateModuleQueue.ts";
import { workerHost } from "#workerHost.ts";

class Port extends Context.Service<Port, string>()("test/modules/Port") {}
class Service extends Context.Service<Service, string>()("test/modules/Service") {}
class Input extends Context.Service<Input, string>()("test/modules/Input") {}
class BuildFailure extends Schema.TaggedError<BuildFailure>()("ModuleBuildFailure", {}) {}
const group = RpcGroup.make(Rpc.make("read", { success: Schema.String }));
const module = {
	group,
	handlers: group.toLayer({ read: () => Service }),
	migrations: { loader: Migrator.fromRecord({}) },
	name: "example",
	services: Layer.effect(Service, Port),
} satisfies AppModule;
const incomplete = Effect.map(appModules([module]), (modules) => appHost({ ...modules, policy: "loopback" }));
const complete = Effect.map(appModules([{ ...module, ports: Layer.succeed(Port, "default") }]), (modules) =>
	appHost({ ...modules, policy: "loopback" }),
);
const replaced = Effect.map(
	appModules([module], { replacements: Layer.effect(Port, Input.pipe(Effect.flatMap(() => Effect.fail(new BuildFailure())))) }),
	(modules) => appHost({ ...modules, policy: "loopback" }),
);
const migrated = Effect.map(
	appModules([
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
	(modules) => appHost({ ...modules, policy: "loopback" }),
);

it("module composition preserves missing ports, replacement requirements and typed build failures", () => {
	expectTypeOf<Layer.Services<Effect.Success<typeof incomplete>>>().toEqualTypeOf<Port>();
	expectTypeOf<Layer.Services<Effect.Success<typeof complete>>>().toEqualTypeOf<never>();
	expectTypeOf<Layer.Services<Effect.Success<typeof replaced>>>().toEqualTypeOf<Input>();
	expectTypeOf<Extract<Layer.Error<Effect.Success<typeof replaced>>, BuildFailure>>().toEqualTypeOf<BuildFailure>();
	expectTypeOf<Layer.Services<Effect.Success<typeof migrated>>>().toEqualTypeOf<Input>();
	expectTypeOf<Extract<Layer.Error<Effect.Success<typeof migrated>>, BuildFailure>>().toEqualTypeOf<BuildFailure>();
});

const workerModule = { ...module, services: Layer.empty, workers: Layer.effectDiscard(Port) };
const incompleteWorker = Effect.map(appModules([workerModule]), workerHost);
const completeWorker = Effect.map(appModules([{ ...workerModule, ports: Layer.succeed(Port, "default") }]), workerHost);
const replacedWorker = Effect.map(
	appModules([workerModule], { replacements: Layer.effect(Port, Input.pipe(Effect.flatMap(() => Effect.fail(new BuildFailure())))) }),
	workerHost,
);

it("worker composition retains missing ports, replacement requirements, failures and duplicate queue errors", () => {
	expectTypeOf<Layer.Services<Effect.Success<typeof incompleteWorker>>>().toEqualTypeOf<Port>();
	expectTypeOf<Layer.Services<Effect.Success<typeof completeWorker>>>().toEqualTypeOf<never>();
	expectTypeOf<Layer.Services<Effect.Success<typeof replacedWorker>>>().toEqualTypeOf<Input>();
	expectTypeOf<Extract<Layer.Error<Effect.Success<typeof replacedWorker>>, BuildFailure>>().toEqualTypeOf<BuildFailure>();
	expectTypeOf<Effect.Error<typeof incompleteWorker>>().toEqualTypeOf<DuplicateModuleQueue>();
});
