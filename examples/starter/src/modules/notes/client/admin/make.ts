import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { makeClient } from "@shivaedev/contract/bind.ts";
import type { ClientOptions } from "@shivaedev/contract/clientOptions.ts";
import { StatisticsPage } from "#modules/notes/admin/pages.ts";

export function makeAdminClient(url: string, options: Omit<ClientOptions, "url"> & { readonly registry?: AtomRegistry.AtomRegistry } = {}) {
	const transport = makeClient(StatisticsPage.contract, { url, ...options });
	return Object.assign(transport, { statistics: transport.api });
}
export interface AdminClient {
	readonly statistics: { readonly statistics: Pick<ReturnType<typeof makeAdminClient>["statistics"]["statistics"], "query"> };
}
