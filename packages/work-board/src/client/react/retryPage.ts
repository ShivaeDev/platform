import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { MainLocation } from "./mainLocation.ts";
import { pageQueries } from "./pageQueries.ts";
import type { ShellApi } from "./ShellApi.ts";

export function retryPage(api: ShellApi, registry: AtomRegistry.AtomRegistry, page: MainLocation) {
	const queries = pageQueries(api, page.projection, page.route);
	if (!(page.failure || queries.some((query) => registry.get(query)._tag === "Failure"))) {
		return false;
	}
	for (const query of queries) {
		registry.refresh(query);
	}
	return true;
}
