import { Effect, Layer } from "effect";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcTest } from "effect/rpc";
import { jobsPageWithRetry } from "@shivaedev/admin/jobs/retryPage.ts";
import { JobsPermission, UsersPermission } from "@shivaedev/admin/permissions.ts";
import { adminRegistry } from "@shivaedev/admin/registry.ts";
import { bind } from "@shivaedev/contract/bind.ts";
import { Identity, SessionUser } from "@shivaedev/identity/identity.ts";
import { StatisticsPermission } from "#appPermissions.ts";
import { Admin, JobsPage, StatisticsPage, UsersPage } from "#modules/notes/admin.ts";
import { noteQueue } from "#modules/notes/queue.ts";
import { adminBackend } from "./backend.ts";

function session<A, E, R>(effect: Effect.Effect<A, E, R>) {
	return effect.pipe(
		Effect.provideService(Identity, { id: "alice" }),
		Effect.provideService(SessionUser, { email: "alice@app.test", id: "alice", name: "Alice", role: "admin" }),
	);
}
const authenticated = Layer.mergeAll(
	Layer.succeed(JobsPermission, session),
	Layer.succeed(UsersPermission, session),
	Layer.succeed(StatisticsPermission, session),
);

export function adminClient(retry = false) {
	const backend = adminBackend();
	class Client extends AtomRpc.Service<Client>()("admin.users/Client", {
		group: Admin.group,
		makeEffect: RpcTest.makeClient(Admin.group, { flatten: true }),
		protocol: Admin.group.toLayer(backend.handlers).pipe(Layer.provideMerge(authenticated)),
	}) {}
	const jobs = bind(JobsPage.contract, Client);
	const statistics = bind(StatisticsPage.contract, Client);
	if (!retry) {
		const users = bind(UsersPage.contract, Client);
		return { backend, changeRole: Client.runtime.fn(users.changeRole.run), jobs, runtime: Client.runtime, statistics, users };
	}
	const page = jobsPageWithRetry(noteQueue);
	const registry = adminRegistry(page, StatisticsPage, UsersPage);
	class RetryClient extends AtomRpc.Service<RetryClient>()("admin.users/Client", {
		group: registry.group,
		makeEffect: RpcTest.makeClient(registry.group, { flatten: true }),
		protocol: registry.group.toLayer({ ...backend.handlers, "admin.jobs.retry": backend.retry }).pipe(Layer.provideMerge(authenticated)),
	}) {}
	const api = bind(page.contract, RetryClient);
	const action = RetryClient.runtime.fn((input: { readonly id: string; readonly queue: string }) => api.retry.run(input));
	const users = bind(UsersPage.contract, RetryClient);
	return {
		backend,
		changeRole: RetryClient.runtime.fn(users.changeRole.run),
		jobs: api,
		retry: action,
		runtime: RetryClient.runtime,
		statistics: bind(StatisticsPage.contract, RetryClient),
		users,
	};
}
