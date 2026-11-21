import { Context, Effect, Layer, Schema } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { Migrator } from "effect/sql";
import { expectTypeOf, it } from "vitest";
import { contract } from "@shivaedev/contract/contract.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { AuthenticatedUser } from "@shivaedev/identity/middleware.ts";
import type { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import { Subject, selfSubject } from "@shivaedev/identity/subject.ts";
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

declare const sessions: Layer.Layer<SessionPolicy>;
const day = query("day", { readPolicy: () => Effect.succeed(true), reads: () => [], success: Schema.String });
const Own = contract("own", { queries: [day], subject: selfSubject });
const Report = contract("report", { queries: [day] });
const subjectRequest = Layer.effect(
	Request,
	Effect.map(Subject, (subject) => subject.id),
);
const ownHandlers = Own.application.toLayer({ "own.day": () => Request });
const subjectHost = appHost({ group: Own, handlers: ownHandlers, requestServices: subjectRequest, services: Layer.empty, sessions });
const reportHost = appHost({
	group: Own.merge(Report),
	handlers: Layer.mergeAll(ownHandlers, Report.application.toLayer({ "report.day": () => Effect.succeed("report") })),
	requestServices: subjectRequest,
	services: Layer.empty,
	sessions,
});
const signedInGroup = RpcGroup.make(
	Rpc.make("read", { success: Schema.String }).middleware(AuthenticatedUser),
	Rpc.make("open", { success: Schema.String }),
);
const openHost = appHost({
	...module,
	group: signedInGroup,
	handlers: signedInGroup.toLayer({ open: () => Effect.succeed("open"), read: () => Request }),
	migrations: undefined,
	policy: "loopback",
});

it("a request service needs every served RPC to provide what it requires", () => {
	expectTypeOf<Layer.Services<typeof subjectHost>>().toEqualTypeOf<never>();
	expectTypeOf<Layer.Services<typeof reportHost>>().toEqualTypeOf<Subject>();
	expectTypeOf<Layer.Services<typeof openHost>>().toEqualTypeOf<SessionUser>();
});

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
