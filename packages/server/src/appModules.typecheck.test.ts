import { Context, Effect, Layer, Schema } from "effect";
import { Digest, SecureRandom } from "effect/crypto";
import { Rpc, RpcGroup } from "effect/rpc";
import { Migrator, type SqlClient } from "effect/sql";
import { expectTypeOf, it } from "vitest";
import { defineModule } from "@shivaedev/contract/defineModule.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { AuthenticatedUser } from "@shivaedev/identity/middleware.ts";
import { ColumnKey } from "@shivaedev/sql/ColumnKey.ts";
import type { AppModule, RegisteredModule } from "#AppModule.ts";
import { appHost } from "#appDatabase.ts";
import { appModules } from "#appModules.ts";
import type { DuplicateModuleQueue } from "#DuplicateModuleQueue.ts";
import { draftsModule, Notes, notesModule } from "#test/defined-modules/features.ts";
import { coachingModule } from "#test/subject/coaching.ts";
import { workerHost } from "#workerHost.ts";

class Port extends Context.Service<Port, string>()("@shivaedev/server/test/modules/Port") {}
class Service extends Context.Service<Service, string>()("@shivaedev/server/test/modules/Service") {}
class Input extends Context.Service<Input, string>()("@shivaedev/server/test/modules/Input") {}
class BuildFailure extends Schema.TaggedError<BuildFailure>()("ModuleBuildFailure", {}) {}
const group = RpcGroup.make(Rpc.make("read", { success: Schema.String }));
const module = {
	group,
	handlers: group.toLayer({ read: () => Service }),
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

it("a defined module's generated handlers require exactly the services its operations yield beyond its middleware and subject", () => {
	expectTypeOf<Layer.Services<Effect.Success<typeof definedModules>["handlers"]>>().toEqualTypeOf<SqlClient.SqlClient>();
	expectTypeOf<
		Layer.Services<Effect.Success<ReturnType<typeof appModules<readonly [typeof coachingModule]>>>["handlers"]>
	>().toEqualTypeOf<SqlClient.SqlClient>();
});

class Greeting extends Context.Service<Greeting, string>()("@shivaedev/server/test/modules/Greeting") {}
const Greetings = defineModule({
	middleware: AuthenticatedUser,
	name: "greetings",
	operations: [
		query("hello", {
			readPolicy: () => Effect.succeed(true),
			reads: () => [],
			*run() {
				const { name } = yield* SessionUser;
				return `${yield* Greeting}, ${name}`;
			},
		}),
	],
	wire: { hello: { rejections: {}, success: Schema.String } },
});
const greetings = { module: Greetings, services: Layer.empty } satisfies AppModule;
const greetingPorts = { ...module, name: "greeting", ports: Layer.succeed(Greeting, "Hello") } satisfies AppModule;
const greetingPerRequest = { ...module, name: "greeting", requestServices: Layer.succeed(Greeting, "Hello") } satisfies AppModule;

it("a defined module takes its services from any registration or the host, and never asks for what its middleware or subject provides", () => {
	expectTypeOf(appModules([greetings, greetingPorts])).not.toBeAny();
	expectTypeOf(appModules([greetings, greetingPerRequest])).not.toBeAny();
	expectTypeOf(appModules([notesModule])).not.toBeAny();
	expectTypeOf(appModules([coachingModule])).not.toBeAny();
	// @ts-expect-error No registration provides Greeting, which the hello query yields.
	expectTypeOf(appModules([greetings])).not.toBeAny();
	// @ts-expect-error Replacements override default ports, so a service only they provide still needs a registration's default.
	expectTypeOf(appModules([greetings], { replacements: Layer.succeed(Greeting, "Hi") })).not.toBeAny();
});

const Tokens = defineModule({
	middleware: AuthenticatedUser,
	name: "tokens",
	operations: [
		query("issue", {
			readPolicy: () => Effect.succeed(true),
			reads: () => [],
			*run() {
				const bytes = yield* (yield* SecureRandom.SecureRandom).randomBytes(16);
				const digest = yield* (yield* Digest.Digest).digest(Digest.sha256, bytes);
				return `${Effect.isEffect(yield* ColumnKey)}:${digest.length}`;
			},
		}),
		query("greet", {
			readPolicy: () => Effect.succeed(true),
			reads: () => [],
			*run() {
				return `${yield* Greeting}, ${(yield* (yield* SecureRandom.SecureRandom).randomBytes(1)).length}`;
			},
		}),
	],
	wire: { greet: { rejections: {}, success: Schema.String }, issue: { rejections: {}, success: Schema.String } },
});
const tokens = { module: Tokens, services: Layer.empty } satisfies AppModule;

it("a defined module's operations take the host's crypto services and ColumnKey from the host, and still need a registration for any other service", () => {
	expectTypeOf(appModules([tokens, greetingPorts])).not.toBeAny();
	// @ts-expect-error No registration provides Greeting, which the greet query yields beside the host's SecureRandom.
	expectTypeOf(appModules([tokens])).not.toBeAny();
});

const annotated: AppModule = notesModule;
function registration(): AppModule {
	return notesModule;
}
const registeredNotes: RegisteredModule = Notes;
const widenedModule = { ...notesModule, module: registeredNotes } satisfies AppModule;

it("a defined module's registration whose type lost the module's services does not compile", () => {
	// @ts-expect-error The annotation drops Notes' services, so its generated handlers would claim to need nothing.
	expectTypeOf(appModules([draftsModule, annotated])).not.toBeAny();
	// @ts-expect-error The helper's return type drops Notes' services, so its generated handlers would claim to need nothing.
	expectTypeOf(appModules([registration()])).not.toBeAny();
	// @ts-expect-error RegisteredModule drops Notes' services, so its generated handlers would claim to need nothing.
	expectTypeOf(appModules([widenedModule])).not.toBeAny();
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

it("a defined module's registration takes its name from the module, and a hand-written one names itself", () => {
	// @ts-expect-error The module already names itself, so a second name could disagree with it.
	expectTypeOf({ module: Notes, name: "notebook", services: Layer.empty } satisfies AppModule).not.toBeAny();
	// @ts-expect-error Nothing else names a group served by hand-written handlers.
	expectTypeOf({ group, handlers: Layer.empty, services: Layer.empty } satisfies AppModule).not.toBeAny();
});

const unmigrated = appModules([{ module: Notes, services: Layer.empty } satisfies AppModule, module]);

it("modules without migrations add no loader requirements", () => {
	expectTypeOf<Effect.Services<Effect.Success<typeof unmigrated>["migrations"]["loader"]>>().toEqualTypeOf<never>();
});
