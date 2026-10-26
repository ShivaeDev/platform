import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { loadQuery } from "@shivaedev/react/loadQuery.ts";
import type { RemainingRoute } from "./remainingRoute.ts";
import { libraryQuery, routeQueryOptions } from "./routeQuery.ts";
import type { ShellApi } from "./ShellApi.ts";
export function loadRemaining(
	registry: AtomRegistry.AtomRegistry,
	api: ShellApi,
	route: RemainingRoute,
	url: string,
	abortController: AbortController,
) {
	switch (route) {
		case "pull-requests":
			return loadQuery(registry, api.fleetItems.query(undefined, routeQueryOptions), { abortController });
		case "library":
			return loadQuery(registry, libraryQuery(api, url), { abortController });
		case "goals":
			return loadQuery(registry, api.goals.query(undefined, routeQueryOptions), { abortController });
		case "start":
			return loadQuery(registry, api.start.query(undefined, routeQueryOptions), { abortController });
		case "system":
			return Promise.all([
				loadQuery(registry, api.diagnostics.query(undefined, routeQueryOptions), { abortController }),
				loadQuery(registry, api.fleetItems.query(undefined, routeQueryOptions), { abortController }),
			]);
		case "handoff":
			return loadQuery(registry, api.handoff.query({ url }, routeQueryOptions), { abortController });
	}
}
