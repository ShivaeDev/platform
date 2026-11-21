import { Effect, Layer, Option, Ref } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcTest } from "effect/rpc";
import { bind } from "@shivaedev/contract/bind.ts";
import { liveServerLayer } from "@shivaedev/contract/live-server/layer.ts";
import { LiveServer } from "@shivaedev/contract/live-server/service.ts";
import { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import type { UserSessionShape } from "@shivaedev/identity/server/session.ts";
import { hostChanges } from "@shivaedev/server/hostChanges.ts";
import { Restricted as RestrictedClient } from "#generated/test-support/Restricted.ts";
import { adminPage } from "#page.ts";
import { UsersPermission } from "#permissions.ts";
import { adminRegistry } from "#registry.ts";
import { mergeAdminRegistrations } from "#server/mergeAdminRegistrations.ts";
import { registerAdmin } from "#server/registerAdmin.ts";
import { Access } from "#test/Access.ts";
import { clientRuntime } from "#test/clientRuntime.ts";
import { FailedJobs, FakeJobs } from "#test/FakeJobs.ts";
import { FakeUsers } from "#test/FakeUsers.ts";
import { Jobs, Users } from "#test/pages.ts";
import { Restricted } from "#test/Restricted.ts";

const RestrictedPage = adminPage({
	contract: RestrictedClient,
	id: "restricted",
	permission: UsersPermission,
	route: { path: "/admin/restricted", title: "Restricted" },
});

export const adminEngine = Effect.gen(function* () {
	const session = yield* Ref.make<Option.Option<UserSessionShape>>(Option.none());
	const failed = yield* Ref.make<readonly string[]>(["mail-42"]);
	const live = yield* LiveServer.pipe(Effect.provide(liveServerLayer.pipe(Layer.provide(Reactivity.layer))));
	const jobsModule = registerAdmin(adminRegistry(Jobs), { jobs: FakeJobs });
	const usersModule = registerAdmin(adminRegistry(Users), { users: FakeUsers });
	const restrictedModule = registerAdmin(adminRegistry(RestrictedPage), { restricted: Restricted });
	const registration = mergeAdminRegistrations(jobsModule, usersModule, restrictedModule);
	const group = registration.group;
	const changes = hostChanges(registration.group).pipe(Layer.provide(Layer.succeed(LiveServer, live)));
	const policy = {
		origin: () => true,
		provider: { get: () => Ref.get(session) },
		roles: Access,
	};
	const protocol = changes
		.pipe(Layer.provideMerge(registration.handlers))
		.pipe(Layer.provide([Layer.succeed(SessionPolicy, policy), Layer.succeed(FailedJobs, failed)]));
	const client = yield* RpcTest.makeClient(group).pipe(Effect.provide(protocol));
	const runtime = yield* clientRuntime;
	class Client extends AtomRpc.Service<Client>()("test/AdminLiveClient", {
		group,
		makeEffect: RpcTest.makeClient(group, { flatten: true }),
		protocol,
		runtime,
	}) {}
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(value) => Effect.sync(() => value.dispose()),
	);
	const api = bind(Jobs.contract, Client, { registry });
	return { client, liveFailedJobs: () => AtomRegistry.getResult(registry, api.failed.query()), session };
});
