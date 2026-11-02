import { Effect, Layer } from "effect";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcTest } from "effect/rpc";
import { JobsPermission, UsersPermission } from "@shivaedev/admin/permissions.ts";
import { bind } from "@shivaedev/contract/bind.ts";
import { Identity, SessionUser } from "@shivaedev/identity/identity.ts";
import { SessionsPermission } from "@shivaedev/identity/sessionPermissions.ts";
import { foundation } from "#admin/foundation.ts";
import { StatisticsPage } from "#modules/notes/admin/pages.ts";
import { StatisticsPermission } from "#modules/notes/admin/StatisticsPermission.ts";
import { adminBackend } from "./backend.ts";
import { adminGroup } from "./group.ts";

const { JobsPage, UsersPage, SessionsPage } = foundation;

function session<A, E, R>(effect: Effect.Effect<A, E, R>) {
	return effect.pipe(
		Effect.provideService(Identity, { id: "alice" }),
		Effect.provideService(SessionUser, { email: "alice@app.test", id: "alice", name: "Alice", role: "admin" }),
	);
}
const authenticated = Layer.mergeAll(
	Layer.succeed(JobsPermission, session),
	Layer.succeed(UsersPermission, session),
	Layer.succeed(SessionsPermission, session),
	Layer.succeed(StatisticsPermission, session),
);

export function adminClient() {
	const backend = adminBackend();
	class Client extends AtomRpc.Service<Client>()("admin.users/Client", {
		group: adminGroup,
		makeEffect: RpcTest.makeClient(adminGroup, { flatten: true }),
		protocol: adminGroup.toLayer(backend.handlers).pipe(Layer.provideMerge(authenticated)),
	}) {}
	const users = bind(UsersPage.contract, Client);
	return {
		backend,
		changeRole: Client.runtime.fn(users.changeRole.run),
		jobs: bind(JobsPage.contract, Client),
		runtime: Client.runtime,
		sessions: bind(SessionsPage.contract, Client),
		statistics: bind(StatisticsPage.contract, Client),
		users,
	};
}
