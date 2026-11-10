import { Context, Effect, Layer, Schema } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { Migrator, type SqlClient } from "effect/sql";
import { expectTypeOf, it } from "vitest";
import type { AppModule } from "#AppModule.ts";
import { appHost } from "#appDatabase.ts";
import { appModules } from "#appModules.ts";
import type { DuplicateModuleQueue } from "#DuplicateModuleQueue.ts";
import { Notes, notesModule } from "#test/defined-modules/features.ts";
import { workerHost } from "#workerHost.ts";

class Port extends Context.Service<Port, string>()("@shivaedev/server/test/modules/Port") {}
class Service extends Context.Service<Service, string>()("@shivaedev/server/test/modules/Service") {}
class Input extends Context.Service<Input, string>()("@shivaedev/server/test/modules/Input") {}
class BuildFailure extends Schema.TaggedError<BuildFailure>()("ModuleBuildFailure", {}) {}
const group = RpcGroup.make(Rpc.make("read", { success: Schema.String }));
const module = {
	group,
	handlers: group.toLayer({ read: () => Service }),
	migrations: { loader: Migrator.fromRecord({}) },
	name: "example",
	services: Layer.effect(Service, Port),
} satisfies AppModule;
const incomplete = Effect.map(appModules([module]), (modules) => appHost({ postgresSettings: {}, ...modules, policy: "loopback" }));
const complete = Effect.map(appModules([{ ...module, ports: Layer.succeed(Port, "default") }]), (modules) =>
	appHost({ postgresSettings: {}, ...modules, policy: "loopback" }),
);
const replaced = Effect.map(
	appModules([module], { replacements: Layer.effect(Port, Input.pipe(Effect.flatMap(() => Effect.fail(new BuildFailure())))) }),
	(modules) => appHost({ postgresSettings: {}, ...modules, policy: "loopback" }),
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
	(modules) => appHost({ postgresSettings: {}, ...modules, policy: "loopback" }),
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
const incompleteWorker = Effect.map(appModules([workerModule]), (modules) => workerHost({ ...modules, postgresSettings: {} }));
const completeWorker = Effect.map(appModules([{ ...workerModule, ports: Layer.succeed(Port, "default") }]), (modules) =>
	workerHost({ ...modules, postgresSettings: {} }),
);
const replacedWorker = Effect.map(
	appModules([workerModule], { replacements: Layer.effect(Port, Input.pipe(Effect.flatMap(() => Effect.fail(new BuildFailure())))) }),
	(modules) => workerHost({ ...modules, postgresSettings: {} }),
);

it("worker composition retains missing ports, replacement requirements, failures and duplicate queue errors", () => {
	expectTypeOf<Layer.Services<Effect.Success<typeof incompleteWorker>>>().toEqualTypeOf<Port>();
	expectTypeOf<Layer.Services<Effect.Success<typeof completeWorker>>>().toEqualTypeOf<never>();
	expectTypeOf<Layer.Services<Effect.Success<typeof replacedWorker>>>().toEqualTypeOf<Input>();
	expectTypeOf<Extract<Layer.Error<Effect.Success<typeof replacedWorker>>, BuildFailure>>().toEqualTypeOf<BuildFailure>();
	expectTypeOf<Effect.Error<typeof incompleteWorker>>().toEqualTypeOf<DuplicateModuleQueue>();
});

const definedModules = appModules([notesModule]);

it("a defined module's generated handlers require exactly the services it declares", () => {
	expectTypeOf<Layer.Services<Effect.Success<typeof definedModules>["handlers"]>>().toEqualTypeOf<SqlClient.SqlClient>();
});

it("a defined module never registers as a group with hand-written handlers", () => {
	expectTypeOf({
		// @ts-expect-error A defined module registers as `module:`, so the host serves its queries only through its generated handlers.
		group: Notes,
		handlers: Layer.empty,
		migrations: { loader: Migrator.fromRecord({}) },
		name: "notes",
		services: Layer.empty,
	} satisfies AppModule).not.toBeAny();
});
