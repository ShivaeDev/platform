import { Context, Effect, Layer, Schema } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { Migrator } from "effect/sql";
import { expectTypeOf, it } from "vitest";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { AuthenticatedUser } from "@shivaedev/identity/middleware.ts";
import { appHost as databaseHost } from "#appDatabase.ts";
import { appHost } from "#appHost.ts";
import { appModules } from "#appModules.ts";

class Global extends Context.Service<Global, string>()("@shivaedev/server/test/request-types/Global") {}
class Request extends Context.Service<Request, string>()("@shivaedev/server/test/request-types/Request") {}
const group = RpcGroup.make(Rpc.make("read", { success: Schema.String }).middleware(AuthenticatedUser));
const module = {
	group,
	handlers: group.toLayer({ read: () => Request }),
	migrations: { loader: Migrator.fromRecord({}) },
	name: "requests",
	requestServices: Layer.effect(
		Request,
		Effect.andThen(
			Global,
			Effect.map(SessionUser, (user) => user.id),
		),
	),
	services: Layer.succeed(Global, "shared"),
};
const complete = Effect.map(appModules([module]), (modules) => appHost({ ...modules, migrations: undefined, policy: "loopback" }));
const missing = Effect.map(appModules([{ ...module, services: Layer.empty }]), (modules) =>
	appHost({ ...modules, migrations: undefined, policy: "loopback" }),
);

const migrated = Effect.map(appModules([module]), (modules) => databaseHost({ postgresSettings: {}, ...modules, policy: "loopback" }));
const deferred = databaseHost({
	application: Effect.succeed({ ...module, migrations: undefined, policy: "loopback" }),
	migrations: module.migrations,
	postgresSettings: {},
});
const publicGroup = RpcGroup.make(Rpc.make("read", { success: Schema.String }));
const missingCaller = appHost({ ...module, group: publicGroup, migrations: undefined, policy: "loopback" });

it("request registration discharges handler services and caller requirements while preserving missing global dependencies", () => {
	expectTypeOf<Layer.Services<Effect.Success<typeof complete>>>().toEqualTypeOf<never>();
	expectTypeOf<Layer.Services<Effect.Success<typeof missing>>>().toEqualTypeOf<Global>();
	expectTypeOf<Layer.Services<Effect.Success<typeof migrated>>>().toEqualTypeOf<never>();
	expectTypeOf<Layer.Services<typeof deferred>>().toEqualTypeOf<never>();
	expectTypeOf<Layer.Services<typeof missingCaller>>().toEqualTypeOf<SessionUser>();

	// @ts-expect-error Caller-dependent Layers cannot register globally.
	appModules([{ ...module, services: module.requestServices }]);
	// @ts-expect-error Global Layers cannot require a service registered for requests.
	appModules([{ ...module, services: Layer.effect(Global, Request) }]);
});
