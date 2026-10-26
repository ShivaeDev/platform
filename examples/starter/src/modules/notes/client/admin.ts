import { Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { bind } from "@shivaedev/effect-contract/bind.ts";
import type { RetryJob } from "#client/admin/jobsTypes.ts";
import { Admin, JobsPage, StatisticsPage } from "#modules/notes/admin.ts";

export function makeAdminClient(url: string, transformClient?: NonNullable<Parameters<typeof RpcClient.layerProtocolHttp>[0]["transformClient"]>) {
	class Client extends AtomRpc.Service<Client>()("app/AdminClient", {
		group: Admin.group,
		protocol: RpcClient.layerProtocolHttp({ ...(transformClient === undefined ? {} : { transformClient }), url }).pipe(
			Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]),
		),
	}) {}
	return { jobs: bind(JobsPage.contract, Client), runtime: Client.runtime, statistics: bind(StatisticsPage.contract, Client) };
}

export type AdminClient = ReturnType<typeof makeAdminClient> & { readonly retry?: RetryJob };
