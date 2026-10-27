import { Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { bind } from "@shivaedev/contract/bind.ts";
import type { RetryJob } from "#client/admin/jobsTypes.ts";
import { Admin, JobsPage, StatisticsPage, UsersPage } from "#modules/notes/admin.ts";

export function makeAdminClient(url: string, transformClient?: NonNullable<Parameters<typeof RpcClient.layerProtocolHttp>[0]["transformClient"]>) {
	class Client extends AtomRpc.Service<Client>()("app/AdminClient", {
		group: Admin.group,
		protocol: RpcClient.layerProtocolHttp({ ...(transformClient === undefined ? {} : { transformClient }), url }).pipe(
			Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]),
		),
	}) {}
	const users = bind(UsersPage.contract, Client);
	const changeRole = Client.runtime.fn(users.changeRole.run);
	return { changeRole, jobs: bind(JobsPage.contract, Client), runtime: Client.runtime, statistics: bind(StatisticsPage.contract, Client), users };
}

export type AdminClient = ReturnType<typeof makeAdminClient> & { readonly retry?: RetryJob };
