import { makeClient } from "@shivaedev/contract/bind.ts";
import type { ClientOptions } from "@shivaedev/contract/clientOptions.ts";
import { StatisticsPage } from "#modules/notes/admin.ts";

export function makeAdminClient(url: string, options: Omit<ClientOptions, "url"> = {}) {
	const { api: statistics } = makeClient(StatisticsPage.contract, { url, ...options });
	return { statistics };
}
export interface AdminClient {
	readonly statistics: { readonly statistics: Pick<ReturnType<typeof makeAdminClient>["statistics"]["statistics"], "query"> };
}
