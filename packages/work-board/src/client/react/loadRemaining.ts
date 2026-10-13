import type * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { loadQuery } from "@shivaedev/effect-react/router.ts";
import { routeQueryOptions } from "#client/page/routeQuery.ts";
import type { RemainingRoute } from "./remainingRoute.ts";
import type { ShellApi } from "./ShellApi.ts";
export function loadRemaining(
	registry: AtomRegistry.AtomRegistry,
	api: ShellApi,
	route: RemainingRoute,
	url: string,
	abortController: AbortController,
) {
	switch (route) {
		case "changes":
			return undefined;
		case "start":
			return loadQuery(registry, api.start.query(undefined, routeQueryOptions), { abortController });
		case "diagnostics":
			return loadQuery(registry, api.diagnostics.query(undefined, routeQueryOptions), { abortController });
		case "respond":
			return loadQuery(registry, api.respond.query({ url }, routeQueryOptions), { abortController });
		case "handoff":
			return loadQuery(registry, api.handoff.query({ url }, routeQueryOptions), { abortController });
		case "result":
			return loadQuery(registry, api.result.query({ url }, routeQueryOptions), { abortController });
	}
}
