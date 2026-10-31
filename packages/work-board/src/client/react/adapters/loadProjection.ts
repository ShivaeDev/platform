import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { loadQuery } from "@shivaedev/react/adapters/loadQuery.ts";
import { pageQueries } from "#client/react/pageQueries.ts";
import type { ProjectionRoute } from "#client/react/projectionRoute.ts";
import { routeQueryOptions } from "#client/react/routeQuery.ts";
import type { ShellApi } from "#client/react/ShellApi.ts";
export function loadProjection(
	registry: AtomRegistry.AtomRegistry,
	api: ShellApi,
	route: ProjectionRoute,
	url: string,
	abortController: AbortController,
) {
	switch (route) {
		case "today":
			return Promise.all(pageQueries(api, route, url).map((query) => loadQuery(registry, query, { abortController })));
		case "board":
			return loadQuery(registry, api.board.query({ url }, routeQueryOptions), { abortController });
		case "work":
			return loadQuery(registry, api.work.query({ url }, routeQueryOptions), { abortController });
	}
}
