import { Effect, Layer, Option, Ref, Schema, Stream } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcTest } from "effect/rpc";
import { bind } from "@shivaedev/contract/bind.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { makeLiveServer } from "@shivaedev/contract/makeLiveServer.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { permissionLayer } from "@shivaedev/identity/server/permissions.ts";
import type { UserSessionShape } from "@shivaedev/identity/server/session.ts";
import { AppChanges } from "@shivaedev/server/appHost.ts";
import { hostChanges } from "@shivaedev/server/hostChanges.ts";
import { adminPage } from "#page.ts";
import { JobsPermission, UsersPermission } from "#permissions.ts";
import { adminRegistry } from "#registry.ts";
import { mergeAdminRegistrations } from "#server/mergeAdminRegistrations.ts";
import { registerAdmin } from "#server/registerAdmin.ts";
import { Access } from "#test/Access.ts";
import { Jobs, Users } from "#test/pages.ts";

const Restricted = adminPage({
	contract: contract("admin.restricted", {
		queries: [query("profile", { readPolicy: () => Effect.succeed(false), reads: () => [], success: Schema.String })],
	}),
	id: "restricted",
	permission: UsersPermission,
	route: { path: "/admin/restricted", title: "Restricted" },
});

export const adminEngine = Effect.gen(function* () {
	const session = yield* Ref.make<Option.Option<UserSessionShape>>(Option.none());
	const failed = yield* Ref.make<readonly string[]>(["mail-42"]);
	const live = yield* makeLiveServer.pipe(Effect.provide(Reactivity.layer));
	const jobsModule = registerAdmin(adminRegistry(Jobs), {
		jobs: Jobs.contract.application.toLayer({
			"admin.jobs.failed": () => Ref.get(failed),
			"admin.jobs.retry": ({ id }) => Ref.update(failed, (ids) => ids.filter((value) => value !== id)),
			"admin.jobs.watch": () => Stream.fromEffect(Ref.get(failed)),
		}),
	});
	const usersModule = registerAdmin(adminRegistry(Users), {
		users: Users.contract.application.toLayer({
			"admin.users.profile": () => Effect.map(SessionUser, (user) => user.email),
		}),
	});
	const restrictedModule = registerAdmin(adminRegistry(Restricted), {
		restricted: Restricted.contract.application.toLayer({ "admin.restricted.profile": () => Effect.succeed("unrestricted") }),
	});
	const registration = mergeAdminRegistrations(jobsModule, usersModule, restrictedModule);
	const changes = hostChanges(registration.group, AppChanges).pipe(Layer.provide(Layer.succeed(AppChanges, live)));
	const policy = {
		origin: () => true,
		provider: { get: () => Ref.get(session) },
		roles: Access,
	};
	const auth = Layer.merge(permissionLayer(JobsPermission, policy), permissionLayer(UsersPermission, policy));
	const protocol = Layer.mergeAll(registration.handlers, changes, auth);
	const client = yield* RpcTest.makeClient(registration.group).pipe(Effect.provide(protocol));
	class Client extends AtomRpc.Service<Client>()("test/AdminLiveClient", {
		group: registration.group,
		makeEffect: RpcTest.makeClient(registration.group, { flatten: true }),
		protocol,
	}) {}
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(value) => Effect.sync(() => value.dispose()),
	);
	const api = bind(Jobs.contract, Client, { registry });
	return { client, liveFailedJobs: () => AtomRegistry.getResult(registry, api.failed.query()), session };
});
