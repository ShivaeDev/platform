import { Effect, Layer } from "effect";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcTest } from "effect/rpc";
import { jobsPageWithRetry } from "@shivaedev/admin/jobs/retryPage.ts";
import { adminRegistry } from "@shivaedev/admin/registry.ts";
import { bind } from "@shivaedev/effect-contract/bind.ts";
import { Identity, SessionUser } from "@shivaedev/platform/rpc/identity.ts";
import { AuthenticatedAdmin } from "@shivaedev/platform/rpc/middleware.ts";
import { Admin, JobsPage, StatisticsPage } from "#modules/notes/admin.ts";
import { noteQueue } from "#modules/notes/queue.ts";
import { adminBackend } from "./backend.ts";

const authenticated = Layer.succeed(AuthenticatedAdmin, (effect) =>
	effect.pipe(
		Effect.provideService(Identity, { id: "alice" }),
		Effect.provideService(SessionUser, { email: "alice@app.test", id: "alice", name: "Alice", role: "admin" }),
	),
);

export function adminClient(retry = false) {
	const backend = adminBackend();
	class Client extends AtomRpc.Service<Client>()("app/AdminClient", {
		group: Admin.group,
		makeEffect: RpcTest.makeClient(Admin.group, { flatten: true }),
		protocol: Admin.group.toLayer(backend.handlers).pipe(Layer.provideMerge(authenticated)),
	}) {}
	const jobs = bind(JobsPage.contract, Client);
	const statistics = bind(StatisticsPage.contract, Client);
	if (!retry) {
		return { backend, jobs, runtime: Client.runtime, statistics };
	}
	const page = jobsPageWithRetry(noteQueue);
	const registry = adminRegistry(page, StatisticsPage);
	class RetryClient extends AtomRpc.Service<RetryClient>()("app/AdminClient", {
		group: registry.group,
		makeEffect: RpcTest.makeClient(registry.group, { flatten: true }),
		protocol: registry.group.toLayer({ ...backend.handlers, "admin.jobs.retry": backend.retry }).pipe(Layer.provideMerge(authenticated)),
	}) {}
	const api = bind(page.contract, RetryClient);
	const action = RetryClient.runtime.fn((input: { readonly id: string; readonly queue: string }) => api.retry.run(input));
	return { backend, jobs: api, retry: action, runtime: RetryClient.runtime, statistics: bind(StatisticsPage.contract, RetryClient) };
}
